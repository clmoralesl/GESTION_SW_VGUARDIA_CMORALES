import { HttpStatus, Injectable } from '@nestjs/common';
import { AccionBitacora, EstadoProyecto, Prisma, Proyecto } from '@prisma/client';
import {
  ActualizarProyecto,
  avancePonderado,
  CrearProyecto,
  dateAFechaIso,
  fechasEnOrden,
  fechaIsoADate,
  feriadosChileDesde,
  formatearFecha,
  MENSAJE_FECHAS,
  NOMBRES_ESTADO_PROYECTO,
  puedeTransicionar,
  type EstadoProyecto as EstadoProyectoCore,
  type ProyectoDetalle,
  type ProyectoResumen,
  type Rol,
} from '@autofix/core';
import { BitacoraService } from '../comun/bitacora/bitacora.service';
import { diferencias } from '../comun/bitacora/diferencias';
import { ExcepcionApi } from '../comun/errores/excepcion-api';
import { PrismaService } from '../prisma/prisma.service';
import {
  errorProyectoCerrado,
  errorProyectoNoEncontrado,
  obtenerProyectoAbierto,
} from './proyecto-abierto';
import { mapearProyectoDetalle, mapearProyectoResumen } from './proyectos.mapeo';
import { RecalculoService } from '../recalculo/recalculo.service';

const CAMPOS_AUDITADOS = [
  'nombre',
  'descripcion',
  'responsable',
  'presupuesto',
  'fechaInicio',
  'fechaFin',
] as const;

