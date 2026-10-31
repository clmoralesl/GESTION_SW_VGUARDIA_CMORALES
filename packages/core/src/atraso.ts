import { diasHabilesEntre, type CalendarioLaboral } from './calendario';

export interface TareaEvaluableAtraso {
  finPlan: string | null;
  porcentajeAvance: number;
}

export function estaAtrasada(tarea: TareaEvaluableAtraso, hoy: string): boolean {
  return tarea.finPlan !== null && tarea.finPlan < hoy && tarea.porcentajeAvance < 100;
}

export function diasDeAtraso(
  tarea: TareaEvaluableAtraso,
  hoy: string,
  calendario: CalendarioLaboral,
): number {
  if (!estaAtrasada(tarea, hoy) || tarea.finPlan === null) return 0;
  return diasHabilesEntre(tarea.finPlan, hoy, calendario);
}
