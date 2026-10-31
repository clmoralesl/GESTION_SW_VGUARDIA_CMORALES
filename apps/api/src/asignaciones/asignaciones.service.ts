import { HttpStatus, Injectable } from '@nestjs/common';
import { AccionBitacora, Prisma } from '@prisma/client';
import {
  calcularHorasPlan,
  consolidarCostos,
  resumirCostos,
  validar,
  esquemaActualizarAsignacionProfesional,
  esquemaActualizarAsignacionRecurso,
  type ActualizarAsignacion,
  type AsignacionCosto,
  type AsignacionResumen,
  type CrearAsignacion,
  type NodoCosto,
  type ResumenCostos,
  type Rol,
} from '@autofix/core';
import { BitacoraService, ContextoBitacora } from '../comun/bitacora/bitacora.service';
import { diferencias } from '../comun/bitacora/diferencias';
import { ExcepcionApi } from '../comun/errores/excepcion-api';
import { PrismaService } from '../prisma/prisma.service';
import { obtenerProyectoAbierto } from '../proyectos/proyecto-abierto';
import { RecalculoService } from '../recalculo/recalculo.service';
import { instantaneaAsignacion, mapearAsignacion } from './asignaciones.mapeo';

const INCLUIR_RELACIONES = {
  profesional: true,
  recurso: { include: { tipoRecurso: true } },
} as const;

const errorTareaNoEncontrada = () =>
  new ExcepcionApi(HttpStatus.NOT_FOUND, 'REGISTRO_NO_ENCONTRADO', 'La tarea no existe.');

const errorAsignacionNoEncontrada = () =>
  new ExcepcionApi(HttpStatus.NOT_FOUND, 'REGISTRO_NO_ENCONTRADO', 'La asignación no existe.');

const errorProfesionalNoExiste = () =>
  new ExcepcionApi(HttpStatus.NOT_FOUND, 'REGISTRO_NO_ENCONTRADO', 'El profesional no existe.');

const errorRecursoNoExiste = () =>
  new ExcepcionApi(HttpStatus.NOT_FOUND, 'REGISTRO_NO_ENCONTRADO', 'El recurso no existe.');

const errorProyectoNoExiste = () =>
  new ExcepcionApi(HttpStatus.NOT_FOUND, 'REGISTRO_NO_ENCONTRADO', 'El proyecto no existe.');

export interface RespuestaMutacionAsignacion {
  asignacion: AsignacionResumen;
  costos: ResumenCostos | null;
}

