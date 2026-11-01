import { describe, expect, it } from 'vitest';
import {
  calcularVariablesCambio,
  etapasVencidas,
  type LineaBaseCambioItem,
  type SolicitudCambioItem,
} from './variablesCambio';
import { codigosVariablesPorAmbito, VARIABLES_KPI } from './variablesKpi';

describe('Variables de gestión del cambio (A1 y A2)', () => {
  const diasHabilesEntreFijo = (desde: string, hasta: string) => {
    if (desde === '2026-11-10' && hasta === '2026-11-13') return 3;
    if (desde === '2026-11-13' && hasta === '2026-11-11') return -2;
    return 0;
  };

  it('T1 proyecto sin solicitudes: conteos en 0, promedios en null e impactos en 0', () => {
    const r = calcularVariablesCambio({
      solicitudes: [],
      lineasBase: [],
      corte: '2026-11-16',
      diasHabilesEntre: diasHabilesEntreFijo,
    });
    expect(r).toEqual({
      SC_TOTAL: 0,
      SC_APROBADAS: 0,
      SC_RECHAZADAS: 0,
      SC_ABIERTAS: 0,
      SC_TIEMPO_CICLO_PROM: null,
      SC_TIEMPO_EVAL_PROM: null,
      SC_ETAPAS_VENCIDAS: 0,
      SC_IMPACTO_COSTO_TOTAL: 0,
      SC_IMPACTO_DIAS_TOTAL: 0,
      SC_ACC_CORRECTIVAS_TOTAL: 0,
      SC_ACC_CORRECTIVAS_CERRADAS: 0,
      SC_ADOPCION_PROM: null,
      SC_RIESGO_ALTO: 0,
    });
  });

  it('T2 escenario de la semilla (D9): calcula los 13 valores esperados', () => {
    const solicitudes: SolicitudCambioItem[] = [
      {
        id: 1,
        codigo: 'SC-001',
        estado: 'EN_EVALUACION',
        fechaRegistro: '2026-10-25T10:00:00.000Z',
        fechaDecision: null,
        fechaCierre: null,
        probabilidadRiesgo: 4,
        impactoRiesgo: 3,
        etapas: [
          {
            id: 101,
            numero: 1,
            estado: 'EN_CURSO',
            fechaInicio: '2026-10-26',
            fechaFin: '2026-10-30',
            fechaIniciada: '2026-10-26',
          },
        ],
      },
      {
        id: 2,
        codigo: 'SC-002',
        estado: 'APROBADA',
        fechaRegistro: '2026-10-28T10:00:00.000Z',
        fechaDecision: '2026-11-06T12:00:00.000Z',
        fechaCierre: null,
        probabilidadRiesgo: 2,
        impactoRiesgo: 2,
        etapas: [
          {
            id: 102,
            numero: 1,
            estado: 'COMPLETADA',
            fechaInicio: '2026-10-28',
            fechaFin: '2026-10-31',
            fechaIniciada: '2026-10-28',
            fechaCompletada: '2026-10-31',
          },
        ],
      },
      {
        id: 3,
        codigo: 'SC-003',
        estado: 'RECHAZADA',
        fechaRegistro: '2026-11-01T10:00:00.000Z',
        fechaDecision: '2026-11-10T12:00:00.000Z',
        fechaCierre: null,
        probabilidadRiesgo: 3,
        impactoRiesgo: 2,
        etapas: [
          {
            id: 103,
            numero: 1,
            estado: 'COMPLETADA',
            fechaIniciada: '2026-11-01',
            acciones: [{ estado: 'PENDIENTE' }],
          },
        ],
      },
      {
        id: 4,
        codigo: 'SC-004',
        estado: 'CERRADA',
        fechaRegistro: '2026-10-18T10:00:00.000Z',
        fechaDecision: '2026-10-27T10:00:00.000Z',
        fechaCierre: '2026-11-16T15:00:00.000Z',
        probabilidadRiesgo: 2,
        impactoRiesgo: 3,
        etapas: [
          {
            id: 104,
            numero: 10,
            estado: 'COMPLETADA',
            fechaIniciada: '2026-10-18',
            porcentajeAdopcion: 85,
            acciones: [{ estado: 'CERRADA' }],
          },
        ],
      },
      {
        id: 5,
        codigo: 'SC-005',
        estado: 'REGISTRADA',
        fechaRegistro: '2026-11-12T10:00:00.000Z',
        fechaDecision: null,
        fechaCierre: null,
        probabilidadRiesgo: 2,
        impactoRiesgo: 1,
        etapas: [],
      },
    ];

    const lineasBase: LineaBaseCambioItem[] = [
      {
        version: 1,
        costoPlanTotal: 1000000,
        fechaFinProyecto: '2026-11-10',
        solicitudCambioId: null,
      },
      {
        version: 2,
        costoPlanTotal: 1300000,
        fechaFinProyecto: '2026-11-13',
        solicitudCambioId: 2,
      },
    ];

    const r = calcularVariablesCambio({
      solicitudes,
      lineasBase,
      corte: '2026-11-16',
      diasHabilesEntre: diasHabilesEntreFijo,
    });

    expect(r.SC_TOTAL).toBe(5);
    expect(r.SC_APROBADAS).toBe(2);
    expect(r.SC_RECHAZADAS).toBe(1);
    expect(r.SC_ABIERTAS).toBe(3);
    expect(r.SC_TIEMPO_CICLO_PROM).toBe(29);
    expect(r.SC_TIEMPO_EVAL_PROM).toBe(9);
    expect(r.SC_ETAPAS_VENCIDAS).toBe(1);
    expect(r.SC_IMPACTO_COSTO_TOTAL).toBe(300000);
    expect(r.SC_IMPACTO_DIAS_TOTAL).toBe(3);
    expect(r.SC_ACC_CORRECTIVAS_TOTAL).toBe(2);
    expect(r.SC_ACC_CORRECTIVAS_CERRADAS).toBe(1);
    expect(r.SC_ADOPCION_PROM).toBe(85);
    expect(r.SC_RIESGO_ALTO).toBe(1);
  });

  it('T3 etapa con fechaFin = corte no esta vencida (< estricto); fechaFin null no vence; solo EN_CURSO vence', () => {
    const solicitudes: SolicitudCambioItem[] = [
      {
        id: 1,
        codigo: 'SC-001',
        estado: 'REGISTRADA',
        fechaRegistro: '2026-11-01',
        probabilidadRiesgo: 1,
        impactoRiesgo: 1,
        etapas: [
          { id: 1, numero: 1, estado: 'EN_CURSO', fechaFin: '2026-11-16' },
          { id: 2, numero: 2, estado: 'EN_CURSO', fechaFin: null },
          { id: 3, numero: 3, estado: 'PENDIENTE', fechaFin: '2026-11-10' },
          { id: 4, numero: 4, estado: 'COMPLETADA', fechaFin: '2026-11-10' },
        ],
      },
    ];
    const vencidas = etapasVencidas(solicitudes, '2026-11-16');
    expect(vencidas).toHaveLength(0);
  });

  it('T4 etapa EN_CURSO de solicitud RECHAZADA o CERRADA no vence ni cuenta', () => {
    const solicitudes: SolicitudCambioItem[] = [
      {
        id: 1,
        codigo: 'SC-001',
        estado: 'RECHAZADA',
        fechaRegistro: '2026-11-01',
        probabilidadRiesgo: 1,
        impactoRiesgo: 1,
        etapas: [{ id: 1, numero: 1, estado: 'EN_CURSO', fechaFin: '2026-11-10' }],
      },
      {
        id: 2,
        codigo: 'SC-002',
        estado: 'CERRADA',
        fechaRegistro: '2026-11-01',
        probabilidadRiesgo: 1,
        impactoRiesgo: 1,
        etapas: [{ id: 2, numero: 1, estado: 'EN_CURSO', fechaFin: '2026-11-10' }],
      },
    ];
    expect(etapasVencidas(solicitudes, '2026-11-16')).toHaveLength(0);
    const r = calcularVariablesCambio({
      solicitudes,
      lineasBase: [],
      corte: '2026-11-16',
      diasHabilesEntre: diasHabilesEntreFijo,
    });
    expect(r.SC_ETAPAS_VENCIDAS).toBe(0);
  });

  it('T5 CERRADA sin fechaCierre se excluye del ciclo; intervalo negativo se acota a 0', () => {
    const solicitudes: SolicitudCambioItem[] = [
      {
        id: 1,
        codigo: 'SC-001',
        estado: 'CERRADA',
        fechaRegistro: '2026-11-01',
        fechaCierre: null,
        probabilidadRiesgo: 1,
        impactoRiesgo: 1,
      },
      {
        id: 2,
        codigo: 'SC-002',
        estado: 'CERRADA',
        fechaRegistro: '2026-11-10',
        fechaCierre: '2026-11-05',
        probabilidadRiesgo: 1,
        impactoRiesgo: 1,
      },
      {
        id: 3,
        codigo: 'SC-003',
        estado: 'CERRADA',
        fechaRegistro: '2026-11-01',
        fechaCierre: '2026-11-11',
        probabilidadRiesgo: 1,
        impactoRiesgo: 1,
      },
    ];
    const r = calcularVariablesCambio({
      solicitudes,
      lineasBase: [],
      corte: '2026-11-16',
      diasHabilesEntre: diasHabilesEntreFijo,
    });
    expect(r.SC_TIEMPO_CICLO_PROM).toBe(5);
  });

  it('T6 solicitud decidida con etapa 1 sin fechaIniciada usa fechaRegistro; intervalo negativo a 0', () => {
    const solicitudes: SolicitudCambioItem[] = [
      {
        id: 1,
        codigo: 'SC-001',
        estado: 'APROBADA',
        fechaRegistro: '2026-11-01',
        fechaDecision: '2026-11-09',
        probabilidadRiesgo: 1,
        impactoRiesgo: 1,
        etapas: [{ id: 1, numero: 1, estado: 'COMPLETADA', fechaIniciada: null }],
      },
      {
        id: 2,
        codigo: 'SC-002',
        estado: 'RECHAZADA',
        fechaRegistro: '2026-11-10',
        fechaDecision: '2026-11-05',
        probabilidadRiesgo: 1,
        impactoRiesgo: 1,
        etapas: [{ id: 2, numero: 1, estado: 'COMPLETADA', fechaIniciada: '2026-11-10' }],
      },
    ];
    const r = calcularVariablesCambio({
      solicitudes,
      lineasBase: [],
      corte: '2026-11-16',
      diasHabilesEntre: diasHabilesEntreFijo,
    });
    expect(r.SC_TIEMPO_EVAL_PROM).toBe(4);
  });

  it('T7 linea base intermedia sin solicitud: delta se mide contra version inmediatamente anterior', () => {
    const lineasBase: LineaBaseCambioItem[] = [
      { version: 1, costoPlanTotal: 1000, fechaFinProyecto: '2026-11-10', solicitudCambioId: null },
      { version: 2, costoPlanTotal: 1200, fechaFinProyecto: '2026-11-10', solicitudCambioId: null },
      { version: 3, costoPlanTotal: 1500, fechaFinProyecto: '2026-11-13', solicitudCambioId: 10 },
      { version: 4, costoPlanTotal: 1400, fechaFinProyecto: '2026-11-11', solicitudCambioId: 11 },
    ];
    const r = calcularVariablesCambio({
      solicitudes: [],
      lineasBase,
      corte: '2026-11-16',
      diasHabilesEntre: diasHabilesEntreFijo,
    });
    expect(r.SC_IMPACTO_COSTO_TOTAL).toBe(200);
    expect(r.SC_IMPACTO_DIAS_TOTAL).toBe(1);
  });

  it('T8 fechaFinProyecto nula en alguna linea base: suma costo pero no dias', () => {
    const lineasBase: LineaBaseCambioItem[] = [
      { version: 1, costoPlanTotal: 1000, fechaFinProyecto: null, solicitudCambioId: null },
      { version: 2, costoPlanTotal: 1300, fechaFinProyecto: '2026-11-13', solicitudCambioId: 1 },
    ];
    const r = calcularVariablesCambio({
      solicitudes: [],
      lineasBase,
      corte: '2026-11-16',
      diasHabilesEntre: diasHabilesEntreFijo,
    });
    expect(r.SC_IMPACTO_COSTO_TOTAL).toBe(300);
    expect(r.SC_IMPACTO_DIAS_TOTAL).toBe(0);
  });

  it('T9 etapasVencidas devuelve la lista con detalles', () => {
    const solicitudes: SolicitudCambioItem[] = [
      {
        id: 7,
        codigo: 'SC-007',
        estado: 'EN_EVALUACION',
        fechaRegistro: '2026-10-01',
        probabilidadRiesgo: 1,
        impactoRiesgo: 1,
        etapas: [{ id: 701, numero: 2, estado: 'EN_CURSO', fechaFin: '2026-11-10' }],
      },
    ];
    const lista = etapasVencidas(solicitudes, '2026-11-16');
    expect(lista).toEqual([
      {
        etapaId: 701,
        solicitudId: 7,
        codigo: 'SC-007',
        numero: 2,
        fechaFin: '2026-11-10',
      },
    ]);
  });

  it('T10 adopcion promedio ignora nulos, 0 cuenta y null si no hay etapas con adopcion', () => {
    const sinAdopcion: SolicitudCambioItem[] = [
      {
        id: 1,
        codigo: 'SC-001',
        estado: 'APROBADA',
        fechaRegistro: '2026-11-01',
        probabilidadRiesgo: 1,
        impactoRiesgo: 1,
        etapas: [{ id: 1, numero: 1, estado: 'COMPLETADA', porcentajeAdopcion: null }],
      },
    ];
    expect(
      calcularVariablesCambio({
        solicitudes: sinAdopcion,
        lineasBase: [],
        corte: '2026-11-16',
        diasHabilesEntre: diasHabilesEntreFijo,
      }).SC_ADOPCION_PROM,
    ).toBeNull();

    const conCero: SolicitudCambioItem[] = [
      {
        id: 2,
        codigo: 'SC-002',
        estado: 'CERRADA',
        fechaRegistro: '2026-11-01',
        probabilidadRiesgo: 1,
        impactoRiesgo: 1,
        etapas: [{ id: 2, numero: 10, estado: 'COMPLETADA', porcentajeAdopcion: 0 }],
      },
      {
        id: 3,
        codigo: 'SC-003',
        estado: 'CERRADA',
        fechaRegistro: '2026-11-01',
        probabilidadRiesgo: 1,
        impactoRiesgo: 1,
        etapas: [{ id: 3, numero: 10, estado: 'COMPLETADA', porcentajeAdopcion: 100 }],
      },
    ];
    expect(
      calcularVariablesCambio({
        solicitudes: conCero,
        lineasBase: [],
        corte: '2026-11-16',
        diasHabilesEntre: diasHabilesEntreFijo,
      }).SC_ADOPCION_PROM,
    ).toBe(50);
  });

  it('T11 riesgo alto cuenta solo solicitudes abiertas con nivel de riesgo ALTO o CRITICO', () => {
    const solicitudes: SolicitudCambioItem[] = [
      {
        id: 1,
        codigo: 'SC-001',
        estado: 'REGISTRADA',
        fechaRegistro: '2026-11-01',
        probabilidadRiesgo: 4,
        impactoRiesgo: 3,
      },
      {
        id: 2,
        codigo: 'SC-002',
        estado: 'EN_EVALUACION',
        fechaRegistro: '2026-11-01',
        probabilidadRiesgo: 5,
        impactoRiesgo: 4,
      },
      {
        id: 3,
        codigo: 'SC-003',
        estado: 'REGISTRADA',
        fechaRegistro: '2026-11-01',
        probabilidadRiesgo: 2,
        impactoRiesgo: 2,
      },
      {
        id: 4,
        codigo: 'SC-004',
        estado: 'RECHAZADA',
        fechaRegistro: '2026-11-01',
        probabilidadRiesgo: 5,
        impactoRiesgo: 5,
      },
      {
        id: 5,
        codigo: 'SC-005',
        estado: 'CERRADA',
        fechaRegistro: '2026-11-01',
        probabilidadRiesgo: 5,
        impactoRiesgo: 5,
      },
    ];
    const r = calcularVariablesCambio({
      solicitudes,
      lineasBase: [],
      corte: '2026-11-16',
      diasHabilesEntre: diasHabilesEntreFijo,
    });
    expect(r.SC_RIESGO_ALTO).toBe(2);
  });

  it('A2 regresion: SC_ADOPCION_PROM solo suma porcentaje de etapa 10 de solicitudes CERRADA', () => {
    const solicitudes: SolicitudCambioItem[] = [
      {
        id: 1,
        codigo: 'SC-001',
        estado: 'IMPLEMENTADA',
        fechaRegistro: '2026-10-25',
        probabilidadRiesgo: 1,
        impactoRiesgo: 1,
        etapas: [
          {
            id: 10,
            numero: 10,
            estado: 'EN_CURSO',
            porcentajeAdopcion: 40,
          },
        ],
      },
      {
        id: 2,
        codigo: 'SC-002',
        estado: 'CERRADA',
        fechaRegistro: '2026-10-20',
        fechaCierre: '2026-10-30',
        probabilidadRiesgo: 1,
        impactoRiesgo: 1,
        etapas: [
          {
            id: 20,
            numero: 10,
            estado: 'COMPLETADA',
            porcentajeAdopcion: 85,
          },
        ],
      },
    ];

    const r = calcularVariablesCambio({
      solicitudes,
      lineasBase: [],
      corte: '2026-11-16',
      diasHabilesEntre: diasHabilesEntreFijo,
    });

    expect(r.SC_ADOPCION_PROM).toBe(85);
  });

  it('codigosVariablesPorAmbito separa variables de CAMBIO y PROYECTO', () => {
    const cambio = codigosVariablesPorAmbito('CAMBIO');
    const proyecto = codigosVariablesPorAmbito('PROYECTO');
    const hito = codigosVariablesPorAmbito('HITO');

    expect(cambio.size).toBe(13);
    expect(proyecto.size).toBe(15);
    expect(hito.size).toBe(15);

    expect(cambio.has('PV')).toBe(false);
    expect(cambio.has('EV')).toBe(false);
    expect(cambio.has('SC_TOTAL')).toBe(true);
    expect(cambio.has('SC_ADOPCION_PROM')).toBe(true);

    expect(proyecto.has('SC_TOTAL')).toBe(false);
    expect(proyecto.has('PV')).toBe(true);

    expect(VARIABLES_KPI.length).toBe(28);
  });
});
