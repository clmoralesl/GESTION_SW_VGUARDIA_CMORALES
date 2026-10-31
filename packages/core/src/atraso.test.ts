import { describe, expect, it } from 'vitest';
import { diasDeAtraso, estaAtrasada } from './atraso';
import { CALENDARIO_POR_DEFECTO } from './calendario';

describe('estaAtrasada', () => {
  it('devuelve false si finPlan es null', () => {
    expect(estaAtrasada({ finPlan: null, porcentajeAvance: 0 }, '2026-11-10')).toBe(false);
  });

  it('devuelve false si finPlan es igual a hoy', () => {
    expect(estaAtrasada({ finPlan: '2026-11-10', porcentajeAvance: 50 }, '2026-11-10')).toBe(false);
  });

  it('devuelve false si finPlan es posterior a hoy', () => {
    expect(estaAtrasada({ finPlan: '2026-11-11', porcentajeAvance: 0 }, '2026-11-10')).toBe(false);
  });

  it('devuelve true si finPlan es anterior a hoy y avance es menor a 100', () => {
    expect(estaAtrasada({ finPlan: '2026-11-09', porcentajeAvance: 99.99 }, '2026-11-10')).toBe(
      true,
    );
  });

  it('devuelve false si finPlan es anterior a hoy y avance es 100', () => {
    expect(estaAtrasada({ finPlan: '2026-11-09', porcentajeAvance: 100 }, '2026-11-10')).toBe(
      false,
    );
  });
});

describe('diasDeAtraso', () => {
  it('devuelve 0 si la tarea no esta atrasada', () => {
    expect(
      diasDeAtraso(
        { finPlan: '2026-11-10', porcentajeAvance: 50 },
        '2026-11-10',
        CALENDARIO_POR_DEFECTO,
      ),
    ).toBe(0);
    expect(
      diasDeAtraso({ finPlan: null, porcentajeAvance: 0 }, '2026-11-10', CALENDARIO_POR_DEFECTO),
    ).toBe(0);
    expect(
      diasDeAtraso(
        { finPlan: '2026-11-09', porcentajeAvance: 100 },
        '2026-11-10',
        CALENDARIO_POR_DEFECTO,
      ),
    ).toBe(0);
  });

  it('calcula dias habiles entre finPlan y hoy', () => {
    expect(
      diasDeAtraso(
        { finPlan: '2026-11-13', porcentajeAvance: 0 },
        '2026-11-16',
        CALENDARIO_POR_DEFECTO,
      ),
    ).toBe(1);
    expect(
      diasDeAtraso(
        { finPlan: '2026-11-13', porcentajeAvance: 0 },
        '2026-11-18',
        CALENDARIO_POR_DEFECTO,
      ),
    ).toBe(3);
  });
});
