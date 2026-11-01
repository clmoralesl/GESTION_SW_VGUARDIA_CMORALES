import { HttpStatus, Injectable } from '@nestjs/common';
import {
  AccionBitacora,
  EstadoSolicitud as EstadoSolicitudPrisma,
  Prisma,
  type Tarea,
} from '@prisma/client';
import {
  calcularHorasPlan,
  dateAFechaIso,
  decidir,
  emparejarFilas,
  ErrorTransicion,
  fechaIsoADate,
  insertarEnArbol,
  redondear,
  sumarMontos,
  validarLoteImpactos,
  type EntradaCrearImpacto,
  type EntradaRechazarSolicitud,
  type FilaLineaBaseComparador,
  type MetricasPlan,
  type NodoArbol,
  type ResultadoSimulacion,
  type Rol,
  type TipoImpacto,
} from '@autofix/core';
import { BitacoraService } from '../comun/bitacora/bitacora.service';
import { ExcepcionApi } from '../comun/errores/excepcion-api';
import { Reloj } from '../comun/reloj/reloj';
import { PrismaService } from '../prisma/prisma.service';
import { obtenerProyectoAbierto } from '../proyectos/proyecto-abierto';
import { cargarCalendarioLaboral } from '../calendario/calendario-laboral';
import { cargarDatosVariablesKpi } from '../kpi/datos-variables-kpi';
import { calcularVariablesKpi } from '@autofix/core';
import { RecalculoService } from '../recalculo/recalculo.service';
import { PasoKpi } from '../recalculo/paso-kpi';
import { crearLineaBase } from '../lineas-base/crear-linea-base';

export interface DetalleImpacto {
  id: number;
  solicitudId: number;
  tipo: TipoImpacto;
  tareaId: number | null;
  datos: Record<string, unknown>;
  descripcion: string | null;
  aplicado: boolean;
}

class ReversionSimulacion extends Error {
  constructor(readonly resultado: ResultadoSimulacion) {
    super('reversion-simulacion');
  }
}

export async function resumirPlan(
  tx: Prisma.TransactionClient,
  proyectoId: number,
  reloj: Reloj,
): Promise<{
  metricas: MetricasPlan;
  filas: FilaLineaBaseComparador[];
}> {
  const proyecto = await tx.proyecto.findUniqueOrThrow({ where: { id: proyectoId } });
  const calendario = await cargarCalendarioLaboral(tx, proyectoId);
  const tareas = await tx.tarea.findMany({
    where: { proyectoId },
    orderBy: { codigo: 'asc' },
  });
  const corte = reloj.hoy();
  const datosVariables = await cargarDatosVariablesKpi(tx, proyectoId, calendario, corte, tareas);
  const resultadoVariables = calcularVariablesKpi(datosVariables);
  const valor = (codigo: string) =>
    resultadoVariables.variables.find((v) => v.codigo === codigo)?.valor ?? null;
  const pv = valor('PV');
  const ev = valor('EV');
  const ac = valor('AC');
  const spi = pv !== null && ev !== null && pv > 0 ? redondear(ev / pv, 4) : null;
  const cpi = ac !== null && ev !== null && ac > 0 ? redondear(ev / ac, 4) : null;

  const idsPadres = new Set(tareas.map((t) => t.padreId).filter((id): id is number => id !== null));
  const hojas = tareas.filter((t) => !idsPadres.has(t.id));
  const costoPlanTotal = sumarMontos(hojas.map((t) => Number(t.costoPlan)));

  let fechaFin: string | null = null;
  for (const t of tareas) {
    if (t.finPlan) {
      const fIso = dateAFechaIso(t.finPlan);
      if (!fechaFin || fIso > fechaFin) {
        fechaFin = fIso;
      }
    }
  }

  const filas: FilaLineaBaseComparador[] = tareas.map((t) => ({
    tareaId: t.id,
    codigo: t.codigo,
    nombre: t.nombre,
    nivel: t.nivel,
    duracionDias: t.duracionDias,
    inicioPlan: t.inicioPlan ? dateAFechaIso(t.inicioPlan) : null,
    finPlan: t.finPlan ? dateAFechaIso(t.finPlan) : null,
    costoPlan: Number(t.costoPlan),
  }));

  return {
    metricas: {
      fechaFinProyecto: fechaFin,
      costoPlanTotal,
      presupuesto: Number(proyecto.presupuesto),
      spi,
      cpi,
    },
    filas,
  };
}

