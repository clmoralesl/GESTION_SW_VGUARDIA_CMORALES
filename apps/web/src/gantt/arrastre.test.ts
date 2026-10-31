import { describe, expect, it } from 'vitest';
import {
  crearCalendarioLaboral,
  DIAS_LABORABLES_POR_DEFECTO,
  feriadosChileDesde,
} from '@autofix/core';
import { deltaDias, duracionAlEstirar, inicioAlMover } from './arrastre';

describe('arrastre', () => {
  const feriados = feriadosChileDesde('2026-01-01').map((f) => f.fecha);
  const calendarioChile = crearCalendarioLaboral({
    diasLaborables: DIAS_LABORABLES_POR_DEFECTO,
    feriados,
  });
  const pxPorDia = 32;

  it('calcula deltaDias con redondeo', () => {
    expect(deltaDias(0, pxPorDia)).toBe(0);
    expect(deltaDias(15, pxPorDia)).toBe(0);
    expect(deltaDias(16, pxPorDia)).toBe(1);
    expect(deltaDias(-15, pxPorDia)).toBe(0);
    expect(deltaDias(-16, pxPorDia)).toBe(-1);
  });

  it('reproduce la tabla de inicioAlMover del dictamen 3.4', () => {
    expect(inicioAlMover('2026-11-23', -15, pxPorDia, calendarioChile)).toBe('2026-11-23');
    expect(inicioAlMover('2026-11-23', -16, pxPorDia, calendarioChile)).toBe('2026-11-20');
    expect(inicioAlMover('2026-11-23', 16, pxPorDia, calendarioChile)).toBe('2026-11-24');
    expect(inicioAlMover('2026-11-23', 160, pxPorDia, calendarioChile)).toBe('2026-11-30');
  });

  it('reproduce la tabla de duracionAlEstirar del dictamen 3.4', () => {
    expect(duracionAlEstirar('2026-12-03', '2026-12-10', -32, pxPorDia, calendarioChile)).toBe(4);
    expect(duracionAlEstirar('2026-12-03', '2026-12-10', -64, pxPorDia, calendarioChile)).toBe(3);
    expect(duracionAlEstirar('2026-12-03', '2026-12-10', -400, pxPorDia, calendarioChile)).toBe(1);
    expect(duracionAlEstirar('2026-12-03', '2026-12-10', 32, pxPorDia, calendarioChile)).toBe(6);
    expect(duracionAlEstirar('2026-12-03', '2026-12-10', 64, pxPorDia, calendarioChile)).toBe(7);
    expect(duracionAlEstirar('2026-11-05', '2026-11-10', 64, pxPorDia, calendarioChile)).toBe(6);
  });
});
