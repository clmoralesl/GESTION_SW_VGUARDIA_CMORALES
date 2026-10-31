import {
  anteriorHabil,
  duracionDelLapso,
  siguienteHabil,
  sumarDiasCorridos,
  type CalendarioLaboral,
} from '@autofix/core';

export function deltaDias(deltaPx: number, pxPorDia: number): number {
  const razon = deltaPx / pxPorDia;
  const res = razon < 0 ? -Math.round(-razon) : Math.round(razon);
  return res === 0 ? 0 : res;
}

function ajustarSegunSentido(fecha: string, dias: number, calendario: CalendarioLaboral): string {
  const candidato = sumarDiasCorridos(fecha, dias);
  return dias > 0 ? siguienteHabil(candidato, calendario) : anteriorHabil(candidato, calendario);
}

export function inicioAlMover(
  inicioPlan: string,
  deltaPx: number,
  pxPorDia: number,
  calendario: CalendarioLaboral,
): string {
  const dias = deltaDias(deltaPx, pxPorDia);
  return dias === 0 ? inicioPlan : ajustarSegunSentido(inicioPlan, dias, calendario);
}

export function duracionAlEstirar(
  inicioPlan: string,
  finPlan: string,
  deltaPx: number,
  pxPorDia: number,
  calendario: CalendarioLaboral,
): number {
  const dias = deltaDias(deltaPx, pxPorDia);
  if (dias === 0) return Math.max(1, duracionDelLapso(inicioPlan, finPlan, calendario));
  const fin = ajustarSegunSentido(finPlan, dias, calendario);
  if (fin <= inicioPlan) return 1;
  return Math.max(1, duracionDelLapso(inicioPlan, fin, calendario));
}