@Injectable()
export class ProyectosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bitacora: BitacoraService,
    private readonly recalculo: RecalculoService,
  ) {}

  async listar(): Promise<ProyectoResumen[]> {
    const proyectos = await this.prisma.proyecto.findMany({
      orderBy: { nombre: 'asc' },
    });

    if (proyectos.length === 0) return [];

    const ids = proyectos.map((p) => p.id);
    const etapas = await this.prisma.tarea.findMany({
      where: { nivel: 'ETAPA', proyectoId: { in: ids } },
      select: {
        proyectoId: true,
        porcentajeAvance: true,
        duracionDias: true,
      },
    });

    const etapasPorProyecto = new Map<number, Array<{ avance: number; duracion: number }>>();

    for (const etapa of etapas) {
      const lista = etapasPorProyecto.get(etapa.proyectoId) ?? [];
      lista.push({
        avance: Number(etapa.porcentajeAvance),
        duracion: etapa.duracionDias,
      });
      etapasPorProyecto.set(etapa.proyectoId, lista);
    }

    return proyectos.map((p) => {
      const elementos = etapasPorProyecto.get(p.id) ?? [];
      const avance = avancePonderado(elementos);
      return mapearProyectoResumen(p, avance);
    });
  }

  async obtener(id: number): Promise<ProyectoDetalle> {
    const proyecto = await this.prisma.proyecto.findUnique({
      where: { id },
    });

    if (!proyecto) throw errorProyectoNoEncontrado();

    return this.calcularDetalle(this.prisma, proyecto);
  }

  async crear(datos: CrearProyecto, rol: Rol): Promise<ProyectoDetalle> {
    return this.prisma.$transaction(async (tx) => {
      const proyecto = await tx.proyecto.create({
        data: {
          nombre: datos.nombre,
          descripcion: datos.descripcion,
          responsable: datos.responsable,
          presupuesto: datos.presupuesto,
          fechaInicio: fechaIsoADate(datos.fechaInicio),
          fechaFin: datos.fechaFin ? fechaIsoADate(datos.fechaFin) : null,
          estado: EstadoProyecto.PLANIFICADO,
          calendario: {
            create: {
              feriados: {
                create: feriadosChileDesde(datos.fechaInicio).map((f) => ({
                  fecha: fechaIsoADate(f.fecha),
                  descripcion: f.descripcion,
                })),
              },
            },
          },
        },
      });

      await this.bitacora.registrarCreacion(
        tx,
        { proyectoId: proyecto.id, entidad: 'Proyecto', entidadId: proyecto.id, rol },
        {
          nombre: proyecto.nombre,
          descripcion: proyecto.descripcion,
          responsable: proyecto.responsable,
          presupuesto: Number(proyecto.presupuesto),
          fechaInicio: dateAFechaIso(proyecto.fechaInicio),
          fechaFin: proyecto.fechaFin ? dateAFechaIso(proyecto.fechaFin) : null,
        },
      );

      return mapearProyectoDetalle(proyecto, 0, 0);
    });
  }

  async actualizar(id: number, datos: ActualizarProyecto, rol: Rol): Promise<ProyectoDetalle> {
    return this.prisma.$transaction(async (tx) => {
      const antes = await obtenerProyectoAbierto(tx, id, { bloquear: true });

      const fechaInicio = datos.fechaInicio ?? dateAFechaIso(antes.fechaInicio);
      const fechaFin =
        datos.fechaFin === undefined
          ? antes.fechaFin && dateAFechaIso(antes.fechaFin)
          : datos.fechaFin;

      if (!fechasEnOrden(fechaInicio, fechaFin)) {
        throw new ExcepcionApi(
          HttpStatus.BAD_REQUEST,
          'VALIDACION_FALLIDA',
          'Los datos enviados no son válidos.',
          [{ campo: 'fechaFin', mensaje: MENSAJE_FECHAS }],
        );
      }

      const datosActualizacion: Prisma.ProyectoUpdateInput = {};
      if (datos.nombre !== undefined) datosActualizacion.nombre = datos.nombre;
      if (datos.descripcion !== undefined) datosActualizacion.descripcion = datos.descripcion;
      if (datos.responsable !== undefined) datosActualizacion.responsable = datos.responsable;
      if (datos.presupuesto !== undefined) datosActualizacion.presupuesto = datos.presupuesto;
      if (datos.fechaInicio !== undefined) {
        datosActualizacion.fechaInicio = fechaIsoADate(datos.fechaInicio);
      }
      if (datos.fechaFin !== undefined) {
        datosActualizacion.fechaFin = datos.fechaFin ? fechaIsoADate(datos.fechaFin) : null;
      }

      const { count } = await tx.proyecto.updateMany({
        where: { id, estado: { not: EstadoProyecto.CERRADO } },
        data: datosActualizacion,
      });

      if (count === 0) throw errorProyectoCerrado();

      const despues = await tx.proyecto.findUniqueOrThrow({ where: { id } });

      const camposAfectados = CAMPOS_AUDITADOS.filter((c) => c in datos);
      const cambios = diferencias(antes, despues, camposAfectados);
      await this.bitacora.registrarCambios(
        tx,
        { proyectoId: id, entidad: 'Proyecto', entidadId: id, rol },
        AccionBitacora.ACTUALIZAR,
        cambios,
      );

      if (
        datos.fechaInicio !== undefined &&
        dateAFechaIso(antes.fechaInicio) !== dateAFechaIso(despues.fechaInicio)
      ) {
        const antesFmt = formatearFecha(dateAFechaIso(antes.fechaInicio));
        const despuesFmt = formatearFecha(dateAFechaIso(despues.fechaInicio));
        await this.recalculo.ejecutar(id, tx, {
          rol,
          descripcion: `Cambio de fecha de inicio del proyecto: ${antesFmt} → ${despuesFmt}`,
        });
      } else if (
        datos.presupuesto !== undefined &&
        Number(antes.presupuesto) !== Number(despues.presupuesto)
      ) {
        await this.recalculo.ejecutar(id, tx, {
          rol,
          descripcion: 'Cambio de presupuesto del proyecto',
        });
      }

      return this.calcularDetalle(tx, despues);
    });
  }

  async cambiarEstado(id: number, hacia: EstadoProyectoCore, rol: Rol): Promise<ProyectoDetalle> {
    return this.prisma.$transaction(async (tx) => {
      const actual = await tx.proyecto.findUnique({ where: { id } });
      if (!actual) throw errorProyectoNoEncontrado();

      const estadoActual = actual.estado as EstadoProyectoCore;
      if (!puedeTransicionar(estadoActual, hacia)) {
        throw new ExcepcionApi(
          HttpStatus.CONFLICT,
          'TRANSICION_INVALIDA',
          `No se puede pasar de ${NOMBRES_ESTADO_PROYECTO[estadoActual]} a ${NOMBRES_ESTADO_PROYECTO[hacia]}.`,
        );
      }

      const { count } = await tx.proyecto.updateMany({
        where: { id, estado: actual.estado },
        data: { estado: hacia as EstadoProyecto },
      });

      if (count === 0) {
        throw new ExcepcionApi(
          HttpStatus.CONFLICT,
          'TRANSICION_INVALIDA',
          'La transición de estado ya no es válida.',
        );
      }

      const despues = await tx.proyecto.findUniqueOrThrow({ where: { id } });

      const accion = hacia === 'CERRADO' ? AccionBitacora.CERRAR : AccionBitacora.ACTUALIZAR;

      await this.bitacora.registrarCambios(
        tx,
        { proyectoId: id, entidad: 'Proyecto', entidadId: id, rol },
        accion,
        [
          {
            campo: 'estado',
            anterior: actual.estado,
            nuevo: hacia,
          },
        ],
      );

      return this.calcularDetalle(tx, despues);
    });
  }

  private async calcularDetalle(
    client: Prisma.TransactionClient | PrismaService,
    proyecto: Proyecto,
  ): Promise<ProyectoDetalle> {
    const [etapas, numeroTareas] = await Promise.all([
      client.tarea.findMany({
        where: { nivel: 'ETAPA', proyectoId: proyecto.id },
        select: { porcentajeAvance: true, duracionDias: true },
      }),
      client.tarea.count({ where: { proyectoId: proyecto.id } }),
    ]);

    const avance = avancePonderado(
      etapas.map((e) => ({
        avance: Number(e.porcentajeAvance),
        duracion: e.duracionDias,
      })),
    );

    return mapearProyectoDetalle(proyecto, avance, numeroTareas);
  }
}
