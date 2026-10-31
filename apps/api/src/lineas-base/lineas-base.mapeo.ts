import { dateAFechaIso, type LineaBaseGantt } from '@autofix/core';
import type { LineaBase, LineaBaseTarea } from '@prisma/client';

export type LineaBaseConTareas = LineaBase & {
  tareas: LineaBaseTarea[];
};

export function mapearLineaBaseGantt(lineaBase: LineaBaseConTareas): LineaBaseGantt {
  return {
    id: lineaBase.id,
    version: lineaBase.version,
    descripcion: lineaBase.descripcion,
    creadoEn: lineaBase.creadoEn.toISOString(),
    fechaFinProyecto: lineaBase.fechaFinProyecto ? dateAFechaIso(lineaBase.fechaFinProyecto) : null,
    tareas: lineaBase.tareas.map((t) => ({
      tareaId: t.tareaId,
      codigo: t.codigo,
      nombre: t.nombre,
      duracionDias: t.duracionDias,
      inicioPlan: t.inicioPlan ? dateAFechaIso(t.inicioPlan) : null,
      finPlan: t.finPlan ? dateAFechaIso(t.finPlan) : null,
    })),
  };
}
