import { Prisma } from '@prisma/client';
import { sumarMontos, type Rol } from '@autofix/core';
import type { BitacoraService } from '../comun/bitacora/bitacora.service';

export async function crearLineaBase(
  tx: Prisma.TransactionClient,
  proyectoId: number,
  opciones?: {
    descripcion?: string | null;
    solicitudCambioId?: number | null;
    rol?: Rol;
  },
  bitacora?: BitacoraService,
) {
  const tareas = await tx.tarea.findMany({
    where: { proyectoId },
    orderBy: { codigo: 'asc' },
  });

  const idsPadres = new Set(tareas.map((t) => t.padreId).filter((id): id is number => id !== null));
  const tareasHojas = tareas.filter((t) => !idsPadres.has(t.id));
  const costoPlanTotal = sumarMontos(tareasHojas.map((t) => Number(t.costoPlan)));

  let fechaFinProyecto: Date | null = null;
  for (const t of tareas) {
    if (t.finPlan && (!fechaFinProyecto || t.finPlan > fechaFinProyecto)) {
      fechaFinProyecto = t.finPlan;
    }
  }

  const ultima = await tx.lineaBase.findFirst({
    where: { proyectoId },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  const version = (ultima?.version ?? 0) + 1;

  const lineaBase = await tx.lineaBase.create({
    data: {
      proyectoId,
      version,
      descripcion:
        opciones?.descripcion !== undefined
          ? opciones.descripcion
          : version === 1
            ? 'Línea base inicial'
            : `Línea base v${version}`,
      solicitudCambioId: opciones?.solicitudCambioId ?? null,
      fechaFinProyecto,
      costoPlanTotal,
      tareas: {
        create: tareas.map((t) => ({
          tareaId: t.id,
          codigo: t.codigo,
          nombre: t.nombre,
          nivel: t.nivel,
          duracionDias: t.duracionDias,
          inicioPlan: t.inicioPlan,
          finPlan: t.finPlan,
          costoPlan: t.costoPlan,
        })),
      },
    },
    include: {
      tareas: {
        orderBy: { codigo: 'asc' },
      },
    },
  });

  if (bitacora) {
    await bitacora.registrarCreacion(
      tx,
      {
        proyectoId,
        entidad: 'LineaBase',
        entidadId: lineaBase.id,
        rol: opciones?.rol ?? 'JP',
        solicitudCambioId: opciones?.solicitudCambioId ?? null,
      },
      {
        version,
        descripcion: lineaBase.descripcion,
        costoPlanTotal: Number(lineaBase.costoPlanTotal),
      },
    );
  }

  return lineaBase;
}
