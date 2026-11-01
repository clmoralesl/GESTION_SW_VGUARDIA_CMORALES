import { describe, expect, it } from 'vitest';
import { filtrarSolicitudes, type SolicitudFiltrable } from './cambios';
import {
  adopcionPorSolicitud,
  embudoEtapas,
  esquemaConsultaTableroCambio,
  matrizRiesgo,
  type SolicitudParaAdopcion,
  type SolicitudParaEmbudo,
  type SolicitudParaMatriz,
  type SolicitudParaTiempos,
  tasaAprobacion,
  tiempoPromedioPorEtapa,
} from './tableroCambio';

describe('Tablero de comando del cambio (A1)', () => {
  const seedSolicitudesEmbudo: SolicitudParaEmbudo[] = [
    {
      estado: 'EN_EVALUACION',
      etapaActual: 1,
      etapas: [
        { numero: 1, estado: 'EN_CURSO' },
        { numero: 2, estado: 'PENDIENTE' },
        { numero: 3, estado: 'PENDIENTE' },
        { numero: 4, estado: 'PENDIENTE' },
        { numero: 5, estado: 'PENDIENTE' },
        { numero: 6, estado: 'PENDIENTE' },
        { numero: 7, estado: 'PENDIENTE' },
        { numero: 8, estado: 'PENDIENTE' },
        { numero: 9, estado: 'PENDIENTE' },
        { numero: 10, estado: 'PENDIENTE' },
      ],
    },
    {
      estado: 'EN_EVALUACION',
      etapaActual: 2,
      etapas: [
        { numero: 1, estado: 'COMPLETADA' },
        { numero: 2, estado: 'EN_CURSO' },
        { numero: 3, estado: 'PENDIENTE' },
        { numero: 4, estado: 'PENDIENTE' },
        { numero: 5, estado: 'PENDIENTE' },
        { numero: 6, estado: 'PENDIENTE' },
        { numero: 7, estado: 'PENDIENTE' },
        { numero: 8, estado: 'PENDIENTE' },
        { numero: 9, estado: 'PENDIENTE' },
        { numero: 10, estado: 'PENDIENTE' },
      ],
    },
    {
      estado: 'APROBADA',
      etapaActual: 4,
      etapas: [
        { numero: 1, estado: 'COMPLETADA' },
        { numero: 2, estado: 'COMPLETADA' },
        { numero: 3, estado: 'COMPLETADA' },
        { numero: 4, estado: 'EN_CURSO' },
        { numero: 5, estado: 'PENDIENTE' },
        { numero: 6, estado: 'PENDIENTE' },
        { numero: 7, estado: 'PENDIENTE' },
        { numero: 8, estado: 'PENDIENTE' },
        { numero: 9, estado: 'PENDIENTE' },
        { numero: 10, estado: 'PENDIENTE' },
      ],
    },
    {
      estado: 'RECHAZADA',
      etapaActual: 4,
      etapas: [
        { numero: 1, estado: 'COMPLETADA' },
        { numero: 2, estado: 'COMPLETADA' },
        { numero: 3, estado: 'COMPLETADA' },
        { numero: 4, estado: 'PENDIENTE' },
        { numero: 5, estado: 'PENDIENTE' },
        { numero: 6, estado: 'PENDIENTE' },
        { numero: 7, estado: 'PENDIENTE' },
        { numero: 8, estado: 'PENDIENTE' },
        { numero: 9, estado: 'PENDIENTE' },
        { numero: 10, estado: 'PENDIENTE' },
      ],
    },
    {
      estado: 'CERRADA',
      etapaActual: 10,
      etapas: [
        { numero: 1, estado: 'COMPLETADA' },
        { numero: 2, estado: 'COMPLETADA' },
        { numero: 3, estado: 'COMPLETADA' },
        { numero: 4, estado: 'OMITIDA' },
        { numero: 5, estado: 'COMPLETADA' },
        { numero: 6, estado: 'COMPLETADA' },
        { numero: 7, estado: 'COMPLETADA' },
        { numero: 8, estado: 'OMITIDA' },
        { numero: 9, estado: 'COMPLETADA' },
        { numero: 10, estado: 'COMPLETADA' },
      ],
    },
  ];

  it('1. embudoEtapas calcula alcanzaron decreciente y enEtapa excluyendo terminales', () => {
    const resultado = embudoEtapas(seedSolicitudesEmbudo);
    expect(resultado).toHaveLength(10);

    const alcanzaron = resultado.map((e) => e.alcanzaron);
    expect(alcanzaron).toEqual([5, 4, 3, 2, 1, 1, 1, 1, 1, 1]);

    const enEtapa = resultado.map((e) => e.enEtapa);
    expect(enEtapa).toEqual([1, 1, 0, 1, 0, 0, 0, 0, 0, 0]);

    const vacio = embudoEtapas([]);
    expect(vacio.every((e) => e.alcanzaron === 0 && e.enEtapa === 0)).toBe(true);
  });

  it('2. tiempoPromedioPorEtapa promedia dias corridos inclusive solo de COMPLETADA', () => {
    const solicitudes: SolicitudParaTiempos[] = [
      {
        etapas: [
          {
            numero: 1,
            estado: 'COMPLETADA',
            fechaIniciada: '2026-10-01',
            fechaCompletada: '2026-10-03',
          },
          {
            numero: 2,
            estado: 'COMPLETADA',
            fechaIniciada: '2026-10-04',
            fechaCompletada: '2026-10-06',
          },
          {
            numero: 3,
            estado: 'EN_CURSO',
            fechaIniciada: '2026-10-07',
            fechaCompletada: null,
          },
        ],
      },
      {
        etapas: [
          {
            numero: 1,
            estado: 'COMPLETADA',
            fechaIniciada: '2026-10-05',
            fechaCompletada: '2026-10-09',
          },
          {
            numero: 2,
            estado: 'OMITIDA',
            fechaIniciada: null,
            fechaCompletada: null,
          },
        ],
      },
    ];

    const tiempos = tiempoPromedioPorEtapa(solicitudes);
    expect(tiempos).toHaveLength(10);

    expect(tiempos[0].muestras).toBe(2);
    expect(tiempos[0].promedioDias).toBe(4);

    expect(tiempos[1].muestras).toBe(1);
    expect(tiempos[1].promedioDias).toBe(3);

    expect(tiempos[2].muestras).toBe(0);
    expect(tiempos[2].promedioDias).toBeNull();

    expect(tiempos[9].muestras).toBe(0);
    expect(tiempos[9].promedioDias).toBeNull();
  });

  it('3. matrizRiesgo genera 25 celdas solo con abiertas y prioridadMaxima calculada', () => {
    const solicitudes: SolicitudParaMatriz[] = [
      {
        id: 1,
        codigo: 'SC-001',
        estado: 'EN_EVALUACION',
        prioridad: 'MEDIA',
        probabilidadRiesgo: 4,
        impactoRiesgo: 3,
      },
      {
        id: 2,
        codigo: 'SC-002',
        estado: 'APROBADA',
        prioridad: 'CRITICA',
        probabilidadRiesgo: 4,
        impactoRiesgo: 3,
      },
      {
        id: 3,
        codigo: 'SC-003',
        estado: 'REGISTRADA',
        prioridad: 'BAJA',
        probabilidadRiesgo: 1,
        impactoRiesgo: 1,
      },
      {
        id: 4,
        codigo: 'SC-004',
        estado: 'RECHAZADA',
        prioridad: 'CRITICA',
        probabilidadRiesgo: 5,
        impactoRiesgo: 5,
      },
      {
        id: 5,
        codigo: 'SC-005',
        estado: 'CERRADA',
        prioridad: 'ALTA',
        probabilidadRiesgo: 5,
        impactoRiesgo: 5,
      },
    ];

    const celdas = matrizRiesgo(solicitudes);
    expect(celdas).toHaveLength(25);

    expect(celdas[0]).toMatchObject({ probabilidad: 5, impacto: 1, nivel: 'MEDIO' });
    expect(celdas[24]).toMatchObject({ probabilidad: 1, impacto: 5, nivel: 'MEDIO' });

    const celda55 = celdas.find((c) => c.probabilidad === 5 && c.impacto === 5);
    expect(celda55?.solicitudes).toEqual([]);
    expect(celda55?.prioridadMaxima).toBeNull();

    const celda43 = celdas.find((c) => c.probabilidad === 4 && c.impacto === 3);
    expect(celda43?.solicitudes).toHaveLength(2);
    expect(celda43?.prioridadMaxima).toBe('CRITICA');
    expect(celda43?.nivel).toBe('ALTO');

    const celda11 = celdas.find((c) => c.probabilidad === 1 && c.impacto === 1);
    expect(celda11?.solicitudes).toHaveLength(1);
    expect(celda11?.prioridadMaxima).toBe('BAJA');
    expect(celda11?.nivel).toBe('BAJO');
  });

  it('4. adopcionPorSolicitud lista solicitudes CERRADA con etapa 10 y promedio', () => {
    const solicitudes: SolicitudParaAdopcion[] = [
      {
        id: 1,
        codigo: 'SC-001',
        titulo: 'S1',
        estado: 'IMPLEMENTADA',
        etapas: [{ numero: 10, porcentajeAdopcion: 50 }],
      },
      {
        id: 2,
        codigo: 'SC-002',
        titulo: 'S2',
        estado: 'CERRADA',
        etapas: [{ numero: 10, porcentajeAdopcion: 80 }],
      },
      {
        id: 3,
        codigo: 'SC-003',
        titulo: 'S3',
        estado: 'CERRADA',
        etapas: [{ numero: 10, porcentajeAdopcion: 90 }],
      },
      {
        id: 4,
        codigo: 'SC-004',
        titulo: 'S4',
        estado: 'CERRADA',
        etapas: [{ numero: 10, porcentajeAdopcion: null }],
      },
    ];

    const r = adopcionPorSolicitud(solicitudes);
    expect(r.items).toHaveLength(2);
    expect(r.items[0]).toEqual({
      solicitudId: 2,
      codigo: 'SC-002',
      titulo: 'S2',
      porcentaje: 80,
    });
    expect(r.items[1]).toEqual({
      solicitudId: 3,
      codigo: 'SC-003',
      titulo: 'S3',
      porcentaje: 90,
    });
    expect(r.promedio).toBe(85);

    const vacio = adopcionPorSolicitud([]);
    expect(vacio).toEqual({ items: [], promedio: null });
  });

  it('5. tasaAprobacion calcula porcentaje con 2 decimales y null si no hay decididas', () => {
    expect(tasaAprobacion(0, 0)).toBeNull();
    expect(tasaAprobacion(2, 1)).toBe(66.67);
    expect(tasaAprobacion(3, 0)).toBe(100);
    expect(tasaAprobacion(0, 2)).toBe(0);
  });

  it('6. esquemaConsultaTableroCambio valida estrictamente los filtros', () => {
    const ok = esquemaConsultaTableroCambio.parse({
      prioridad: 'ALTA',
      categoria: 'CALIDAD',
      nivelRiesgo: 'CRITICO',
      responsable: '  Valeria  ',
      desde: '2026-11-01',
      hasta: '2026-11-01',
    });
    expect(ok.responsable).toBe('Valeria');

    expect(() =>
      esquemaConsultaTableroCambio.parse({
        desde: '2026-11-10',
        hasta: '2026-11-01',
      }),
    ).toThrow();

    expect(() =>
      esquemaConsultaTableroCambio.parse({
        desde: '2026-02-30',
      }),
    ).toThrow();

    expect(() =>
      esquemaConsultaTableroCambio.parse({
        prioridad: 'URGENTE',
      }),
    ).toThrow();

    expect(() =>
      esquemaConsultaTableroCambio.parse({
        estado: 'CERRADA',
      }),
    ).toThrow();
  });

  it('7. agregacionFiltrada integra filtrarSolicitudes con las metricas del tablero', () => {
    type SolicitudCompletaPrueba = SolicitudFiltrable &
      SolicitudParaEmbudo &
      SolicitudParaMatriz &
      SolicitudParaAdopcion &
      SolicitudParaTiempos;

    const lista: SolicitudCompletaPrueba[] = [
      {
        id: 1,
        codigo: 'SC-001',
        titulo: 'Alineacion 3D',
        responsable: 'Valeria Guardia',
        estado: 'EN_EVALUACION',
        etapaActual: 1,
        prioridad: 'MEDIA',
        categoria: 'ALCANCE',
        probabilidadRiesgo: 4,
        impactoRiesgo: 3,
        fechaRegistro: '2026-10-25',
        etapas: [
          {
            numero: 1,
            estado: 'EN_CURSO',
            fechaIniciada: '2026-10-25',
            fechaCompletada: null,
            porcentajeAdopcion: null,
          },
          {
            numero: 2,
            estado: 'PENDIENTE',
            fechaIniciada: null,
            fechaCompletada: null,
            porcentajeAdopcion: null,
          },
        ],
      },
      {
        id: 2,
        codigo: 'SC-002',
        titulo: 'Protocolo entrega limpia',
        responsable: 'Carlos Morales',
        estado: 'CERRADA',
        etapaActual: 10,
        prioridad: 'ALTA',
        categoria: 'CALIDAD',
        probabilidadRiesgo: 1,
        impactoRiesgo: 2,
        fechaRegistro: '2026-10-01',
        etapas: [
          {
            numero: 1,
            estado: 'COMPLETADA',
            fechaIniciada: '2026-10-01',
            fechaCompletada: '2026-10-03',
            porcentajeAdopcion: null,
          },
          {
            numero: 10,
            estado: 'COMPLETADA',
            fechaIniciada: '2026-10-28',
            fechaCompletada: '2026-10-30',
            porcentajeAdopcion: 85,
          },
        ],
      },
    ];

    const filtradas = filtrarSolicitudes(lista, { responsable: 'valeria' });
    expect(filtradas).toHaveLength(1);
    expect(filtradas[0].codigo).toBe('SC-001');

    const embudo = embudoEtapas(filtradas);
    expect(embudo[0].alcanzaron).toBe(1);
    expect(embudo[0].enEtapa).toBe(1);

    const matriz = matrizRiesgo(filtradas);
    const celda43 = matriz.find((c) => c.probabilidad === 4 && c.impacto === 3);
    expect(celda43?.solicitudes).toHaveLength(1);

    const adopcion = adopcionPorSolicitud(filtradas);
    expect(adopcion.items).toHaveLength(0);
    expect(adopcion.promedio).toBeNull();
  });
});
