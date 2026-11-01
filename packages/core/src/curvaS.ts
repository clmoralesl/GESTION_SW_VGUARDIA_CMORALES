import { aDiaEpoca as aDia, aFechaIso as aIso } from './calendario';
import { redondear } from './numeros';
import { hojasDeLineaBase, type EsHabil, type FilaLineaBase } from './valorGanado';

export interface HojaCurvaS {
  tareaId: number;
  codigo: string;
  inicioPlan: string | null;
  finPlan: string | null;
  inicioReal: string | null;
  finReal: string | null;
  costoPlan: number;
  avance: number;
  costoReal: number;
}

export interface PlanCurvaS {
  tareaId: number | null;
  codigo?: string;
  inicio: string | null;
  fin: string | null;
  costo: number;
}

export interface PuntoCurvaS {
  fecha: string;
  pv: number;
  ev: number | null;
  ac: number | null;
}

const MS = 86_400_000;
const MAX_PUNTOS = 104;

const lunesDe = (d: number) => d - ((new Date(d * MS).getUTCDay() + 6) % 7);

export function fechasCurva(inicio: string, fin: string, corte: string): string[] {
  const ultimo = fin > corte ? fin : corte;
  const paso = Math.max(7, Math.ceil((aDia(ultimo) - lunesDe(aDia(inicio))) / MAX_PUNTOS / 7) * 7);
  const fechas = new Set<string>();
  for (let d = lunesDe(aDia(inicio)); d < aDia(ultimo); d += paso) fechas.add(aIso(d));
  fechas.add(corte);
  fechas.add(ultimo);
  return [...fechas].filter((f) => f >= inicio || f === corte).sort();
}

function tramoReal(h: HojaCurvaS, corte: string): [string, string] | null {
  const inicio = h.inicioReal ?? h.inicioPlan;
  if (inicio === null) return null;
  const finReal = h.finReal;
  const finBruto = finReal !== null && finReal < corte ? finReal : corte;
  const ini = inicio <= finBruto ? inicio : finBruto;
  return [ini, finBruto];
}

function fraccionReal(tramo: [string, string] | null, fecha: string): number {
  if (tramo === null) return 1;
  const [ini, fin] = tramo;
  if (fecha < ini) return 0;
  if (fecha >= fin) return 1;
  return (aDia(fecha) - aDia(ini) + 1) / (aDia(fin) - aDia(ini) + 1);
}

function normalizarPlan(
  hojas: readonly HojaCurvaS[],
  lineaBaseOPlan: readonly PlanCurvaS[] | null,
): readonly PlanCurvaS[] {
  if (lineaBaseOPlan === null) {
    return hojas.map((h) => ({
      tareaId: h.tareaId,
      codigo: h.codigo,
      inicio: h.inicioPlan,
      fin: h.finPlan,
      costo: h.costoPlan,
    }));
  }
  const conCodigo = lineaBaseOPlan.map((p) => ({
    tareaId: p.tareaId,
    codigo: p.codigo ?? '',
    inicio: p.inicio,
    fin: p.fin,
    costo: p.costo,
  }));
  return hojasDeLineaBase(conCodigo as FilaLineaBase[]) as unknown as PlanCurvaS[];
}

export function calcularCurvaS(
  hojas: readonly HojaCurvaS[],
  lineaBaseOPlan: readonly PlanCurvaS[] | null,
  corte: string,
  esHabil: EsHabil,
): PuntoCurvaS[] {
  const plan = normalizarPlan(hojas, lineaBaseOPlan);
  const inicios = [...plan.map((p) => p.inicio), ...hojas.map((x) => x.inicioReal)].filter(
    (f): f is string => f !== null,
  );
  const fines = plan.map((p) => p.fin).filter((f): f is string => f !== null);
  if (inicios.length === 0 || fines.length === 0) return [];
  const inicio = inicios.reduce((a, b) => (a < b ? a : b));
  const fin = fines.reduce((a, b) => (a > b ? a : b));
  const costoBase = new Map<number, number>();
  for (const p of plan) if (p.tareaId !== null) costoBase.set(p.tareaId, p.costo);
  const tramos = hojas.map(
    (x) => [x, x.avance > 0 || x.costoReal > 0 ? tramoReal(x, corte) : null] as const,
  );

  const ultimo = fin > corte ? fin : corte;
  const minDia = Math.min(aDia(inicio), aDia(corte));
  const maxDia = Math.max(aDia(ultimo), aDia(corte));
  const totalDias = Math.max(0, maxDia - minDia + 1);
  const habilesAcum = new Int32Array(totalDias);
  let acum = 0;
  for (let i = 0; i < totalDias; i += 1) {
    if (esHabil(aIso(minDia + i))) acum += 1;
    habilesAcum[i] = acum;
  }

  const contarHabiles = (d1: number, d2: number): number => {
    if (d1 > d2) return 0;
    const idx2 = Math.min(Math.max(0, d2 - minDia), totalDias - 1);
    const prev =
      d1 - 1 >= minDia ? (habilesAcum[Math.min(d1 - 1 - minDia, totalDias - 1)] ?? 0) : 0;
    return (habilesAcum[idx2] ?? 0) - prev;
  };

  const fraccionPlan = (pInicio: string | null, pFin: string | null, fecha: string) => {
    if (pInicio === null || pFin === null || fecha < pInicio) return 0;
    if (fecha >= pFin) return 1;
    const total = contarHabiles(aDia(pInicio), aDia(pFin));
    if (total === 0) return 1;
    return contarHabiles(aDia(pInicio), aDia(fecha)) / total;
  };

  return fechasCurva(inicio, fin, corte).map((fecha) => {
    const pv = plan.reduce((s, p) => s + p.costo * fraccionPlan(p.inicio, p.fin, fecha), 0);
    if (fecha > corte) return { fecha, pv: redondear(pv, 2), ev: null, ac: null };
    let ev = 0;
    let ac = 0;
    for (const [x, tramo] of tramos) {
      const f = fraccionReal(tramo, fecha);
      ev += (costoBase.get(x.tareaId) ?? 0) * (x.avance / 100) * f;
      ac += x.costoReal * f;
    }
    return { fecha, pv: redondear(pv, 2), ev: redondear(ev, 2), ac: redondear(ac, 2) };
  });
}
