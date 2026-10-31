import { HttpStatus, Injectable } from '@nestjs/common';
import { AccionBitacora, Prisma, type Tarea } from '@prisma/client';
import {
  CAMPOS_CALCULADOS,
  CAMPOS_EDITABLES,
  contarDescendientes,
  dateAFechaIso,
  esJerarquiaValida,
  fechaIsoADate,
  insertarEnArbol,
  moverEnArbol,
  type ActualizarTarea,
  type ArbolTareas,
  type CrearTarea,
  type MoverTarea,
  type ResultadoRecalculo,
  type Rol,
} from '@autofix/core';
import { BitacoraService } from '../comun/bitacora/bitacora.service';
import { diferencias } from '../comun/bitacora/diferencias';
import { ExcepcionApi } from '../comun/errores/excepcion-api';
import { Reloj } from '../comun/reloj/reloj';
import { PrismaService } from '../prisma/prisma.service';
import { errorProyectoNoEncontrado, obtenerProyectoAbierto } from '../proyectos/proyecto-abierto';
import { cargarCalendarioLaboral } from '../calendario/calendario-laboral';
import { construirListaHitos } from '../hitos/hitos.mapeo';
import { RecalculoService } from '../recalculo/recalculo.service';
import { ArbolTareasService } from './arbol-tareas.service';

export const errorTareaNoEncontrada = () =>
  new ExcepcionApi(HttpStatus.NOT_FOUND, 'REGISTRO_NO_ENCONTRADO', 'La tarea no existe.');

export const errorCampoCalculado = (campos: readonly string[]) =>
  new ExcepcionApi(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'CAMPO_CALCULADO',
    'Los campos calculados de una tarea con subtareas no se editan.',
    { campos },
  );

const ETIQUETAS_PLANIFICACION: Record<string, string> = {
  duracionDias: 'duración',
  fechaFija: 'fecha fija',
  inicioReal: 'inicio real',
  finReal: 'fin real',
  porcentajeAvance: 'avance',
};

function validarFechasReales(tarea: Tarea, datos: ActualizarTarea): void {
  const inicioRealStr =
    'inicioReal' in datos
      ? datos.inicioReal
      : tarea.inicioReal
        ? dateAFechaIso(tarea.inicioReal)
        : null;
  const finRealStr =
    'finReal' in datos ? datos.finReal : tarea.finReal ? dateAFechaIso(tarea.finReal) : null;

  if (finRealStr && !inicioRealStr) {
    throw new ExcepcionApi(
      HttpStatus.BAD_REQUEST,
      'VALIDACION_FALLIDA',
      'No se puede ingresar fin real sin inicio real.',
      [
        {
          campo: 'finReal',
          mensaje: 'Debe registrar la fecha de inicio real antes o junto con la fecha de fin real.',
        },
      ],
    );
  }

  if (inicioRealStr && finRealStr && finRealStr < inicioRealStr) {
    throw new ExcepcionApi(
      HttpStatus.BAD_REQUEST,
      'VALIDACION_FALLIDA',
      'La fecha de fin real no puede ser anterior a la de inicio real.',
      [
        {
          campo: 'finReal',
          mensaje: 'La fecha de fin real no puede ser anterior a la de inicio real.',
        },
      ],
    );
  }
}

function aDatosPrisma(datos: ActualizarTarea): Prisma.TareaUpdateInput {
  const resultado: Prisma.TareaUpdateInput = {};
  if ('nombre' in datos && datos.nombre !== undefined) resultado.nombre = datos.nombre;
  if ('descripcion' in datos) resultado.descripcion = datos.descripcion;
  if ('responsable' in datos) resultado.responsable = datos.responsable;
  if ('duracionDias' in datos && datos.duracionDias !== undefined) {
    resultado.duracionDias = datos.duracionDias;
  }
  if ('fechaFija' in datos) {
    resultado.fechaFija = datos.fechaFija ? fechaIsoADate(datos.fechaFija) : null;
  }
  if ('inicioReal' in datos) {
    resultado.inicioReal = datos.inicioReal ? fechaIsoADate(datos.inicioReal) : null;
  }
  if ('finReal' in datos) {
    resultado.finReal = datos.finReal ? fechaIsoADate(datos.finReal) : null;
  }
  if ('porcentajeAvance' in datos && datos.porcentajeAvance !== undefined) {
    resultado.porcentajeAvance = new Prisma.Decimal(datos.porcentajeAvance);
  }
  return resultado;
}

function obtenerIdsSubarbol(
  tareas: readonly Pick<Tarea, 'id' | 'padreId'>[],
  raizId: number,
): number[] {
  const hijosPorPadre = new Map<number, number[]>();
  for (const t of tareas) {
    if (t.padreId !== null) {
      hijosPorPadre.set(t.padreId, [...(hijosPorPadre.get(t.padreId) ?? []), t.id]);
    }
  }
  const ids: number[] = [raizId];
  const cola: number[] = [raizId];
  while (cola.length > 0) {
    const actual = cola.shift()!;
    const hijos = hijosPorPadre.get(actual) ?? [];
    for (const h of hijos) {
      ids.push(h);
      cola.push(h);
    }
  }
  return ids;
}

