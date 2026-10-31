import { aDiaEpoca as aDia, aFechaIso as aIso } from './calendario';
import { redondear } from './numeros';

export type EsHabil = (fechaIso: string) => boolean;

export interface HojaPlan {
  tareaId: number | null;
  codigo: string;
  inicio: string | null;
  fin: string | null;
  costo: number;
}

export interface HojaActual extends HojaPlan {
  tareaId: number;
  avance: number;
  costoReal: number;
}

export type FilaLineaBase = HojaPlan;

export interface ValorGanado {
  pv: number;
  ev: number;
  ac: number;
  bac: number;
  origen: 'LINEA_BASE' | 'PLAN_ACTUAL';
}

function habilesInclusive(desde: number, hasta: number, esHabil: EsHabil): number {
  let n = 0;
  for (let d = desde; d <= hasta; d += 1) if (esHabil(aIso(d))) n += 1;
  return n;
}

export function fraccionPlanificada(
  inicio: string | null,
  fin: string | null,
  corte: string,
  esHabil: EsHabil,
): number {
  if (inicio === null || fin === null || corte < inicio) return 0;
  if (corte >= fin) return 1;
  const total = habilesInclusive(aDia(inicio), aDia(fin), esHabil);
  if (total === 0) return 1;
  return habilesInclusive(aDia(inicio), aDia(corte), esHabil) / total;
}

export function hojasDeLineaBase(filas: readonly FilaLineaBase[]): FilaLineaBase[] {
  return filas.filter((f) => !filas.some((o) => o.codigo.startsWith(`${f.codigo}.`)));
}

export function calcularValorGanado(
  hojas: readonly HojaActual[],
  lineaBase: readonly FilaLineaBase[] | null,
  corte: string,
  esHabil: EsHabil,
): ValorGanado {
  const ac = hojas.reduce((s, h) => s + h.costoReal, 0);
  const plan: HojaPlan[] = lineaBase === null ? [...hojas] : hojasDeLineaBase(lineaBase);
  const costoBase = new Map<number, number>();
  for (const p of plan) if (p.tareaId !== null) costoBase.set(p.tareaId, p.costo);
  const pv = plan.reduce(
    (s, p) => s + p.costo * fraccionPlanificada(p.inicio, p.fin, corte, esHabil),
    0,
  );
  const bac = plan.reduce((s, p) => s + p.costo, 0);
  const ev = hojas.reduce((s, h) => s + (costoBase.get(h.tareaId) ?? 0) * (h.avance / 100), 0);
  return {
    pv: redondear(pv, 2),
    ev: redondear(ev, 2),
    ac: redondear(ac, 2),
    bac: redondear(bac, 2),
    origen: lineaBase === null ? 'PLAN_ACTUAL' : 'LINEA_BASE',
  };
}
