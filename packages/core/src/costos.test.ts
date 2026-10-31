import { describe, expect, it } from 'vitest';
import {
  calcularCostosTarea,
  calcularHorasPlan,
  consolidarCostos,
  CostoExcedeMaximoError,
  resumirCostos,
  type AsignacionCosto,
} from './costos';

const a = (p: Partial<AsignacionCosto> & { tareaId: number }): AsignacionCosto => ({
  horasPlan: null,
  horasReales: null,
  tarifaAplicada: null,
  cantidadPlan: null,
  cantidadReal: null,
  costoUnitarioAplicado: null,
  ...p,
});

describe('costos', () => {
  it('costos con profesionales y recursos', () => {
    const c = calcularCostosTarea([
      a({ tareaId: 1, horasPlan: 40, horasReales: 45.5, tarifaAplicada: 25_000 }),
      a({ tareaId: 1, cantidadPlan: 3, cantidadReal: 2.5, costoUnitarioAplicado: 12_990 }),
    ]);
    expect(c).toEqual({ costoPlan: 1_038_970, costoReal: 1_169_975 });
  });

  it('reales nulos cuentan como 0 y sin asignaciones da 0', () => {
    expect(calcularCostosTarea([a({ tareaId: 1, horasPlan: 8, tarifaAplicada: 10_000 })])).toEqual({
      costoPlan: 80_000,
      costoReal: 0,
    });
    expect(calcularCostosTarea([])).toEqual({ costoPlan: 0, costoReal: 0 });
  });

  it('decimales sin deriva', () => {
    const c = calcularCostosTarea([
      a({ tareaId: 1, horasPlan: 0.1, tarifaAplicada: 3 }),
      a({ tareaId: 1, horasPlan: 0.2, tarifaAplicada: 3 }),
    ]);
    expect(c.costoPlan).toBe(0.9);
  });

  it('consolidacion en arbol de 3 niveles sin doble conteo', () => {
    const tareas = [
      { id: 1, padreId: null },
      { id: 2, padreId: 1 },
      { id: 3, padreId: 2 },
      { id: 4, padreId: 2 },
      { id: 5, padreId: 1 },
      { id: 6, padreId: null },
    ];
    const r = consolidarCostos(tareas, [
      a({ tareaId: 3, horasPlan: 10, tarifaAplicada: 1_000, horasReales: 12 }),
      a({ tareaId: 4, cantidadPlan: 2, costoUnitarioAplicado: 500, cantidadReal: 2 }),
      a({ tareaId: 5, horasPlan: 1, tarifaAplicada: 100 }),
      a({ tareaId: 2, horasPlan: 999, tarifaAplicada: 999 }),
    ]);
    expect(r.porTarea.get(2)).toEqual({ costoPlan: 11_000, costoReal: 13_000 });
    expect(r.porTarea.get(1)).toEqual({ costoPlan: 11_100, costoReal: 13_000 });
    expect(r.porTarea.get(6)).toEqual({ costoPlan: 0, costoReal: 0 });
    expect(r.proyecto).toEqual({ costoPlan: 11_100, costoReal: 13_000 });
  });

  it('desborde contra PRESUPUESTO_MAXIMO', () => {
    expect(() =>
      calcularCostosTarea([a({ tareaId: 7, horasPlan: 99_999_999.99, tarifaAplicada: 9_999_999 })]),
    ).toThrow(CostoExcedeMaximoError);
  });

  it('horas plan: duracion x horas/dia x dedicacion', () => {
    expect(calcularHorasPlan(5, 8, 60)).toBe(24);
    expect(calcularHorasPlan(3, 7.5, 1)).toBe(0.23);
    expect(calcularHorasPlan(1, 24, 100)).toBe(24);
  });

  it('resumen y division por cero', () => {
    expect(resumirCostos(1_000_000, { costoPlan: 1_100_000, costoReal: 0 })).toEqual({
      presupuesto: 1_000_000,
      costoPlan: 1_100_000,
      costoReal: 0,
      diferenciaMonto: -100_000,
      diferenciaPorcentaje: -10,
      excedePresupuesto: true,
    });
    const r = resumirCostos(0, { costoPlan: 5, costoReal: 0 });
    expect(r.diferenciaPorcentaje).toBeNull();
    expect(r.excedePresupuesto).toBe(false);
  });
});
