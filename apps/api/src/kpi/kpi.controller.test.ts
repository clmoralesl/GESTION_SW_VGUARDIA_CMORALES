import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { configurarApp } from '../configurar-app';
import { KpiController } from './kpi.controller';
import { KpiService } from './kpi.service';

describe('KpiController HTTP y roles', () => {
  let app: INestApplication;

  const kpiMock = {
    id: 1,
    codigo: 'SPI',
    nombre: 'Índice de desempeño del cronograma',
    descripcion: null,
    ambito: 'PROYECTO' as const,
    formula: 'EV / PV',
    unidad: 'INDICE' as const,
    meta: 1,
    direccion: 'MAYOR_MEJOR' as const,
    esAdicional: false,
    activo: true,
    umbrales: { verde: 0.95, amarillo: 0.85 },
  };

  const servicioMock = {
    obtenerVariables: vi.fn(),
    listar: vi.fn(),
    crear: vi.fn(),
    actualizar: vi.fn(),
    eliminar: vi.fn(),
    validarFormula: vi.fn(),
    listarPorProyecto: vi.fn(),
    listarMediciones: vi.fn(),
  };

  beforeAll(async () => {
    const modulo: TestingModule = await Test.createTestingModule({
      controllers: [KpiController],
      providers: [{ provide: KpiService, useValue: servicioMock }],
    }).compile();

    app = modulo.createNestApplication();
    configurarApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('permite GET /kpi y GET /variables-kpi a roles JP y CC', async () => {
    servicioMock.listar.mockResolvedValueOnce([kpiMock]);
    servicioMock.obtenerVariables.mockResolvedValueOnce({
      fechaCorte: '2026-11-06',
      origen: 'CATALOGO',
      variables: [],
    });

    const resKpi = await request(app.getHttpServer()).get('/kpi').set('X-Rol', 'CC');
    expect(resKpi.status).toBe(200);

    const resVars = await request(app.getHttpServer()).get('/variables-kpi').set('X-Rol', 'CC');
    expect(resVars.status).toBe(200);
  });

  it('permite POST /kpi con rol JP', async () => {
    servicioMock.crear.mockResolvedValueOnce(kpiMock);

    const res = await request(app.getHttpServer())
      .post('/kpi')
      .set('X-Rol', 'JP')
      .send({
        codigo: 'SPI',
        nombre: 'Índice de desempeño del cronograma',
        ambito: 'PROYECTO',
        formula: 'EV / PV',
        unidad: 'INDICE',
        meta: 1,
        direccion: 'MAYOR_MEJOR',
        umbrales: { verde: 0.95, amarillo: 0.85 },
      });

    expect(res.status).toBe(201);
  });

  it('rechaza con 403 al rol CC en operaciones de escritura de KPI', async () => {
    const resPost = await request(app.getHttpServer()).post('/kpi').set('X-Rol', 'CC').send({
      codigo: 'SPI',
      nombre: 'Índice',
      ambito: 'PROYECTO',
      formula: 'EV / PV',
      unidad: 'INDICE',
      direccion: 'MAYOR_MEJOR',
    });
    expect(resPost.status).toBe(403);

    const resPatch = await request(app.getHttpServer())
      .patch('/kpi/1')
      .set('X-Rol', 'CC')
      .send({ nombre: 'Nuevo nombre' });
    expect(resPatch.status).toBe(403);

    const resDel = await request(app.getHttpServer()).delete('/kpi/1').set('X-Rol', 'CC');
    expect(resDel.status).toBe(403);

    const resVal = await request(app.getHttpServer())
      .post('/kpi/validar-formula')
      .set('X-Rol', 'CC')
      .send({ formula: 'EV / PV' });
    expect(resVal.status).toBe(403);
  });

  it('permite POST /kpi/validar-formula a rol JP respondiendo 200', async () => {
    servicioMock.validarFormula.mockResolvedValueOnce({
      valida: true,
      valor: 0.8333,
      variables: ['EV', 'PV'],
      errores: [],
    });

    const res = await request(app.getHttpServer())
      .post('/kpi/validar-formula')
      .set('X-Rol', 'JP')
      .send({ formula: 'EV / PV' });

    expect(res.status).toBe(200);
    expect(res.body.valida).toBe(true);
  });
});
