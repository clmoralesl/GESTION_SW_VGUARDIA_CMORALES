import { diasCorridosEntre, sumarDiasCorridos } from '@autofix/core';

export type NivelZoom = 'DIA' | 'SEMANA' | 'MES';

export const PX_POR_DIA: Record<NivelZoom, number> = { DIA: 32, SEMANA: 12, MES: 4 };

export const ALTO_FILA = 32;

export interface RangoFechas {
  inicio: string;
  fin: string;
}

export interface Escala {
  rango: RangoFechas;
  pxPorDia: number;
  ancho: number;
  xDe: (fecha: string) => number;
  fechaDe: (x: number) => string;
}

export function calcularRango(fechas: readonly (string | null)[]): RangoFechas | null {
  const validas = fechas.filter((f): f is string => f !== null).sort();
  const primera = validas[0];
  const ultima = validas[validas.length - 1];
  if (!primera || !ultima) return null;
  return { inicio: sumarDiasCorridos(primera, -3), fin: sumarDiasCorridos(ultima, 7) };
}

export function crearEscala(rango: RangoFechas, pxPorDia: number): Escala {
  const dias = diasCorridosEntre(rango.inicio, rango.fin) + 1;
  return {
    rango,
    pxPorDia,
    ancho: dias * pxPorDia,
    xDe: (fecha) => diasCorridosEntre(rango.inicio, fecha) * pxPorDia,
    fechaDe: (x) => sumarDiasCorridos(rango.inicio, Math.floor(x / pxPorDia)),
  };
}

export interface BordesBarra {
  xInicio: number;
  xFin: number;
}

export function bordesBarra(
  tarea: { inicioPlan: string; finPlan: string; duracionDias: number },
  escala: Escala,
): BordesBarra {
  const x = escala.xDe(tarea.inicioPlan);
  if (tarea.duracionDias === 0) return { xInicio: x + escala.pxPorDia, xFin: x + escala.pxPorDia };
  return { xInicio: x, xFin: escala.xDe(tarea.finPlan) + escala.pxPorDia };
}
