import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { redondear, type TableroCambio } from '@autofix/core';
import { configurarApp } from '../configurar-app';
import { errorProyectoNoEncontrado } from '../proyectos/proyecto-abierto';
import { TableroCambioController } from './tablero-cambio.controller';
import { TableroCambioService } from './tablero-cambio.service';

describe('TableroCambioController (A5)', () => {
  let app: INestApplication;

  const respuestaMock: TableroCambio = {
    corte: '2026-11-16',
    resumen: {
      total: 5,
      abiertas: 3,
      aprobadas: 2,
      rechazadas: 1,
      tasaAprobacion: 66.67,
      tiempoCicloPromedio: 29,
      adopcionPromedio: 85,
    },
    embudo: [
      { numero: 1, nombre: 'Identificar necesidad', alcanzaron: 5, enEtapa: 1 },
      { numero: 2, nombre: 'Analizar y evaluar', alcanzaron: 4, enEtapa: 1 },
      { numero: 3, nombre: 'Evaluación riesgos', alcanzaron: 3, enEtapa: 0 },
      { numero: 4, nombre: 'Planificación', alcanzaron: 2, enEtapa: 1 },
      { numero: 5, nombre: 'Comunicación', alcanzaron: 1, enEtapa: 0 },
      { numero: 6, nombre: 'Implementación', alcanzaron: 1, enEtapa: 0 },
      { numero: 7, nombre: 'Seguimiento', alcanzaron: 1, enEtapa: 0 },
      { numero: 8, nombre: 'Resultados corto plazo', alcanzaron: 1, enEtapa: 0 },
      { numero: 9, nombre: 'Acciones correctivas', alcanzaron: 1, enEtapa: 0 },
      { numero: 10, nombre: 'Adoptar cambio', alcanzaron: 1, enEtapa: 0 },
    ],
    tiemposPorEtapa: [
      { numero: 1, nombre: 'Identificar necesidad', muestras: 3, promedioDias: 3 },
      { numero: 2, nombre: 'Analizar y evaluar', muestras: 3, promedioDias: 3 },
      { numero: 3, nombre: 'Evaluación riesgos', muestras: 2, promedioDias: 3 },
      { numero: 4, nombre: 'Planificación', muestras: 0, promedioDias: null },
      { numero: 5, nombre: 'Comunicación', muestras: 1, promedioDias: 3 },
      { numero: 6, nombre: 'Implementación', muestras: 1, promedioDias: 3 },
      { numero: 7, nombre: 'Seguimiento', muestras: 1, promedioDias: 3 },
      { numero: 8, nombre: 'Resultados corto plazo', muestras: 0, promedioDias: null },
      { numero: 9, nombre: 'Acciones correctivas', muestras: 1, promedioDias: 3 },
      { numero: 10, nombre: 'Adoptar cambio', muestras: 1, promedioDias: 3 },
    ],
    matrizRiesgo: [
      {
        probabilidad: 3,
        impacto: 4,
        nivel: 'ALTO',
        prioridadMaxima: 'ALTA',
        solicitudes: [{ solicitudId: 2, codigo: 'SC-002', prioridad: 'ALTA' }],
      },
    ],
    adopcion: {
      items: [
        {
          solicitudId: 5,
          codigo: 'SC-005',
          titulo: 'Protocolo sanitización',
          porcentaje: 85,
        },
      ],
      promedio: 85,
    },
    kpis: [
      {
        kpiId: 101,
        codigo: 'CAMBIO_TASA_APROBACION',
        nombre: 'Tasa de aprobación de cambios',
        unidad: 'PORCENTAJE',
        meta: 80,
        valor: 66.6667,
        semaforo: 'AMARILLO',
        historial: [{ medidoEn: '2026-11-16T12:00:00.000Z', valor: 66.6667, semaforo: 'AMARILLO' }],
      },
      {
        kpiId: 102,
        codigo: 'CAMBIO_INDICE_ADOPCION',
        nombre: 'Índice de adopción del cambio',
        unidad: '%',
        meta: 80,
        valor: 85,
        semaforo: 'VERDE',
        historial: [{ medidoEn: '2026-11-16T12:00:00.000Z', valor: 85, semaforo: 'VERDE' }],
      },
    ],
    alertas: {
      etapasVencidas: [
        {
          etapaId: 101,
          solicitudId: 1,
          codigo: 'SC-001',
          numero: 1,
          fechaFin: '2026-10-30',
        },
      ],
      riesgosAltos: [
        {
          solicitudId: 2,
          codigo: 'SC-002',
          titulo: 'Integración pasarela',
          nivel: 'ALTO',
          prioridad: 'ALTA',
        },
      ],
      kpiEnRojo: [],
    },
    opciones: {
      responsables: ['Carlos Morales', 'Valeria Guardia'],
    },
  };

  const servicioMock = {
    obtenerTableroCambio: vi.fn().mockImplementation((proyectoId: number) => {
      if (proyectoId === 999) throw errorProyectoNoEncontrado();
      return Promise.resolve(respuestaMock);
    }),
  };

  beforeAll(async () => {
    const modulo: TestingModule = await Test.createTestingModule({
      controllers: [TableroCambioController],
      providers: [{ provide: TableroCambioService, useValue: servicioMock }],
    }).compile();

    app = modulo.createNestApplication();
    configurarApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('permite GET /proyectos/1/tablero-cambio sin filtros con rol JP y CC', async () => {
    const resJp = await request(app.getHttpServer())
      .get('/proyectos/1/tablero-cambio')
      .set('X-Rol', 'JP');
    expect(resJp.status).toBe(200);
    expect(resJp.body.resumen.total).toBe(5);

    const resCc = await request(app.getHttpServer())
      .get('/proyectos/1/tablero-cambio')
      .set('X-Rol', 'CC');
    expect(resCc.status).toBe(200);
    expect(resCc.body.resumen.total).toBe(5);
  });

  it('rechaza con 400 ROL_REQUERIDO cuando no se envia la cabecera X-Rol', async () => {
    const res = await request(app.getHttpServer()).get('/proyectos/1/tablero-cambio');
    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('ROL_REQUERIDO');
  });

  it('responde 404 cuando el proyecto no existe', async () => {
    const res = await request(app.getHttpServer())
      .get('/proyectos/999/tablero-cambio')
      .set('X-Rol', 'JP');
    expect(res.status).toBe(404);
    expect(res.body.codigo).toBe('REGISTRO_NO_ENCONTRADO');
  });

  it('responde 400 cuando el id de proyecto en la ruta es invalido', async () => {
    const res = await request(app.getHttpServer())
      .get('/proyectos/abc/tablero-cambio')
      .set('X-Rol', 'JP');
    expect(res.status).toBe(400);
  });

  it('responde 400 ante los casos borde de validacion de filtros', async () => {
    const casos = [
      '/proyectos/1/tablero-cambio?prioridad=URGENTE',
      '/proyectos/1/tablero-cambio?nivelRiesgo=alto',
      '/proyectos/1/tablero-cambio?estado=CERRADA',
      '/proyectos/1/tablero-cambio?responsable=%20%20',
      '/proyectos/1/tablero-cambio?desde=2026-11-10&hasta=2026-11-01',
      '/proyectos/1/tablero-cambio?desde=2026-02-30',
    ];

    for (const url of casos) {
      const res = await request(app.getHttpServer()).get(url).set('X-Rol', 'JP');
      expect(res.status).toBe(400);
      expect(res.body.codigo).toBe('VALIDACION_FALLIDA');
    }
  });

  it('acepta filtros validos incluidos desde == hasta y responsable', async () => {
    const res = await request(app.getHttpServer())
      .get(
        '/proyectos/1/tablero-cambio?prioridad=ALTA&categoria=CALIDAD&nivelRiesgo=ALTO&responsable=valeria&desde=2026-11-01&hasta=2026-11-01',
      )
      .set('X-Rol', 'JP');
    expect(res.status).toBe(200);
  });

  it('comprueba igualdad entre metricas de resumen y valores de KPI de cambio', async () => {
    const res = await request(app.getHttpServer())
      .get('/proyectos/1/tablero-cambio')
      .set('X-Rol', 'JP');
    expect(res.status).toBe(200);

    const kpiTasa = res.body.kpis.find(
      (k: { codigo: string }) => k.codigo === 'CAMBIO_TASA_APROBACION',
    );
    expect(kpiTasa).toBeDefined();
    expect(res.body.resumen.tasaAprobacion).toBe(redondear(kpiTasa.valor, 2));

    const kpiAdopcion = res.body.kpis.find(
      (k: { codigo: string }) => k.codigo === 'CAMBIO_INDICE_ADOPCION',
    );
    expect(kpiAdopcion).toBeDefined();
    expect(res.body.resumen.adopcionPromedio).toBe(kpiAdopcion.valor);
  });
});
