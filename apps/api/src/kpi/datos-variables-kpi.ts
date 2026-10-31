import { EstadoProyecto, Prisma, type Tarea } from '@prisma/client';
import {
  avancePonderado,
  calcularCargaDiaria,
  dateAFechaIso,
  esHabil,
  type AsignacionCarga,
  type CalendarioLaboral,
  type DatosCalculoVariablesKpi,
  type TareaCarga,
} from '@autofix/core';
import { cargarCalendarioLaboral } from '../calendario/calendario-laboral';
import type { PrismaService } from '../prisma/prisma.service';

export type ClientePrismaKpi = PrismaService | Prisma.TransactionClient;

export async function cargarDatosVariablesKpi(
  cliente: ClientePrismaKpi,
  proyectoId: number,
  calendario: CalendarioLaboral,
  corte: string,
  tareasPrecargadas?: Tarea[],
): Promise<DatosCalculoVariablesKpi & { versionLineaBase: number | null }> {
  const tx = cliente as Prisma.TransactionClient;

  const tareas = tareasPrecargadas ?? (await tx.tarea.findMany({ where: { proyectoId } }));

  const padresIds = new Set(tareas.map((t) => t.padreId).filter((id): id is number => id !== null));
  const hojasActuales = tareas
    .filter((t) => !padresIds.has(t.id))
    .map((t) => ({
      id: t.id,
      codigo: t.codigo,
      inicioPlan: t.inicioPlan ? dateAFechaIso(t.inicioPlan) : null,
      finPlan: t.finPlan ? dateAFechaIso(t.finPlan) : null,
      duracionDias: t.duracionDias,
      porcentajeAvance: Number(t.porcentajeAvance),
      costoPlan: Number(t.costoPlan),
      costoReal: Number(t.costoReal),
    }));

  const etapas = tareas.filter((t) => t.padreId === null);
  const avanceRealProyecto = avancePonderado(
    etapas.map((e) => ({
      avance: Number(e.porcentajeAvance),
      duracion: e.duracionDias,
    })),
  );

  const lineaBaseDb = await tx.lineaBase.findFirst({
    where: { proyectoId },
    orderBy: { version: 'desc' },
    include: { tareas: true },
  });

  const hitosDb = await tx.hito.findMany({
    where: { proyectoId },
    include: { tarea: true },
  });

  const asignacionesProyectoDb = await tx.asignacion.findMany({
    where: {
      tarea: { proyectoId },
      profesionalId: { not: null },
    },
    include: { profesional: true, tarea: true },
  });

  const profesionalIds = [
    ...new Set(
      asignacionesProyectoDb.map((a) => a.profesionalId).filter((id): id is number => id !== null),
    ),
  ];

  let cargaDiariaGlobal: ReturnType<typeof calcularCargaDiaria> | undefined;

  if (profesionalIds.length > 0) {
    const asignacionesGlobales = await tx.asignacion.findMany({
      where: {
        profesionalId: { in: profesionalIds },
        tarea: {
          inicioPlan: { not: null },
          finPlan: { not: null },
          porcentajeAvance: { lt: 100 },
          proyecto: { estado: { not: EstadoProyecto.CERRADO } },
          hijas: { none: {} },
        },
      },
      include: {
        tarea: {
          select: {
            id: true,
            codigo: true,
            proyectoId: true,
            inicioPlan: true,
            finPlan: true,
            porcentajeAvance: true,
          },
        },
      },
    });

    const proyectosIds = new Set<number>([
      proyectoId,
      ...asignacionesGlobales.map((a) => a.tarea.proyectoId),
    ]);
    const calendarios = new Map<number, CalendarioLaboral>();
    for (const pId of proyectosIds) {
      calendarios.set(
        pId,
        pId === proyectoId ? calendario : await cargarCalendarioLaboral(tx, pId),
      );
    }

    const tareasCargaMap = new Map<number, TareaCarga>();
    for (const a of asignacionesGlobales) {
      if (!tareasCargaMap.has(a.tarea.id)) {
        const cal = calendarios.get(a.tarea.proyectoId) ?? calendario;
        tareasCargaMap.set(a.tarea.id, {
          id: a.tarea.id,
          codigo: a.tarea.codigo,
          proyectoId: a.tarea.proyectoId,
          inicioPlan: a.tarea.inicioPlan ? dateAFechaIso(a.tarea.inicioPlan) : null,
          finPlan: a.tarea.finPlan ? dateAFechaIso(a.tarea.finPlan) : null,
          porcentajeAvance: Number(a.tarea.porcentajeAvance),
          esHabil: (fechaIso: string) => esHabil(fechaIso, cal),
        });
      }
    }

    const asignacionesCarga: AsignacionCarga[] = asignacionesGlobales.map((a) => ({
      profesionalId: a.profesionalId!,
      tareaId: a.tareaId,
      dedicacion: a.dedicacion ? Number(a.dedicacion) : 0,
    }));

    cargaDiariaGlobal = calcularCargaDiaria(asignacionesCarga, [...tareasCargaMap.values()]);
  }

  return {
    corte,
    calendario,
    hojasActuales,
    avanceRealProyecto,
    lineaBase: lineaBaseDb
      ? lineaBaseDb.tareas.map((t) => ({
          tareaId: t.tareaId,
          codigo: t.codigo,
          inicioPlan: t.inicioPlan ? dateAFechaIso(t.inicioPlan) : null,
          finPlan: t.finPlan ? dateAFechaIso(t.finPlan) : null,
          duracionDias: t.duracionDias,
          costoPlan: Number(t.costoPlan),
        }))
      : null,
    hitos: hitosDb.map((h) => ({
      id: h.id,
      fechaObjetivo: dateAFechaIso(h.fechaObjetivo),
      fechaCumplimiento: h.fechaCumplimiento ? dateAFechaIso(h.fechaCumplimiento) : null,
      tarea: h.tarea
        ? {
            finPlan: h.tarea.finPlan ? dateAFechaIso(h.tarea.finPlan) : null,
            porcentajeAvance: Number(h.tarea.porcentajeAvance),
          }
        : null,
    })),
    asignacionesProyecto: asignacionesProyectoDb.map((a) => ({
      profesionalId: a.profesionalId!,
      tareaId: a.tareaId,
      dedicacion: a.dedicacion ? Number(a.dedicacion) : 0,
      horasPlan: a.horasPlan ? Number(a.horasPlan) : null,
      duracionDias: a.tarea.duracionDias,
      horasDiarias: a.profesional ? Number(a.profesional.horasDiarias) : 8,
    })),
    cargaDiariaGlobal,
    versionLineaBase: lineaBaseDb ? lineaBaseDb.version : null,
  };
}