@Injectable()
export class AsignacionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bitacora: BitacoraService,
    private readonly recalculo: RecalculoService,
  ) {}

  private contexto(proyectoId: number, entidadId: number, rol: Rol): ContextoBitacora {
    return { proyectoId, entidad: 'Asignacion', entidadId, rol };
  }

  async listarPorTarea(tareaId: number): Promise<AsignacionResumen[]> {
    const tarea = await this.prisma.tarea.findUnique({ where: { id: tareaId } });
    if (!tarea) throw errorTareaNoEncontrada();

    const asignaciones = await this.prisma.asignacion.findMany({
      where: { tareaId },
      include: INCLUIR_RELACIONES,
      orderBy: { id: 'asc' },
    });
    return asignaciones.map(mapearAsignacion);
  }

  async crear(
    tareaId: number,
    datos: CrearAsignacion,
    rol: Rol,
  ): Promise<RespuestaMutacionAsignacion> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const tarea = await tx.tarea.findUnique({ where: { id: tareaId } });
        if (!tarea) throw errorTareaNoEncontrada();
        await obtenerProyectoAbierto(tx, tarea.proyectoId, { bloquear: true });

        const tieneHijas = (await tx.tarea.count({ where: { padreId: tareaId } })) > 0;
        if (tieneHijas) {
          throw new ExcepcionApi(
            HttpStatus.CONFLICT,
            'TAREA_NO_HOJA',
            'Solo se pueden agregar asignaciones a tareas hoja.',
          );
        }

        let asignacionCreada;

        if ('profesionalId' in datos) {
          const profesional = await tx.profesional.findUnique({
            where: { id: datos.profesionalId },
          });
          if (!profesional) throw errorProfesionalNoExiste();
          if (!profesional.activo) {
            throw new ExcepcionApi(
              HttpStatus.CONFLICT,
              'PROFESIONAL_INACTIVO',
              'No se pueden crear asignaciones para un profesional inactivo.',
            );
          }

          const existente = await tx.asignacion.findUnique({
            where: {
              tareaId_profesionalId: { tareaId, profesionalId: datos.profesionalId },
            },
          });
          if (existente) {
            throw new ExcepcionApi(
              HttpStatus.CONFLICT,
              'ASIGNACION_DUPLICADA',
              'El profesional ya está asignado a esta tarea.',
            );
          }

          let horasPlan: Prisma.Decimal;
          let horasPlanManual = false;
          if (datos.horasPlan !== undefined && datos.horasPlan !== null) {
            horasPlan = new Prisma.Decimal(datos.horasPlan);
            horasPlanManual = true;
          } else {
            const calculadas = calcularHorasPlan(
              tarea.duracionDias,
              Number(profesional.horasDiarias),
              datos.dedicacion,
            );
            horasPlan = new Prisma.Decimal(calculadas);
          }

          asignacionCreada = await tx.asignacion.create({
            data: {
              tareaId,
              profesionalId: datos.profesionalId,
              dedicacion: new Prisma.Decimal(datos.dedicacion),
              horasPlan,
              horasPlanManual,
              horasReales:
                datos.horasReales !== undefined && datos.horasReales !== null
                  ? new Prisma.Decimal(datos.horasReales)
                  : null,
              tarifaAplicada: new Prisma.Decimal(profesional.tarifaHora),
            },
            include: INCLUIR_RELACIONES,
          });
        } else {
          const recurso = await tx.recurso.findUnique({
            where: { id: datos.recursoId },
          });
          if (!recurso) throw errorRecursoNoExiste();
          if (!recurso.activo) {
            throw new ExcepcionApi(
              HttpStatus.CONFLICT,
              'RECURSO_INACTIVO',
              'No se pueden crear asignaciones para un recurso inactivo.',
            );
          }

          const existente = await tx.asignacion.findUnique({
            where: {
              tareaId_recursoId: { tareaId, recursoId: datos.recursoId },
            },
          });
          if (existente) {
            throw new ExcepcionApi(
              HttpStatus.CONFLICT,
              'ASIGNACION_DUPLICADA',
              'El recurso ya está asignado a esta tarea.',
            );
          }

          asignacionCreada = await tx.asignacion.create({
            data: {
              tareaId,
              recursoId: datos.recursoId,
              cantidadPlan:
                datos.cantidadPlan !== undefined && datos.cantidadPlan !== null
                  ? new Prisma.Decimal(datos.cantidadPlan)
                  : null,
              cantidadReal:
                datos.cantidadReal !== undefined && datos.cantidadReal !== null
                  ? new Prisma.Decimal(datos.cantidadReal)
                  : null,
              costoUnitarioAplicado: new Prisma.Decimal(recurso.costoUnitario),
            },
            include: INCLUIR_RELACIONES,
          });
        }

        await this.bitacora.registrarCreacion(
          tx,
          this.contexto(tarea.proyectoId, asignacionCreada.id, rol),
          instantaneaAsignacion(asignacionCreada),
        );

        const recalculo = await this.recalculo.ejecutar(tarea.proyectoId, tx, {
          rol,
          descripcion: 'Crear asignación en',
          tareaId,
        });

        const asignacionFinal = await tx.asignacion.findUniqueOrThrow({
          where: { id: asignacionCreada.id },
          include: INCLUIR_RELACIONES,
        });

        return {
          asignacion: mapearAsignacion(asignacionFinal),
          costos: recalculo.costos ?? null,
        };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2003') {
          if ('profesionalId' in datos) throw errorProfesionalNoExiste();
          throw errorRecursoNoExiste();
        }
        if (error.code === 'P2002') {
          throw new ExcepcionApi(
            HttpStatus.CONFLICT,
            'ASIGNACION_DUPLICADA',
            'La asignación ya existe para esta tarea.',
          );
        }
      }
      throw error;
    }
  }

  async actualizar(
    asignacionId: number,
    datos: ActualizarAsignacion,
    rol: Rol,
  ): Promise<RespuestaMutacionAsignacion> {
    if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
      throw new ExcepcionApi(
        HttpStatus.BAD_REQUEST,
        'VALIDACION_FALLIDA',
        'El cuerpo de la solicitud debe ser un objeto.',
      );
    }

    if ('profesionalId' in datos || 'recursoId' in datos) {
      throw new ExcepcionApi(
        HttpStatus.BAD_REQUEST,
        'DESTINO_INMUTABLE',
        'El destino de la asignación no se puede modificar.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const asig = await tx.asignacion.findUnique({
        where: { id: asignacionId },
        include: { ...INCLUIR_RELACIONES, tarea: true },
      });
      if (!asig) throw errorAsignacionNoEncontrada();

      await obtenerProyectoAbierto(tx, asig.tarea.proyectoId, { bloquear: true });

      const dataUpdate: Prisma.AsignacionUpdateInput = {};

      if (asig.profesionalId !== null) {
        const val = validar(esquemaActualizarAsignacionProfesional, datos);
        if (!val.ok) {
          throw new ExcepcionApi(
            HttpStatus.BAD_REQUEST,
            'VALIDACION_FALLIDA',
            'Los datos enviados no son válidos.',
            val.detalles,
          );
        }
        const pDatos = val.datos;
        if (pDatos.dedicacion !== undefined) {
          dataUpdate.dedicacion = new Prisma.Decimal(pDatos.dedicacion);
        }
        if (pDatos.horasPlan !== undefined) {
          dataUpdate.horasPlan =
            pDatos.horasPlan !== null ? new Prisma.Decimal(pDatos.horasPlan) : null;
          dataUpdate.horasPlanManual = pDatos.horasPlan !== null;
        }
        if (pDatos.horasReales !== undefined) {
          dataUpdate.horasReales =
            pDatos.horasReales !== null ? new Prisma.Decimal(pDatos.horasReales) : null;
        }
        if (pDatos.actualizarTarifa === true) {
          const prof = await tx.profesional.findUniqueOrThrow({
            where: { id: asig.profesionalId },
          });
          dataUpdate.tarifaAplicada = new Prisma.Decimal(prof.tarifaHora);
        }
      } else if (asig.recursoId !== null) {
        const val = validar(esquemaActualizarAsignacionRecurso, datos);
        if (!val.ok) {
          throw new ExcepcionApi(
            HttpStatus.BAD_REQUEST,
            'VALIDACION_FALLIDA',
            'Los datos enviados no son válidos.',
            val.detalles,
          );
        }
        const rDatos = val.datos;
        if (rDatos.cantidadPlan !== undefined) {
          dataUpdate.cantidadPlan =
            rDatos.cantidadPlan !== null ? new Prisma.Decimal(rDatos.cantidadPlan) : null;
        }
        if (rDatos.cantidadReal !== undefined) {
          dataUpdate.cantidadReal =
            rDatos.cantidadReal !== null ? new Prisma.Decimal(rDatos.cantidadReal) : null;
        }
        if (rDatos.actualizarTarifa === true) {
          const rec = await tx.recurso.findUniqueOrThrow({
            where: { id: asig.recursoId },
          });
          dataUpdate.costoUnitarioAplicado = new Prisma.Decimal(rec.costoUnitario);
        }
      }

      const actualizada = await tx.asignacion.update({
        where: { id: asignacionId },
        data: dataUpdate,
        include: INCLUIR_RELACIONES,
      });

      const antesInst = instantaneaAsignacion(asig);
      const despuesInst = instantaneaAsignacion(actualizada);
      const camposModificados = Object.keys(dataUpdate);
      const cambios = diferencias(antesInst, despuesInst, camposModificados);

      await this.bitacora.registrarCambios(
        tx,
        this.contexto(asig.tarea.proyectoId, asignacionId, rol),
        AccionBitacora.ACTUALIZAR,
        cambios,
      );

      const recalculo = await this.recalculo.ejecutar(asig.tarea.proyectoId, tx, {
        rol,
        descripcion: 'Actualizar asignación en',
        tareaId: asig.tareaId,
      });

      const asignacionFinal = await tx.asignacion.findUniqueOrThrow({
        where: { id: asignacionId },
        include: INCLUIR_RELACIONES,
      });

      return {
        asignacion: mapearAsignacion(asignacionFinal),
        costos: recalculo.costos ?? null,
      };
    });
  }

  async eliminar(asignacionId: number, rol: Rol): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const asig = await tx.asignacion.findUnique({
        where: { id: asignacionId },
        include: { ...INCLUIR_RELACIONES, tarea: true },
      });
      if (!asig) throw errorAsignacionNoEncontrada();

      await obtenerProyectoAbierto(tx, asig.tarea.proyectoId, { bloquear: true });

      await tx.asignacion.delete({ where: { id: asignacionId } });

      await this.bitacora.registrarEliminacion(
        tx,
        this.contexto(asig.tarea.proyectoId, asignacionId, rol),
        instantaneaAsignacion(asig),
      );

      await this.recalculo.ejecutar(asig.tarea.proyectoId, tx, {
        rol,
        descripcion: 'Eliminar asignación en',
        tareaId: asig.tareaId,
      });
    });
  }

  async obtenerCostos(proyectoId: number): Promise<ResumenCostos> {
    const proyecto = await this.prisma.proyecto.findUnique({ where: { id: proyectoId } });
    if (!proyecto) throw errorProyectoNoExiste();

    const tareas = await this.prisma.tarea.findMany({ where: { proyectoId } });
    const asignaciones = await this.prisma.asignacion.findMany({
      where: { tareaId: { in: tareas.map((t) => t.id) } },
    });

    const asignacionesCosto: AsignacionCosto[] = asignaciones.map((a) => ({
      tareaId: a.tareaId,
      horasPlan: a.horasPlan !== null ? Number(a.horasPlan) : null,
      horasReales: a.horasReales !== null ? Number(a.horasReales) : null,
      tarifaAplicada: a.tarifaAplicada !== null ? Number(a.tarifaAplicada) : null,
      cantidadPlan: a.cantidadPlan !== null ? Number(a.cantidadPlan) : null,
      cantidadReal: a.cantidadReal !== null ? Number(a.cantidadReal) : null,
      costoUnitarioAplicado:
        a.costoUnitarioAplicado !== null ? Number(a.costoUnitarioAplicado) : null,
    }));

    const nodos: NodoCosto[] = tareas.map((t) => ({ id: t.id, padreId: t.padreId }));
    const resultado = consolidarCostos(nodos, asignacionesCosto);
    return resumirCostos(Number(proyecto.presupuesto), resultado.proyecto);
  }
}
