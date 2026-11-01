import { describe, expect, it } from 'vitest';
import {
  calcularVersionGantt,
  emparejarFilas,
  resumirComparacion,
  type FilaLineaBaseComparador,
  type ResumenVersionComparacion,
} from './lineas-base';

describe('lineas-base - comparador y versionamiento', () => {
  it('empareja filas por tareaId cuando cambian los codigos por renumeracion', () => {
    const filasA: FilaLineaBaseComparador[] = [
      {
        tareaId: 101,
        codigo: '1.1',
        nombre: 'Tarea A',
        duracionDias: 3,
        inicioPlan: '2026-11-02',
        finPlan: '2026-11-04',
        costoPlan: 1000,
      },
      {
        tareaId: 102,
        codigo: '1.2',
        nombre: 'Tarea B',
        duracionDias: 5,
        inicioPlan: '2026-11-05',
        finPlan: '2026-11-11',
        costoPlan: 2000,
      },
    ];

    const filasB: FilaLineaBaseComparador[] = [
      {
        tareaId: 101,
        codigo: '1.1',
        nombre: 'Tarea A',
        duracionDias: 3,
        inicioPlan: '2026-11-02',
        finPlan: '2026-11-04',
        costoPlan: 1000,
      },
      {
        tareaId: 103,
        codigo: '1.2',
        nombre: 'Tarea Nueva Intermedia',
        duracionDias: 2,
        inicioPlan: '2026-11-05',
        finPlan: '2026-11-06',
        costoPlan: 500,
      },
      {
        tareaId: 102,
        codigo: '1.3',
        nombre: 'Tarea B',
        duracionDias: 5,
        inicioPlan: '2026-11-07',
        finPlan: '2026-11-13',
        costoPlan: 2000,
      },
    ];

    const comparacion = emparejarFilas(filasA, filasB);
    expect(comparacion.length).toBe(3);

    const filaA = comparacion.find((f) => f.tareaId === 101);
    expect(filaA?.estado).toBe('IGUAL');
    expect(filaA?.codigo).toBe('1.1');

    const filaNueva = comparacion.find((f) => f.tareaId === 103);
    expect(filaNueva?.estado).toBe('AGREGADA');
    expect(filaNueva?.codigo).toBe('1.2');

    const filaB = comparacion.find((f) => f.tareaId === 102);
    expect(filaB?.estado).toBe('MODIFICADA');
    expect(filaB?.codigo).toBe('1.3');
    expect(filaB?.inicioPlanA).toBe('2026-11-05');
    expect(filaB?.inicioPlanB).toBe('2026-11-07');
  });

  it('empareja por codigo solo cuando ambas filas tienen tareaId nulo', () => {
    const filasA: FilaLineaBaseComparador[] = [
      {
        tareaId: null,
        codigo: '1.1',
        nombre: 'Etapa Sin ID',
        duracionDias: 10,
        inicioPlan: '2026-11-02',
        finPlan: '2026-11-13',
        costoPlan: 5000,
      },
    ];

    const filasB: FilaLineaBaseComparador[] = [
      {
        tareaId: null,
        codigo: '1.1',
        nombre: 'Etapa Sin ID',
        duracionDias: 10,
        inicioPlan: '2026-11-02',
        finPlan: '2026-11-13',
        costoPlan: 5000,
      },
    ];

    const comparacion = emparejarFilas(filasA, filasB);
    expect(comparacion.length).toBe(1);
    expect(comparacion[0].estado).toBe('IGUAL');
    expect(comparacion[0].tareaId).toBeNull();
  });

  it('no empareja fila sin tareaId con fila con tareaId aunque tengan el mismo codigo', () => {
    const filasA: FilaLineaBaseComparador[] = [
      {
        tareaId: null,
        codigo: '1.1',
        nombre: 'Sin ID',
        duracionDias: 3,
        inicioPlan: '2026-11-02',
        finPlan: '2026-11-04',
        costoPlan: 1000,
      },
    ];

    const filasB: FilaLineaBaseComparador[] = [
      {
        tareaId: 44,
        codigo: '1.1',
        nombre: 'Con ID',
        duracionDias: 3,
        inicioPlan: '2026-11-02',
        finPlan: '2026-11-04',
        costoPlan: 1000,
      },
    ];

    const comparacion = emparejarFilas(filasA, filasB);
    expect(comparacion.length).toBe(2);
    expect(comparacion[0].estado).toBe('ELIMINADA');
    expect(comparacion[0].tareaId).toBeNull();
    expect(comparacion[1].estado).toBe('AGREGADA');
    expect(comparacion[1].tareaId).toBe(44);
  });

  it('ordena empates con ELIMINADA antes de AGREGADA cuando comparten codigo', () => {
    const filasA: FilaLineaBaseComparador[] = [
      {
        tareaId: 10,
        codigo: '1.2',
        nombre: 'Tarea Eliminada',
        duracionDias: 4,
        inicioPlan: '2026-11-02',
        finPlan: '2026-11-05',
        costoPlan: 1200,
      },
    ];

    const filasB: FilaLineaBaseComparador[] = [
      {
        tareaId: 20,
        codigo: '1.2',
        nombre: 'Tarea Agregada Con Mismo Codigo',
        duracionDias: 5,
        inicioPlan: '2026-11-06',
        finPlan: '2026-11-12',
        costoPlan: 1500,
      },
    ];

    const comparacion = emparejarFilas(filasA, filasB);
    expect(comparacion.length).toBe(2);
    expect(comparacion[0].estado).toBe('ELIMINADA');
    expect(comparacion[0].tareaId).toBe(10);
    expect(comparacion[1].estado).toBe('AGREGADA');
    expect(comparacion[1].tareaId).toBe(20);
  });

  it('resumirComparacion calcula totales de cabecera y conteos de filas', () => {
    const versionA: ResumenVersionComparacion = {
      version: 1,
      descripcion: 'Línea base inicial',
      fechaFinProyecto: '2026-11-20',
      costoPlanTotal: 10000,
      creadoEn: '2026-11-01T10:00:00.000Z',
    };

    const versionB: ResumenVersionComparacion = {
      version: 2,
      descripcion: 'Aprobación cambio SC-002',
      fechaFinProyecto: '2026-11-25',
      costoPlanTotal: 12500,
      creadoEn: '2026-11-01T12:00:00.000Z',
    };

    const filasA: FilaLineaBaseComparador[] = [
      {
        tareaId: 1,
        codigo: '1.1',
        nombre: 'Tarea 1',
        duracionDias: 2,
        inicioPlan: '2026-11-02',
        finPlan: '2026-11-03',
        costoPlan: 4000,
      },
      {
        tareaId: 2,
        codigo: '1.2',
        nombre: 'Tarea 2',
        duracionDias: 4,
        inicioPlan: '2026-11-04',
        finPlan: '2026-11-09',
        costoPlan: 6000,
      },
    ];

    const filasB: FilaLineaBaseComparador[] = [
      {
        tareaId: 1,
        codigo: '1.1',
        nombre: 'Tarea 1',
        duracionDias: 2,
        inicioPlan: '2026-11-02',
        finPlan: '2026-11-03',
        costoPlan: 4000,
      },
      {
        tareaId: 2,
        codigo: '1.2',
        nombre: 'Tarea 2',
        duracionDias: 7,
        inicioPlan: '2026-11-04',
        finPlan: '2026-11-12',
        costoPlan: 8500,
      },
    ];

    const resultado = resumirComparacion(versionA, versionB, filasA, filasB);
    expect(resultado.totales.costoPlanTotalA).toBe(10000);
    expect(resultado.totales.costoPlanTotalB).toBe(12500);
    expect(resultado.totales.diferenciaCostoTotal).toBe(2500);
    expect(resultado.totales.diferenciaDiasFinProyecto).toBe(5);
    expect(resultado.totales.totalTareas).toBe(2);
    expect(resultado.totales.tareasIguales).toBe(1);
    expect(resultado.totales.tareasModificadas).toBe(1);
  });

  it('calcularVersionGantt devuelve version anterior si la maxima viene de solicitud', () => {
    expect(
      calcularVersionGantt([
        { version: 1, solicitudCambioId: null },
        { version: 2, solicitudCambioId: 10 },
      ]),
    ).toBe(1);

    expect(
      calcularVersionGantt([
        { version: 1, solicitudCambioId: null },
        { version: 2, solicitudCambioId: null },
      ]),
    ).toBe(2);

    expect(
      calcularVersionGantt([
        { version: 1, solicitudCambioId: null },
        { version: 2, solicitudCambioId: 1 },
        { version: 3, solicitudCambioId: 2 },
      ]),
    ).toBe(2);

    expect(calcularVersionGantt([])).toBeNull();
  });
});
