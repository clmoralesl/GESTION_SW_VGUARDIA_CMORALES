import type { TipoDependencia } from '@autofix/core';
import type { BordesBarra } from './escala';

export type Punto = readonly [number, number];

const BORDES: Record<TipoDependencia, { salida: keyof BordesBarra; llegada: keyof BordesBarra }> = {
  FS: { salida: 'xFin', llegada: 'xInicio' },
  SS: { salida: 'xInicio', llegada: 'xInicio' },
  FF: { salida: 'xFin', llegada: 'xFin' },
  SF: { salida: 'xInicio', llegada: 'xFin' },
};

export const TRAMO_FLECHA = 8;

export function sentidoLlegadaFlecha(tipo: TipoDependencia): 1 | -1 {
  return tipo === 'FS' || tipo === 'SS' ? 1 : -1;
}

export function rutaFlecha(
  tipo: TipoDependencia,
  predecesora: BordesBarra,
  sucesora: BordesBarra,
  filaPredecesora: number,
  filaSucesora: number,
  altoFila: number,
): Punto[] {
  const borde = BORDES[tipo];
  const x0 = predecesora[borde.salida];
  const x1 = sucesora[borde.llegada];
  const y0 = filaPredecesora * altoFila + altoFila / 2;
  const y1 = filaSucesora * altoFila + altoFila / 2;
  const sentidoSalida = borde.salida === 'xFin' ? 1 : -1;
  const sentidoLlegada = borde.llegada === 'xInicio' ? 1 : -1;
  const salidaX = x0 + sentidoSalida * TRAMO_FLECHA;
  const entradaX = x1 - sentidoLlegada * TRAMO_FLECHA;
  const minimo = Math.max(
    sentidoSalida > 0 ? salidaX : -Infinity,
    sentidoLlegada < 0 ? entradaX : -Infinity,
  );
  const maximo = Math.min(
    sentidoSalida < 0 ? salidaX : Infinity,
    sentidoLlegada > 0 ? entradaX : Infinity,
  );
  if (minimo <= maximo) {
    const xm = sentidoSalida > 0 ? minimo : maximo;
    return [
      [x0, y0],
      [xm, y0],
      [xm, y1],
      [x1, y1],
    ];
  }
  const pasillo = y1 - Math.sign(y1 - y0) * (altoFila / 2);
  return [
    [x0, y0],
    [salidaX, y0],
    [salidaX, pasillo],
    [entradaX, pasillo],
    [entradaX, y1],
    [x1, y1],
  ];
}

export function trazoSvg(puntos: readonly Punto[]): string {
  return puntos.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
}
