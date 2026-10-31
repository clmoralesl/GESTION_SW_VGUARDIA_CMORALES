process.env.TZ = 'America/Santiago';

import { describe, expect, it } from 'vitest';
import {
  formatearFecha,
  formatearFechaHora,
  formatearHoras,
  formatearMonto,
  formatearPorcentaje,
  SIN_DATO,
} from './formato';

describe('formato', () => {
  it('formatea fechas sin verse afectada por zona horaria local', () => {
    expect(formatearFecha('2026-10-29')).toBe('29-10-2026');
    expect(formatearFecha('2026-10-29T00:00:00.000Z')).toBe('29-10-2026');
    expect(formatearFecha(new Date('2026-10-29T00:00:00.000Z'))).toBe('29-10-2026');
    expect(formatearFecha(null)).toBe(SIN_DATO);
    expect(formatearFecha('')).toBe(SIN_DATO);
    expect(formatearFecha(undefined)).toBe(SIN_DATO);
    expect(formatearFecha('fecha-invalida')).toBe(SIN_DATO);
  });

  it('formatea fecha y hora con zona America/Santiago', () => {
    expect(formatearFechaHora('2026-10-29T15:30:00.000Z')).toBe('29-10-2026 12:30');
    expect(formatearFechaHora(new Date('2026-10-29T15:30:00.000Z'))).toBe('29-10-2026 12:30');
    expect(formatearFechaHora(null)).toBe(SIN_DATO);
    expect(formatearFechaHora('')).toBe(SIN_DATO);
    expect(formatearFechaHora('invalido')).toBe(SIN_DATO);
  });

  it('formatea montos en CLP con separadores de miles y sin decimales', () => {
    expect(formatearMonto(1250000)).toBe('$1.250.000');
    expect(formatearMonto('1250000.00')).toBe('$1.250.000');
    expect(formatearMonto(1250000.5)).toBe('$1.250.001');
    expect(formatearMonto(1250000.49)).toBe('$1.250.000');
    expect(formatearMonto(0)).toBe('$0');
    expect(formatearMonto(-0.4)).toBe('$0');
    expect(formatearMonto(-1250000)).toBe('$-1.250.000');
    expect(formatearMonto(null)).toBe(SIN_DATO);
    expect(formatearMonto(undefined)).toBe(SIN_DATO);
    expect(formatearMonto('')).toBe(SIN_DATO);
    expect(formatearMonto('abc')).toBe(SIN_DATO);
  });

  it('formatea porcentajes con hasta 1 decimal y simbolo de porcentaje', () => {
    expect(formatearPorcentaje(45.5)).toBe('45,5 %');
    expect(formatearPorcentaje(0)).toBe('0 %');
    expect(formatearPorcentaje(100)).toBe('100 %');
    expect(formatearPorcentaje('25.33')).toBe('25,3 %');
    expect(formatearPorcentaje(null)).toBe(SIN_DATO);
    expect(formatearPorcentaje(undefined)).toBe(SIN_DATO);
    expect(formatearPorcentaje(Number.NaN)).toBe(SIN_DATO);
    expect(formatearPorcentaje(Number.POSITIVE_INFINITY)).toBe(SIN_DATO);
  });

  it('formatea horas con hasta 2 decimales y sufijo h', () => {
    expect(formatearHoras(8)).toBe('8 h');
    expect(formatearHoras(7.5)).toBe('7,5 h');
    expect(formatearHoras('7.50')).toBe('7,5 h');
    expect(formatearHoras(6.25)).toBe('6,25 h');
    expect(formatearHoras(0)).toBe('0 h');
    expect(formatearHoras(null)).toBe(SIN_DATO);
    expect(formatearHoras(undefined)).toBe(SIN_DATO);
    expect(formatearHoras('')).toBe(SIN_DATO);
    expect(formatearHoras('invalido')).toBe(SIN_DATO);
  });
});