@Injectable()
export class CambioAplicadorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recalculo: RecalculoService,
    private readonly bitacora: BitacoraService,
    private readonly reloj: Reloj,
    private readonly pasoKpi: PasoKpi,
  ) {}

  private mapearImpacto(impacto: {
    id: number;
    solicitudId: number;
    tipo: TipoImpacto;
    tareaId: number | null;
    datos: Prisma.JsonValue;
    descripcion: string | null;
    aplicado: boolean;
  }): DetalleImpacto {
    return {
      id: impacto.id,
      solicitudId: impacto.solicitudId,
      tipo: impacto.tipo,
      tareaId: impacto.tareaId,
      datos: (impacto.datos as Record<string, unknown>) ?? {},
      descripcion: impacto.descripcion,
      aplicado: impacto.aplicado,
    };
  }

  async listarImpactos(solicitudId: number): Promise<DetalleImpacto[]> {
    const solicitud = await this.prisma.solicitudCambio.findUnique({
      where: { id: solicitudId },
      select: { id: true },
    });
    if (!solicitud) {
      throw new ExcepcionApi(
        HttpStatus.NOT_FOUND,
        'REGISTRO_NO_ENCONTRADO',
        'La solicitud de cambio no existe.',
      );
    }
    const impactos = await this.prisma.impactoCambio.findMany({
      where: { solicitudId },
      orderBy: { id: 'asc' },
    });
    return impactos.map((i) => this.mapearImpacto(i));
  }

  async crearImpacto(
    solicitudId: number,
    datos: EntradaCrearImpacto,
    rol: Rol,
  ): Promise<DetalleImpacto> {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM solicitudes_cambio WHERE id = ${solicitudId} FOR UPDATE`;
        const solicitud = await tx.solicitudCambio.findUnique({
          where: { id: solicitudId },
          include: {
            etapas: { orderBy: { numero: 'asc' } },
            impactos: { orderBy: { id: 'asc' } },
          },
        });
        if (!solicitud) {
          throw new ExcepcionApi(
            HttpStatus.NOT_FOUND,
            'REGISTRO_NO_ENCONTRADO',
            'La solicitud de cambio no existe.',
          );
        }

        await obtenerProyectoAbierto(tx, solicitud.proyectoId, { bloquear: true });

        if (solicitud.estado !== 'REGISTRADA' && solicitud.estado !== 'EN_EVALUACION') {
          throw new ExcepcionApi(
            HttpStatus.CONFLICT,
            'TRANSICION_INVALIDA',
            'Solo se pueden registrar impactos en solicitudes en estado REGISTRADA o EN_EVALUACION.',
          );
        }

        const etapa3 = solicitud.etapas.find((e) => e.numero === 3);
        if (etapa3 && etapa3.estado === 'COMPLETADA') {
          throw new ExcepcionApi(
            HttpStatus.CONFLICT,
            'TRANSICION_INVALIDA',
            'No se pueden registrar impactos cuando la etapa 3 ya está completada.',
          );
        }

        if (solicitud.impactos.length >= 50) {
          throw new ExcepcionApi(
            HttpStatus.CONFLICT,
            'CONFLICTO',
            'Se ha alcanzado el límite máximo de 50 impactos por solicitud.',
          );
        }

        if (datos.tipo === 'DURACION') {
          const tarea = await tx.tarea.findFirst({
            where: { id: datos.tareaId, proyectoId: solicitud.proyectoId },
          });
          if (!tarea) {
            throw new ExcepcionApi(
              HttpStatus.NOT_FOUND,
              'REGISTRO_NO_ENCONTRADO',
              'La tarea indicada no existe en el proyecto.',
            );
          }
          const hijas = await tx.tarea.count({ where: { padreId: datos.tareaId } });
          if (hijas > 0) {
            throw new ExcepcionApi(
              HttpStatus.CONFLICT,
              'TAREA_NO_HOJA',
              'No se puede modificar la duración de una tarea con subtareas.',
            );
          }
        } else if (datos.tipo === 'ASIGNACION') {
          const tarea = await tx.tarea.findFirst({
            where: { id: datos.tareaId, proyectoId: solicitud.proyectoId },
          });
          if (!tarea) {
            throw new ExcepcionApi(
              HttpStatus.NOT_FOUND,
              'REGISTRO_NO_ENCONTRADO',
              'La tarea indicada no existe en el proyecto.',
            );
          }
          const hijas = await tx.tarea.count({ where: { padreId: datos.tareaId } });
          if (hijas > 0) {
            throw new ExcepcionApi(
              HttpStatus.CONFLICT,
              'TAREA_NO_HOJA',
              'No se pueden realizar asignaciones en una tarea con subtareas.',
            );
          }
          if (datos.elemento === 'PROFESIONAL') {
            const prof = await tx.profesional.findUnique({
              where: { id: datos.profesionalId },
            });
            if (!prof) {
              throw new ExcepcionApi(
                HttpStatus.NOT_FOUND,
                'REGISTRO_NO_ENCONTRADO',
                'El profesional indicado no existe.',
              );
            }
            if (datos.operacion === 'agregar' && !prof.activo) {
              throw new ExcepcionApi(
                HttpStatus.CONFLICT,
                'PROFESIONAL_INACTIVO',
                'No se puede asignar un profesional inactivo.',
              );
            }
          } else {
            const rec = await tx.recurso.findUnique({
              where: { id: datos.recursoId },
            });
            if (!rec) {
              throw new ExcepcionApi(
                HttpStatus.NOT_FOUND,
                'REGISTRO_NO_ENCONTRADO',
                'El recurso indicado no existe.',
              );
            }
            if (datos.operacion === 'agregar' && !rec.activo) {
              throw new ExcepcionApi(
                HttpStatus.CONFLICT,
                'RECURSO_INACTIVO',
                'No se puede asignar un recurso inactivo.',
              );
            }
          }
        } else if (datos.tipo === 'NUEVA_TAREA') {
          if (datos.padreId) {
            const padre = await tx.tarea.findFirst({
              where: { id: datos.padreId, proyectoId: solicitud.proyectoId },
            });
            if (!padre) {
              throw new ExcepcionApi(
                HttpStatus.NOT_FOUND,
                'REGISTRO_NO_ENCONTRADO',
                'La tarea padre indicada no existe en el proyecto.',
              );
            }
            if (padre.nivel === 'SUBACTIVIDAD') {
              throw new ExcepcionApi(
                HttpStatus.UNPROCESSABLE_ENTITY,
                'JERARQUIA_INVALIDA',
                'Una subactividad no puede tener subtareas.',
              );
            }
            const asignaciones = await tx.asignacion.count({ where: { tareaId: padre.id } });
            if (asignaciones > 0) {
              throw new ExcepcionApi(
                HttpStatus.CONFLICT,
                'TAREA_CON_ASIGNACIONES',
                'No se pueden crear subtareas bajo una tarea con asignaciones.',
              );
            }
          }
          for (const pred of datos.predecesoras ?? []) {
            if (pred.tareaId !== undefined) {
              const tPred = await tx.tarea.findFirst({
                where: { id: pred.tareaId, proyectoId: solicitud.proyectoId },
              });
              if (!tPred) {
                throw new ExcepcionApi(
                  HttpStatus.NOT_FOUND,
                  'REGISTRO_NO_ENCONTRADO',
                  'La tarea predecesora no existe en el proyecto.',
                );
              }
              const hijas = await tx.tarea.count({ where: { padreId: pred.tareaId } });
              if (hijas > 0) {
                throw new ExcepcionApi(
                  HttpStatus.UNPROCESSABLE_ENTITY,
                  'DEPENDENCIA_INVALIDA',
                  'Las dependencias solo se admiten hacia tareas sin subtareas.',
                );
              }
            }
          }
        }

        const loteExistente: EntradaCrearImpacto[] = solicitud.impactos.map((imp) => {
          const raw = (imp.datos as Record<string, unknown>) ?? {};
          return {
            tipo: imp.tipo,
            descripcion: imp.descripcion ?? undefined,
            tareaId: imp.tareaId ?? undefined,
            ...raw,
          } as EntradaCrearImpacto;
        });

        const errores = validarLoteImpactos([...loteExistente, datos]);
        if (errores.length > 0) {
          const err = errores[0];
          throw new ExcepcionApi(
            HttpStatus.CONFLICT,
            'IMPACTO_INVALIDO',
            err ? err.mensaje : 'Conflicto en el lote de impactos.',
            errores,
          );
        }

        const { tipo, descripcion, ...resto } = datos;
        const tareaId =
          'tareaId' in datos && typeof datos.tareaId === 'number' ? datos.tareaId : null;

        const creado = await tx.impactoCambio.create({
          data: {
            solicitudId,
            tipo,
            tareaId,
            descripcion: descripcion ?? null,
            datos: resto as Prisma.InputJsonValue,
            aplicado: false,
          },
        });

        await this.bitacora.registrarCreacion(
          tx,
          {
            proyectoId: solicitud.proyectoId,
            entidad: 'ImpactoCambio',
            entidadId: creado.id,
            rol,
            solicitudCambioId: solicitudId,
          },
          {
            tipo: creado.tipo,
            tareaId: creado.tareaId,
            descripcion: creado.descripcion,
          },
        );

        return this.mapearImpacto(creado);
      },
      { timeout: 15_000 },
    );
  }

  async eliminarImpacto(impactoId: number, rol: Rol): Promise<void> {
    return this.prisma.$transaction(
      async (tx) => {
        const impacto = await tx.impactoCambio.findUnique({
          where: { id: impactoId },
          include: {
            solicitud: {
              include: {
                etapas: { orderBy: { numero: 'asc' } },
                impactos: { orderBy: { id: 'asc' } },
              },
            },
          },
        });
        if (!impacto) {
          throw new ExcepcionApi(
            HttpStatus.NOT_FOUND,
            'REGISTRO_NO_ENCONTRADO',
            'El impacto no existe.',
          );
        }

        await tx.$queryRaw`SELECT id FROM solicitudes_cambio WHERE id = ${impacto.solicitudId} FOR UPDATE`;
        await obtenerProyectoAbierto(tx, impacto.solicitud.proyectoId, { bloquear: true });

        if (
          impacto.solicitud.estado !== 'REGISTRADA' &&
          impacto.solicitud.estado !== 'EN_EVALUACION'
        ) {
          throw new ExcepcionApi(
            HttpStatus.CONFLICT,
            'TRANSICION_INVALIDA',
            'Solo se pueden eliminar impactos en solicitudes en estado REGISTRADA o EN_EVALUACION.',
          );
        }

        const etapa3 = impacto.solicitud.etapas.find((e) => e.numero === 3);
        if (etapa3 && etapa3.estado === 'COMPLETADA') {
          throw new ExcepcionApi(
            HttpStatus.CONFLICT,
            'TRANSICION_INVALIDA',
            'No se pueden eliminar impactos cuando la etapa 3 ya está completada.',
          );
        }

        const restantes = impacto.solicitud.impactos.filter((i) => i.id !== impactoId);
        const loteRestante: EntradaCrearImpacto[] = restantes.map((imp) => {
          const raw = (imp.datos as Record<string, unknown>) ?? {};
          return {
            tipo: imp.tipo,
            descripcion: imp.descripcion ?? undefined,
            tareaId: imp.tareaId ?? undefined,
            ...raw,
          } as EntradaCrearImpacto;
        });

        const errores = validarLoteImpactos(loteRestante);
        if (errores.length > 0) {
          const err = errores[0];
          throw new ExcepcionApi(
            HttpStatus.CONFLICT,
            'CONFLICTO',
            err ? err.mensaje : 'Eliminar este impacto genera un conflicto en el resto del lote.',
            errores,
          );
        }

        await tx.impactoCambio.delete({ where: { id: impactoId } });

        await this.bitacora.registrarEliminacion(
          tx,
          {
            proyectoId: impacto.solicitud.proyectoId,
            entidad: 'ImpactoCambio',
            entidadId: impacto.id,
            rol,
            solicitudCambioId: impacto.solicitudId,
          },
          {
            tipo: impacto.tipo,
            tareaId: impacto.tareaId,
            descripcion: impacto.descripcion,
          },
        );
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

  async aplicarCambio(
    tx: Prisma.TransactionClient,
    solicitudId: number,
    rol: Rol,
    opciones?: { simulacion?: boolean },
  ): Promise<ResultadoSimulacion> {
    await tx.$queryRaw`SELECT id FROM solicitudes_cambio WHERE id = ${solicitudId} FOR UPDATE`;
    const solicitud = await tx.solicitudCambio.findUnique({
      where: { id: solicitudId },
      include: {
        etapas: { orderBy: { numero: 'asc' } },
        impactos: { orderBy: { id: 'asc' } },
      },
    });
    if (!solicitud) {
      throw new ExcepcionApi(
        HttpStatus.NOT_FOUND,
        'REGISTRO_NO_ENCONTRADO',
        'La solicitud de cambio no existe.',
      );
    }

    try {
      decidir(
        {
          estado: solicitud.estado,
          etapaActual: solicitud.etapaActual,
          etapas: solicitud.etapas.map((e) => ({
            numero: e.numero,
            estado: e.estado,
            porcentajeAdopcion: e.porcentajeAdopcion ? Number(e.porcentajeAdopcion) : null,
          })),
        },
        'aprobar',
        { simulacion: opciones?.simulacion },
      );
    } catch (e) {
      if (e instanceof ErrorTransicion) {
        throw new ExcepcionApi(
          HttpStatus.CONFLICT,
          'TRANSICION_INVALIDA',
          e.motivo === 'ETAPA_3_PENDIENTE'
            ? 'Para aprobar una solicitud la etapa 3 debe estar completada.'
            : 'El estado de la solicitud no permite esta operación.',
          e.detalles,
        );
      }
      throw e;
    }

    await obtenerProyectoAbierto(tx, solicitud.proyectoId, { bloquear: true });

    const antes = await resumirPlan(tx, solicitud.proyectoId, this.reloj);

    if (solicitud.impactos.length === 0) {
      const hoy = this.reloj.hoy();
      const fechaDecision = fechaIsoADate(hoy);
      const antesSol = { estado: solicitud.estado, fechaDecision: solicitud.fechaDecision };

      await tx.solicitudCambio.update({
        where: { id: solicitudId },
        data: {
          estado: EstadoSolicitudPrisma.APROBADA,
          fechaDecision,
        },
      });

      const cambiosSol = [
        { campo: 'estado', anterior: antesSol.estado, nuevo: 'APROBADA' },
        {
          campo: 'fechaDecision',
          anterior: antesSol.fechaDecision ? dateAFechaIso(antesSol.fechaDecision) : null,
          nuevo: hoy,
        },
      ];

      await this.bitacora.registrarCambios(
        tx,
        {
          proyectoId: solicitud.proyectoId,
          entidad: 'SolicitudCambio',
          entidadId: solicitudId,
          rol,
          solicitudCambioId: solicitud.id,
        },
        AccionBitacora.APROBAR,
        cambiosSol,
      );

      const despues = await resumirPlan(tx, solicitud.proyectoId, this.reloj);
      return {
        solicitudId,
        antes: antes.metricas,
        despues: despues.metricas,
        tareasAfectadas: [],
      };
    }

    const countLB = await tx.lineaBase.count({ where: { proyectoId: solicitud.proyectoId } });
    if (countLB === 0) {
      await crearLineaBase(
        tx,
        solicitud.proyectoId,
        { descripcion: 'Línea base inicial', rol, solicitudCambioId: null },
        this.bitacora,
      );
    }

    for (const imp of solicitud.impactos) {
      if (imp.tipo === 'DURACION' || imp.tipo === 'ASIGNACION') {
        if (imp.tareaId === null) {
          throw new ExcepcionApi(
            HttpStatus.CONFLICT,
            'IMPACTO_INVALIDO',
            'La tarea asociada al impacto fue eliminada.',
            { impactoId: imp.id },
          );
        }
        const tarea = await tx.tarea.findFirst({
          where: { id: imp.tareaId, proyectoId: solicitud.proyectoId },
        });
        if (!tarea) {
          throw new ExcepcionApi(
            HttpStatus.CONFLICT,
            'IMPACTO_INVALIDO',
            'La tarea asociada al impacto ya no existe en el proyecto.',
            { impactoId: imp.id },
          );
        }
      }
    }

    const loteParaValidar: EntradaCrearImpacto[] = solicitud.impactos.map((imp) => {
      const raw = (imp.datos as Record<string, unknown>) ?? {};
      return {
        tipo: imp.tipo,
        descripcion: imp.descripcion ?? undefined,
        tareaId: imp.tareaId ?? undefined,
        ...raw,
      } as EntradaCrearImpacto;
    });

    const erroresLote = validarLoteImpactos(loteParaValidar);
    if (erroresLote.length > 0) {
      const err = erroresLote[0];
      throw new ExcepcionApi(
        HttpStatus.CONFLICT,
        'IMPACTO_INVALIDO',
        err ? err.mensaje : 'Conflicto en el lote de impactos.',
        erroresLote,
      );
    }

    const impactosPresupuesto = solicitud.impactos.filter((i) => i.tipo === 'PRESUPUESTO');
    for (const imp of impactosPresupuesto) {
      const datos = imp.datos as { presupuesto: number };
      const proyectoAntes = await tx.proyecto.findUniqueOrThrow({
        where: { id: solicitud.proyectoId },
      });
      await tx.proyecto.update({
        where: { id: solicitud.proyectoId },
        data: { presupuesto: datos.presupuesto },
      });
      await this.bitacora.registrarCambios(
        tx,
        {
          proyectoId: solicitud.proyectoId,
          entidad: 'Proyecto',
          entidadId: solicitud.proyectoId,
          rol,
          solicitudCambioId: solicitud.id,
        },
        AccionBitacora.ACTUALIZAR,
        [
          {
            campo: 'presupuesto',
            anterior: Number(proyectoAntes.presupuesto),
            nuevo: datos.presupuesto,
          },
        ],
      );
    }

    const impactosNuevaTarea = solicitud.impactos.filter((i) => i.tipo === 'NUEVA_TAREA');
    const mapaClaveId = new Map<string, number>();

    for (const imp of impactosNuevaTarea) {
      const datos = imp.datos as {
        clave: string;
        padreId?: number | null;
        nombre: string;
        duracionDias: number;
        predecesoras?: Array<{
          tareaId?: number;
          clave?: string;
          tipo?: 'FS' | 'SS' | 'FF' | 'SF';
          desfaseDias?: number;
        }>;
      };

      let nivel: 'ETAPA' | 'ACTIVIDAD' | 'SUBACTIVIDAD' = 'ETAPA';
      if (datos.padreId) {
        const padre = await tx.tarea.findUniqueOrThrow({ where: { id: datos.padreId } });
        if (padre.nivel === 'SUBACTIVIDAD') {
          throw new ExcepcionApi(
            HttpStatus.UNPROCESSABLE_ENTITY,
            'JERARQUIA_INVALIDA',
            'Una subactividad no puede tener subtareas.',
          );
        }
        nivel = padre.nivel === 'ETAPA' ? 'ACTIVIDAD' : 'SUBACTIVIDAD';

        const asigs = await tx.asignacion.count({ where: { tareaId: padre.id } });
        if (asigs > 0) {
          throw new ExcepcionApi(
            HttpStatus.CONFLICT,
            'TAREA_CON_ASIGNACIONES',
            'No se pueden crear subtareas bajo una tarea con asignaciones.',
          );
        }
        await this.prepararPadreParaSubtareas(tx, padre, rol);
      }

      const tareasExistentes = await tx.tarea.findMany({
        where: { proyectoId: solicitud.proyectoId },
      });
      const nodosArbol: NodoArbol[] = tareasExistentes.map((t) => ({
        id: t.id,
        padreId: t.padreId,
        orden: t.orden,
      }));
      const arbolConNuevo = insertarEnArbol(nodosArbol, {
        id: 0,
        padreId: datos.padreId ?? null,
        orden: 0,
      });
      const ordenCalculado = arbolConNuevo.find((n) => n.id === 0)?.orden ?? 1;

      for (const nodo of arbolConNuevo) {
        if (nodo.id !== 0) {
          const orig = tareasExistentes.find((t) => t.id === nodo.id);
          if (orig && orig.orden !== nodo.orden) {
            await tx.tarea.update({
              where: { id: nodo.id },
              data: { orden: nodo.orden },
            });
          }
        }
      }

      const creada = await tx.tarea.create({
        data: {
          proyectoId: solicitud.proyectoId,
          padreId: datos.padreId ?? null,
          nivel,
          codigo: `~nueva-${Date.now()}-${datos.clave}`,
          orden: ordenCalculado,
          nombre: datos.nombre,
          duracionDias: datos.duracionDias,
          porcentajeAvance: 0,
          costoPlan: 0,
          costoReal: 0,
        },
      });

      mapaClaveId.set(datos.clave, creada.id);

      await this.bitacora.registrarCreacion(
        tx,
        {
          proyectoId: solicitud.proyectoId,
          entidad: 'Tarea',
          entidadId: creada.id,
          rol,
          solicitudCambioId: solicitud.id,
        },
        {
          codigo: creada.codigo,
          nombre: creada.nombre,
          nivel: creada.nivel,
        },
      );
    }

    for (const imp of impactosNuevaTarea) {
      const datos = imp.datos as {
        clave: string;
        predecesoras?: Array<{
          tareaId?: number;
          clave?: string;
          tipo?: 'FS' | 'SS' | 'FF' | 'SF';
          desfaseDias?: number;
        }>;
      };
      const sucesoraId = mapaClaveId.get(datos.clave);
      if (!sucesoraId) continue;

      for (const pred of datos.predecesoras ?? []) {
        let predecesoraId: number | undefined;
        if (pred.tareaId !== undefined) {
          predecesoraId = pred.tareaId;
        } else if (pred.clave) {
          predecesoraId = mapaClaveId.get(pred.clave);
        }

        if (!predecesoraId) {
          throw new ExcepcionApi(
            HttpStatus.CONFLICT,
            'IMPACTO_INVALIDO',
            'Predecesora no encontrada en el lote.',
          );
        }

        const dep = await tx.dependencia.create({
          data: {
            proyectoId: solicitud.proyectoId,
            predecesoraId,
            sucesoraId,
            tipo: pred.tipo ?? 'FS',
            desfaseDias: pred.desfaseDias ?? 0,
          },
        });

        await this.bitacora.registrarCreacion(
          tx,
          {
            proyectoId: solicitud.proyectoId,
            entidad: 'Dependencia',
            entidadId: dep.id,
            rol,
            solicitudCambioId: solicitud.id,
          },
          {
            predecesoraId: dep.predecesoraId,
            sucesoraId: dep.sucesoraId,
            tipo: dep.tipo,
          },
        );
      }
    }

    const impactosDuracion = solicitud.impactos.filter((i) => i.tipo === 'DURACION');
    for (const imp of impactosDuracion) {
      const datos = imp.datos as { duracionDias: number };
      const hijas = await tx.tarea.count({ where: { padreId: imp.tareaId! } });
      if (hijas > 0) {
        throw new ExcepcionApi(
          HttpStatus.CONFLICT,
          'TAREA_NO_HOJA',
          'No se puede modificar la duración de una tarea con subtareas.',
        );
      }
      const tareaAntes = await tx.tarea.findUniqueOrThrow({ where: { id: imp.tareaId! } });
      await tx.tarea.update({
        where: { id: imp.tareaId! },
        data: { duracionDias: datos.duracionDias },
      });
      await this.bitacora.registrarCambios(
        tx,
        {
          proyectoId: solicitud.proyectoId,
          entidad: 'Tarea',
          entidadId: imp.tareaId!,
          rol,
          solicitudCambioId: solicitud.id,
        },
        AccionBitacora.ACTUALIZAR,
        [{ campo: 'duracionDias', anterior: tareaAntes.duracionDias, nuevo: datos.duracionDias }],
      );
    }

    const impactosAsignacion = solicitud.impactos.filter((i) => i.tipo === 'ASIGNACION');
    for (const imp of impactosAsignacion) {
      const datos = imp.datos as {
        operacion: 'agregar' | 'modificar' | 'quitar';
        elemento: 'PROFESIONAL' | 'RECURSO';
        profesionalId?: number;
        recursoId?: number;
        dedicacion?: number;
        horasPlan?: number | null;
        tarifaAplicada?: number | null;
        cantidadPlan?: number;
        costoUnitarioAplicado?: number | null;
      };

      const hijas = await tx.tarea.count({ where: { padreId: imp.tareaId! } });
      if (hijas > 0) {
        throw new ExcepcionApi(
          HttpStatus.CONFLICT,
          'TAREA_NO_HOJA',
          'No se pueden realizar asignaciones a tareas con subtareas.',
        );
      }

      if (datos.operacion === 'agregar') {
        if (datos.elemento === 'PROFESIONAL') {
          const prof = await tx.profesional.findUnique({ where: { id: datos.profesionalId! } });
          if (!prof) {
            throw new ExcepcionApi(
              HttpStatus.NOT_FOUND,
              'REGISTRO_NO_ENCONTRADO',
              'El profesional no existe.',
            );
          }
          if (!prof.activo) {
            throw new ExcepcionApi(
              HttpStatus.CONFLICT,
              'PROFESIONAL_INACTIVO',
              'El profesional está inactivo.',
            );
          }
          const existe = await tx.asignacion.findUnique({
            where: {
              tareaId_profesionalId: { tareaId: imp.tareaId!, profesionalId: prof.id },
            },
          });
          if (existe) {
            throw new ExcepcionApi(
              HttpStatus.CONFLICT,
              'ASIGNACION_DUPLICADA',
              'El profesional ya está asignado a la tarea.',
            );
          }
          const tarea = await tx.tarea.findUniqueOrThrow({ where: { id: imp.tareaId! } });
          const horas =
            datos.horasPlan ??
            calcularHorasPlan(
              tarea.duracionDias,
              datos.dedicacion ?? 100,
              Number(prof.horasDiarias),
            );

          const creada = await tx.asignacion.create({
            data: {
              tareaId: imp.tareaId!,
              profesionalId: prof.id,
              dedicacion: datos.dedicacion ?? null,
              horasPlan: horas,
              horasPlanManual: datos.horasPlan !== undefined && datos.horasPlan !== null,
              tarifaAplicada: datos.tarifaAplicada ?? prof.tarifaHora,
            },
          });

          await this.bitacora.registrarCreacion(
            tx,
            {
              proyectoId: solicitud.proyectoId,
              entidad: 'Asignacion',
              entidadId: creada.id,
              rol,
              solicitudCambioId: solicitud.id,
            },
            {
              tareaId: imp.tareaId!,
              profesionalId: prof.id,
              dedicacion: creada.dedicacion ? Number(creada.dedicacion) : null,
            },
          );
        } else {
          const rec = await tx.recurso.findUnique({ where: { id: datos.recursoId! } });
          if (!rec) {
            throw new ExcepcionApi(
              HttpStatus.NOT_FOUND,
              'REGISTRO_NO_ENCONTRADO',
              'El recurso no existe.',
            );
          }
          if (!rec.activo) {
            throw new ExcepcionApi(
              HttpStatus.CONFLICT,
              'RECURSO_INACTIVO',
              'El recurso está inactivo.',
            );
          }
          const existe = await tx.asignacion.findUnique({
            where: {
              tareaId_recursoId: { tareaId: imp.tareaId!, recursoId: rec.id },
            },
          });
          if (existe) {
            throw new ExcepcionApi(
              HttpStatus.CONFLICT,
              'ASIGNACION_DUPLICADA',
              'El recurso ya está asignado a la tarea.',
            );
          }

          const creada = await tx.asignacion.create({
            data: {
              tareaId: imp.tareaId!,
              recursoId: rec.id,
              cantidadPlan: datos.cantidadPlan!,
              costoUnitarioAplicado: datos.costoUnitarioAplicado ?? rec.costoUnitario,
            },
          });

          await this.bitacora.registrarCreacion(
            tx,
            {
              proyectoId: solicitud.proyectoId,
              entidad: 'Asignacion',
              entidadId: creada.id,
              rol,
              solicitudCambioId: solicitud.id,
            },
            {
              tareaId: imp.tareaId!,
              recursoId: rec.id,
              cantidadPlan: Number(creada.cantidadPlan),
            },
          );
        }
      } else if (datos.operacion === 'modificar') {
        if (datos.elemento === 'PROFESIONAL') {
          const asig = await tx.asignacion.findUnique({
            where: {
              tareaId_profesionalId: { tareaId: imp.tareaId!, profesionalId: datos.profesionalId! },
            },
          });
          if (!asig) {
            throw new ExcepcionApi(
              HttpStatus.CONFLICT,
              'IMPACTO_INVALIDO',
              'La asignación a modificar no existe.',
            );
          }
          const dataMod: Prisma.AsignacionUpdateInput = {};
          if (datos.dedicacion !== undefined) dataMod.dedicacion = datos.dedicacion;
          if (datos.horasPlan !== undefined) {
            dataMod.horasPlan = datos.horasPlan;
            dataMod.horasPlanManual = true;
          }
          if (datos.tarifaAplicada !== undefined) dataMod.tarifaAplicada = datos.tarifaAplicada;

          const act = await tx.asignacion.update({ where: { id: asig.id }, data: dataMod });

          await this.bitacora.registrarCambios(
            tx,
            {
              proyectoId: solicitud.proyectoId,
              entidad: 'Asignacion',
              entidadId: asig.id,
              rol,
              solicitudCambioId: solicitud.id,
            },
            AccionBitacora.ACTUALIZAR,
            [
              {
                campo: 'dedicacion',
                anterior: asig.dedicacion ? Number(asig.dedicacion) : null,
                nuevo: act.dedicacion ? Number(act.dedicacion) : null,
              },
            ],
          );
        } else {
          const asig = await tx.asignacion.findUnique({
            where: {
              tareaId_recursoId: { tareaId: imp.tareaId!, recursoId: datos.recursoId! },
            },
          });
          if (!asig) {
            throw new ExcepcionApi(
              HttpStatus.CONFLICT,
              'IMPACTO_INVALIDO',
              'La asignación a modificar no existe.',
            );
          }
          const dataMod: Prisma.AsignacionUpdateInput = {};
          if (datos.cantidadPlan !== undefined) dataMod.cantidadPlan = datos.cantidadPlan;
          if (datos.costoUnitarioAplicado !== undefined) {
            dataMod.costoUnitarioAplicado = datos.costoUnitarioAplicado;
          }

          const act = await tx.asignacion.update({ where: { id: asig.id }, data: dataMod });

          await this.bitacora.registrarCambios(
            tx,
            {
              proyectoId: solicitud.proyectoId,
              entidad: 'Asignacion',
              entidadId: asig.id,
              rol,
              solicitudCambioId: solicitud.id,
            },
            AccionBitacora.ACTUALIZAR,
            [
              {
                campo: 'cantidadPlan',
                anterior: asig.cantidadPlan ? Number(asig.cantidadPlan) : null,
                nuevo: act.cantidadPlan ? Number(act.cantidadPlan) : null,
              },
            ],
          );
        }
      } else if (datos.operacion === 'quitar') {
        if (datos.elemento === 'PROFESIONAL') {
          const asig = await tx.asignacion.findUnique({
            where: {
              tareaId_profesionalId: { tareaId: imp.tareaId!, profesionalId: datos.profesionalId! },
            },
          });
          if (!asig) {
            throw new ExcepcionApi(
              HttpStatus.CONFLICT,
              'IMPACTO_INVALIDO',
              'La asignación a eliminar no existe.',
            );
          }
          await tx.asignacion.delete({ where: { id: asig.id } });

          await this.bitacora.registrarEliminacion(
            tx,
            {
              proyectoId: solicitud.proyectoId,
              entidad: 'Asignacion',
              entidadId: asig.id,
              rol,
              solicitudCambioId: solicitud.id,
            },
            {
              tareaId: imp.tareaId!,
              profesionalId: datos.profesionalId ?? null,
            },
          );
        } else {
          const asig = await tx.asignacion.findUnique({
            where: {
              tareaId_recursoId: { tareaId: imp.tareaId!, recursoId: datos.recursoId! },
            },
          });
          if (!asig) {
            throw new ExcepcionApi(
              HttpStatus.CONFLICT,
              'IMPACTO_INVALIDO',
              'La asignación a eliminar no existe.',
            );
          }
          await tx.asignacion.delete({ where: { id: asig.id } });

          await this.bitacora.registrarEliminacion(
            tx,
            {
              proyectoId: solicitud.proyectoId,
              entidad: 'Asignacion',
              entidadId: asig.id,
              rol,
              solicitudCambioId: solicitud.id,
            },
            {
              tareaId: imp.tareaId!,
              recursoId: datos.recursoId ?? null,
            },
          );
        }
      }
    }

    await this.recalculo.ejecutar(
      solicitud.proyectoId,
      tx,
      {
        rol,
        descripcion: `Aprobación de solicitud de cambio ${solicitud.codigo}`,
        solicitudCambioId: solicitud.id,
      },
      {
        antesDeKpi: async () => {
          await crearLineaBase(
            tx,
            solicitud.proyectoId,
            {
              descripcion: `Aprobación de cambio ${solicitud.codigo}`,
              solicitudCambioId: solicitud.id,
              rol,
            },
            this.bitacora,
          );
        },
      },
    );

    await tx.impactoCambio.updateMany({
      where: { solicitudId },
      data: { aplicado: true },
    });

    const hoy = this.reloj.hoy();
    const fechaDecision = fechaIsoADate(hoy);
    const antesSol = { estado: solicitud.estado, fechaDecision: solicitud.fechaDecision };

    await tx.solicitudCambio.update({
      where: { id: solicitudId },
      data: {
        estado: EstadoSolicitudPrisma.APROBADA,
        fechaDecision,
      },
    });

    const cambiosSol = [
      { campo: 'estado', anterior: antesSol.estado, nuevo: 'APROBADA' },
      {
        campo: 'fechaDecision',
        anterior: antesSol.fechaDecision ? dateAFechaIso(antesSol.fechaDecision) : null,
        nuevo: hoy,
      },
    ];

    await this.bitacora.registrarCambios(
      tx,
      {
        proyectoId: solicitud.proyectoId,
        entidad: 'SolicitudCambio',
        entidadId: solicitudId,
        rol,
        solicitudCambioId: solicitud.id,
      },
      AccionBitacora.APROBAR,
      cambiosSol,
    );

    const despues = await resumirPlan(tx, solicitud.proyectoId, this.reloj);
    const tareasAfectadas = emparejarFilas(antes.filas, despues.filas).filter(
      (f) => f.estado !== 'IGUAL',
    );

    return {
      solicitudId,
      antes: antes.metricas,
      despues: despues.metricas,
      tareasAfectadas,
    };
  }

  async simular(solicitudId: number, rol: Rol): Promise<ResultadoSimulacion> {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const resultado = await this.aplicarCambio(tx, solicitudId, rol, { simulacion: true });
          throw new ReversionSimulacion(resultado);
        },
        { timeout: 15_000 },
      );
    } catch (e) {
      if (e instanceof ReversionSimulacion) {
        return e.resultado;
      }
      throw e;
    }
  }

  async aprobar(solicitudId: number, rol: Rol): Promise<ResultadoSimulacion> {
    return this.prisma.$transaction(
      async (tx) => {
        return this.aplicarCambio(tx, solicitudId, rol, { simulacion: false });
      },
      { timeout: 15_000 },
    );
  }

  async rechazar(solicitudId: number, datos: EntradaRechazarSolicitud, rol: Rol) {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM solicitudes_cambio WHERE id = ${solicitudId} FOR UPDATE`;
        const solicitud = await tx.solicitudCambio.findUnique({
          where: { id: solicitudId },
          include: { etapas: { orderBy: { numero: 'asc' } } },
        });
        if (!solicitud) {
          throw new ExcepcionApi(
            HttpStatus.NOT_FOUND,
            'REGISTRO_NO_ENCONTRADO',
            'La solicitud de cambio no existe.',
          );
        }

        await obtenerProyectoAbierto(tx, solicitud.proyectoId, { bloquear: true });

        try {
          decidir(
            {
              estado: solicitud.estado,
              etapaActual: solicitud.etapaActual,
              etapas: solicitud.etapas.map((e) => ({
                numero: e.numero,
                estado: e.estado,
                porcentajeAdopcion: e.porcentajeAdopcion ? Number(e.porcentajeAdopcion) : null,
              })),
            },
            'rechazar',
          );
        } catch (e) {
          if (e instanceof ErrorTransicion) {
            throw new ExcepcionApi(
              HttpStatus.CONFLICT,
              'TRANSICION_INVALIDA',
              e.motivo === 'ETAPA_3_PENDIENTE'
                ? 'Para rechazar una solicitud la etapa 3 debe estar completada.'
                : 'El estado de la solicitud no permite rechazarla.',
              e.detalles,
            );
          }
          throw e;
        }

        const hoy = this.reloj.hoy();
        const fechaDecision = fechaIsoADate(hoy);
        const antesSol = {
          estado: solicitud.estado,
          motivoRechazo: solicitud.motivoRechazo,
          fechaDecision: solicitud.fechaDecision,
        };

        const actualizada = await tx.solicitudCambio.update({
          where: { id: solicitudId },
          data: {
            estado: EstadoSolicitudPrisma.RECHAZADA,
            motivoRechazo: datos.motivo,
            fechaDecision,
          },
          include: {
            etapas: {
              orderBy: { numero: 'asc' },
              include: {
                evidencias: { orderBy: { subidoEn: 'asc' } },
                acciones: { orderBy: { id: 'asc' } },
              },
            },
          },
        });

        const cambios = [
          { campo: 'estado', anterior: antesSol.estado, nuevo: 'RECHAZADA' },
          { campo: 'motivoRechazo', anterior: antesSol.motivoRechazo, nuevo: datos.motivo },
          {
            campo: 'fechaDecision',
            anterior: antesSol.fechaDecision ? dateAFechaIso(antesSol.fechaDecision) : null,
            nuevo: hoy,
          },
        ];

        await this.bitacora.registrarCambios(
          tx,
          {
            proyectoId: solicitud.proyectoId,
            entidad: 'SolicitudCambio',
            entidadId: solicitudId,
            rol,
            solicitudCambioId: solicitudId,
          },
          AccionBitacora.RECHAZAR,
          cambios,
          datos.motivo,
        );

        await this.pasoKpi.medirAmbitoCambio(tx, solicitud.proyectoId);

        return actualizada;
      },
      { timeout: 15_000 },
    );
  }
}