@Injectable()
export class TareasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly arbol: ArbolTareasService,
    private readonly recalculo: RecalculoService,
    private readonly bitacora: BitacoraService,
    private readonly reloj: Reloj,
  ) {}

  async obtenerArbol(proyectoId: number): Promise<ArbolTareas> {
    const proyecto = await this.prisma.proyecto.findUnique({
      where: { id: proyectoId },
    });
    if (!proyecto) throw errorProyectoNoEncontrado();
    return this.arbol.cargar(this.prisma, proyectoId);
  }

  async crear(proyectoId: number, datos: CrearTarea, rol: Rol): Promise<ResultadoRecalculo> {
    return this.prisma.$transaction(
      async (tx) => {
        await obtenerProyectoAbierto(tx, proyectoId, { bloquear: true });

        if (datos.padreId !== null) {
          const padre = await tx.tarea.findFirst({
            where: { id: datos.padreId, proyectoId },
          });
          if (!padre || !esJerarquiaValida(datos.nivel, padre.nivel)) {
            throw new ExcepcionApi(
              HttpStatus.UNPROCESSABLE_ENTITY,
              'JERARQUIA_INVALIDA',
              'La jerarquía entre el nivel de la tarea y su padre no es válida.',
            );
          }
          const asignacionesPadre = await tx.asignacion.count({
            where: { tareaId: padre.id },
          });
          if (asignacionesPadre > 0) {
            throw new ExcepcionApi(
              HttpStatus.CONFLICT,
              'TAREA_CON_ASIGNACIONES',
              'No se pueden crear subtareas bajo una tarea que tiene asignaciones.',
            );
          }
          await this.prepararPadreParaSubtareas(tx, padre, rol);
        } else if (!esJerarquiaValida(datos.nivel, null)) {
          throw new ExcepcionApi(
            HttpStatus.UNPROCESSABLE_ENTITY,
            'JERARQUIA_INVALIDA',
            'Una etapa no puede tener padre.',
          );
        }

        const tareasExistentes = await tx.tarea.findMany({
          where: { proyectoId },
        });
        const nodoNuevoVirtual = {
          id: 0,
          padreId: datos.padreId,
          orden: 0,
        };
        const arbolConNuevo = insertarEnArbol(tareasExistentes, nodoNuevoVirtual, datos.posicion);
        const ordenCalculado = arbolConNuevo.find((n) => n.id === 0)?.orden ?? 1;

        for (const nodo of arbolConNuevo) {
          if (nodo.id !== 0) {
            const original = tareasExistentes.find((t) => t.id === nodo.id);
            if (original && original.orden !== nodo.orden) {
              await tx.tarea.update({
                where: { id: nodo.id },
                data: { orden: nodo.orden },
              });
            }
          }
        }

        const duracion = datos.duracionDias ?? 1;
        const fechaFijaDate = datos.fechaFija ? fechaIsoADate(datos.fechaFija) : null;

        const creada = await tx.tarea.create({
          data: {
            proyectoId,
            padreId: datos.padreId,
            nivel: datos.nivel,
            codigo: `~nueva-${Date.now()}`,
            orden: ordenCalculado,
            nombre: datos.nombre,
            descripcion: datos.descripcion,
            responsable: datos.responsable,
            duracionDias: duracion,
            fechaFija: fechaFijaDate,
            inicioPlan: null,
            finPlan: null,
            porcentajeAvance: new Prisma.Decimal(0),
          },
        });

        const resultado = await this.recalculo.ejecutar(proyectoId, tx, {
          rol,
          descripcion: 'Tarea creada:',
          tareaId: creada.id,
        });

        const tareaReorganizada = resultado.arbol.tareas.find((t) => t.id === creada.id);

        await this.bitacora.registrarCreacion(
          tx,
          {
            proyectoId,
            entidad: 'Tarea',
            entidadId: creada.id,
            rol,
          },
          {
            codigo: tareaReorganizada?.codigo ?? creada.codigo,
            nombre: creada.nombre,
            nivel: creada.nivel,
            padreId: creada.padreId,
            duracionDias: creada.duracionDias,
            fechaFija: datos.fechaFija ?? null,
          },
        );

        return resultado;
      },
      { timeout: 15_000 },
    );
  }

  async actualizar(tareaId: number, datos: ActualizarTarea, rol: Rol): Promise<ResultadoRecalculo> {
    return this.prisma.$transaction(
      async (tx) => {
        const referencia = await tx.tarea.findUnique({
          where: { id: tareaId },
          select: { proyectoId: true },
        });
        if (!referencia) throw errorTareaNoEncontrada();
        await obtenerProyectoAbierto(tx, referencia.proyectoId, { bloquear: true });
        const tarea = await tx.tarea.findUnique({ where: { id: tareaId } });
        if (!tarea) throw errorTareaNoEncontrada();

        const tieneHijas = (await tx.tarea.count({ where: { padreId: tareaId } })) > 0;
        const calculados = CAMPOS_CALCULADOS.filter((campo) => campo in datos);
        if (tieneHijas && calculados.length > 0) {
          throw errorCampoCalculado(calculados);
        }

        validarFechasReales(tarea, datos);

        const antes = tarea;
        await tx.tarea.update({
          where: { id: tareaId },
          data: aDatosPrisma(datos),
        });
        const despues = await tx.tarea.findUniqueOrThrow({
          where: { id: tareaId },
        });

        const cambios = diferencias(
          antes,
          despues,
          CAMPOS_EDITABLES.filter((c) => c in datos),
        );

        await this.bitacora.registrarCambios(
          tx,
          {
            proyectoId: tarea.proyectoId,
            entidad: 'Tarea',
            entidadId: tareaId,
            rol,
          },
          AccionBitacora.ACTUALIZAR,
          cambios,
        );

        const camposPlan = cambios
          .map((c) => ETIQUETAS_PLANIFICACION[c.campo])
          .filter((etiqueta): etiqueta is string => etiqueta !== undefined);

        let descripcion: string;
        if (camposPlan.length > 0) {
          const formateador = new Intl.ListFormat('es', { type: 'conjunction' });
          descripcion = `Cambio de ${formateador.format(camposPlan)} en`;
        } else {
          descripcion = 'Edición en';
        }

        return this.recalculo.ejecutar(tarea.proyectoId, tx, {
          rol,
          descripcion,
          tareaId,
        });
      },
      { timeout: 15_000 },
    );
  }

  async mover(tareaId: number, datos: MoverTarea, rol: Rol): Promise<ResultadoRecalculo> {
    return this.prisma.$transaction(
      async (tx) => {
        const referencia = await tx.tarea.findUnique({
          where: { id: tareaId },
          select: { proyectoId: true },
        });
        if (!referencia) throw errorTareaNoEncontrada();
        await obtenerProyectoAbierto(tx, referencia.proyectoId, { bloquear: true });
        const tarea = await tx.tarea.findUnique({ where: { id: tareaId } });
        if (!tarea) throw errorTareaNoEncontrada();

        if (datos.padreId !== null && datos.padreId !== tarea.padreId) {
          const padre = await tx.tarea.findFirst({
            where: { id: datos.padreId, proyectoId: tarea.proyectoId },
          });
          if (!padre || !esJerarquiaValida(tarea.nivel, padre.nivel)) {
            throw new ExcepcionApi(
              HttpStatus.UNPROCESSABLE_ENTITY,
              'JERARQUIA_INVALIDA',
              'La jerarquía entre el nivel de la tarea y su nuevo padre no es válida.',
            );
          }
          await this.prepararPadreParaSubtareas(tx, padre, rol);
        } else if (datos.padreId === null && !esJerarquiaValida(tarea.nivel, null)) {
          throw new ExcepcionApi(
            HttpStatus.UNPROCESSABLE_ENTITY,
            'JERARQUIA_INVALIDA',
            'Solo una etapa puede estar en la raíz.',
          );
        }

        const tareasExistentes = await tx.tarea.findMany({
          where: { proyectoId: tarea.proyectoId },
        });
        const arbolMovido = moverEnArbol(tareasExistentes, tareaId, datos.padreId, datos.posicion);

        const nodoMovido = arbolMovido.find((n) => n.id === tareaId);
        const noHuboCambio =
          nodoMovido && nodoMovido.padreId === tarea.padreId && nodoMovido.orden === tarea.orden;

        if (!nodoMovido || noHuboCambio) {
          const hitos = await tx.hito.findMany({ where: { proyectoId: tarea.proyectoId } });
          const calendario = await cargarCalendarioLaboral(tx, tarea.proyectoId);
          return {
            arbol: await this.arbol.cargar(tx, tarea.proyectoId),
            tareasAfectadas: [],
            hitos: construirListaHitos(
              tarea.proyectoId,
              hitos,
              new Map(tareasExistentes.map((t) => [t.id, t])),
              calendario,
              this.reloj.hoy(),
            ),
          };
        }

        for (const nodo of arbolMovido) {
          const original = tareasExistentes.find((t) => t.id === nodo.id);
          if (original && (original.orden !== nodo.orden || original.padreId !== nodo.padreId)) {
            await tx.tarea.update({
              where: { id: nodo.id },
              data: {
                padreId: nodo.padreId,
                orden: nodo.orden,
              },
            });
          }
        }

        const resultado = await this.recalculo.ejecutar(tarea.proyectoId, tx, {
          rol,
          descripcion: `Tarea movida desde ${tarea.codigo} a`,
          tareaId,
        });
        const tareaFinal = resultado.arbol.tareas.find((t) => t.id === tareaId);

        await this.bitacora.registrarCambios(
          tx,
          {
            proyectoId: tarea.proyectoId,
            entidad: 'Tarea',
            entidadId: tareaId,
            rol,
          },
          AccionBitacora.ACTUALIZAR,
          [
            {
              campo: 'ubicacion',
              anterior: {
                codigo: tarea.codigo,
                padreId: tarea.padreId,
                orden: tarea.orden,
              },
              nuevo: {
                codigo: tareaFinal?.codigo ?? tarea.codigo,
                padreId: datos.padreId,
                orden: tareaFinal?.orden ?? nodoMovido.orden,
              },
            },
          ],
        );

        return resultado;
      },
      { timeout: 15_000 },
    );
  }

  async eliminar(tareaId: number, rol: Rol): Promise<ResultadoRecalculo> {
    return this.prisma.$transaction(
      async (tx) => {
        const referencia = await tx.tarea.findUnique({
          where: { id: tareaId },
          select: { proyectoId: true },
        });
        if (!referencia) throw errorTareaNoEncontrada();
        await obtenerProyectoAbierto(tx, referencia.proyectoId, { bloquear: true });
        const tarea = await tx.tarea.findUnique({ where: { id: tareaId } });
        if (!tarea) throw errorTareaNoEncontrada();

        const tareasExistentes = await tx.tarea.findMany({
          where: { proyectoId: tarea.proyectoId },
        });
        const descendientes = contarDescendientes(tareasExistentes, tareaId);
        const subarbolIds = obtenerIdsSubarbol(tareasExistentes, tareaId);
        const hitosDesvinculados = await tx.hito.findMany({
          where: { tareaId: { in: subarbolIds } },
          select: { id: true, tareaId: true },
        });
        const dependenciasEliminadas = await tx.dependencia.count({
          where: {
            OR: [{ predecesoraId: { in: subarbolIds } }, { sucesoraId: { in: subarbolIds } }],
          },
        });

        await tx.tarea.delete({ where: { id: tareaId } });

        const resultado = await this.recalculo.ejecutar(tarea.proyectoId, tx, {
          rol,
          descripcion: `Tarea eliminada: ${tarea.codigo}`,
        });

        await this.bitacora.registrarEliminacion(
          tx,
          {
            proyectoId: tarea.proyectoId,
            entidad: 'Tarea',
            entidadId: tareaId,
            rol,
          },
          {
            codigo: tarea.codigo,
            nombre: tarea.nombre,
            nivel: tarea.nivel,
            descendientes,
            dependenciasEliminadas,
          },
        );

        for (const hito of hitosDesvinculados) {
          const tareaAsociada = tareasExistentes.find((t) => t.id === hito.tareaId);
          await this.bitacora.registrarCambios(
            tx,
            {
              proyectoId: tarea.proyectoId,
              entidad: 'Hito',
              entidadId: hito.id,
              rol,
            },
            AccionBitacora.ACTUALIZAR,
            [
              {
                campo: 'tareaId',
                anterior: tareaAsociada
                  ? { id: tareaAsociada.id, codigo: tareaAsociada.codigo }
                  : null,
                nuevo: null,
              },
            ],
            `Tarea eliminada: ${tarea.codigo}`,
          );
        }

        return resultado;
      },
      { timeout: 15_000 },
    );
  }

  private async prepararPadreParaSubtareas(
    tx: Prisma.TransactionClient,
    padre: Tarea,
    rol: Rol,
  ): Promise<void> {
    const hijas = await tx.tarea.count({ where: { padreId: padre.id } });
    if (hijas > 0) return;
    const dependencias = await tx.dependencia.count({
      where: { OR: [{ predecesoraId: padre.id }, { sucesoraId: padre.id }] },
    });
    if (dependencias > 0) {
      throw new ExcepcionApi(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'JERARQUIA_INVALIDA',
        `La tarea ${padre.codigo} tiene dependencias. Elimínelas antes de agregarle subtareas.`,
        { dependencias },
      );
    }
    if (padre.fechaFija === null) return;
    await tx.tarea.update({ where: { id: padre.id }, data: { fechaFija: null } });
    await this.bitacora.registrarCambios(
      tx,
      { proyectoId: padre.proyectoId, entidad: 'Tarea', entidadId: padre.id, rol },
      AccionBitacora.ACTUALIZAR,
      [{ campo: 'fechaFija', anterior: dateAFechaIso(padre.fechaFija), nuevo: null }],
    );
  }
}
