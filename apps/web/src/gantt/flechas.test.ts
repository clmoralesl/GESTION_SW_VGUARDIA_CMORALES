import { describe, expect, it } from 'vitest';
import type { TipoDependencia } from '@autofix/core';
import type { BordesBarra } from './escala';
import { rutaFlecha, sentidoLlegadaFlecha, trazoSvg, type Punto } from './flechas';

describe('flechas', () => {
  const altoFila = 32;

  const verificarAserciones = (
    tipo: TipoDependencia,
    puntos: Punto[],
    bp: BordesBarra,
    bs: BordesBarra,
  ) => {
    const p0 = puntos[0]!;
    const pN = puntos[puntos.length - 1]!;
    const salida = tipo[0] === 'F' ? bp.xFin : bp.xInicio;
    const llegada = tipo[1] === 'S' ? bs.xInicio : bs.xFin;
    const sentidoLlegada = sentidoLlegadaFlecha(tipo);

    expect(p0[0]).toBe(salida);
    expect(pN[0]).toBe(llegada);

    for (let i = 1; i < puntos.length; i += 1) {
      const a = puntos[i - 1]!;
      const b = puntos[i]!;
      expect(a[0] === b[0] || a[1] === b[1]).toBe(true);
    }

    const penultimo = puntos[puntos.length - 2]!;
    expect(Math.sign(pN[0] - penultimo[0])).toBe(sentidoLlegada);

    const segundo = puntos[1]!;
    expect(Math.sign(segundo[0] - p0[0])).toBe(tipo[0] === 'F' ? 1 : -1);
  };

  it('cumple las 5 aserciones para los 4 tipos en corrimientos sinteticos arriba y abajo', () => {
    const tipos: TipoDependencia[] = ['FS', 'SS', 'FF', 'SF'];

    for (const tipo of tipos) {
      for (let offset = -5; offset <= 5; offset += 1) {
        for (const [filaPred, filaSuc] of [
          [2, 5],
          [5, 2],
        ] as const) {
          const bp: BordesBarra = { xInicio: 200, xFin: 360 };
          const bs: BordesBarra = {
            xInicio: 200 + offset * 32,
            xFin: 200 + offset * 32 + 120,
          };

          const puntos = rutaFlecha(tipo, bp, bs, filaPred, filaSuc, altoFila);
          verificarAserciones(tipo, puntos, bp, bs);
        }
      }
    }
  });

  it('traza correctamente las 8 dependencias del seed', () => {
    const barrasSeed: Record<string, { fila: number; barra: BordesBarra }> = {
      '1.1.1': { fila: 2, barra: { xInicio: 64, xFin: 160 } },
      '1.1.2': { fila: 3, barra: { xInicio: 160, xFin: 288 } },
      '1.2.1': { fila: 5, barra: { xInicio: 288, xFin: 448 } },
      '1.2.2': { fila: 6, barra: { xInicio: 384, xFin: 512 } },
      '2.1.1': { fila: 9, barra: { xInicio: 512, xFin: 704 } },
      '2.1.2': { fila: 10, barra: { xInicio: 704, xFin: 960 } },
      '2.2.1': { fila: 12, barra: { xInicio: 960, xFin: 1216 } },
      '2.2.2': { fila: 13, barra: { xInicio: 736, xFin: 800 } },
    };

    const dependenciasSeed: Array<{ pred: string; suc: string; tipo: TipoDependencia }> = [
      { pred: '1.1.1', suc: '1.1.2', tipo: 'FS' },
      { pred: '1.1.2', suc: '1.2.1', tipo: 'SS' },
      { pred: '1.2.1', suc: '1.2.2', tipo: 'SS' },
      { pred: '1.1.2', suc: '1.2.2', tipo: 'FF' },
      { pred: '1.2.1', suc: '2.1.1', tipo: 'FS' },
      { pred: '2.1.1', suc: '2.1.2', tipo: 'FS' },
      { pred: '2.1.2', suc: '2.2.1', tipo: 'SS' },
      { pred: '1.2.1', suc: '2.2.2', tipo: 'SF' },
    ];

    for (const d of dependenciasSeed) {
      const pred = barrasSeed[d.pred]!;
      const suc = barrasSeed[d.suc]!;
      const puntos = rutaFlecha(d.tipo, pred.barra, suc.barra, pred.fila, suc.fila, altoFila);
      verificarAserciones(d.tipo, puntos, pred.barra, suc.barra);

      const trazo = trazoSvg(puntos);
      expect(trazo.startsWith('M')).toBe(true);
      expect(trazo.includes('L')).toBe(true);
    }
  });

  it('produce 5 segmentos cuando no hay espacio horizontal entre salida y llegada', () => {
    const bp: BordesBarra = { xInicio: 100, xFin: 200 };
    const bsContigua: BordesBarra = { xInicio: 200, xFin: 300 };

    const puntos = rutaFlecha('FS', bp, bsContigua, 1, 2, altoFila);
    expect(puntos.length).toBe(6);
  });
});
