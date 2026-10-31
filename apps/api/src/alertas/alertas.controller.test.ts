import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { configurarApp } from '../configurar-app';
import { AlertasController } from './alertas.controller';
import { AlertasService } from './alertas.service';

describe('AlertasController', () => {
  let app: INestApplication;

  const servicioMock = {
    listarPorProyecto: vi.fn().mockResolvedValue([]),
    obtenerCargaRecursos: vi.fn().mockResolvedValue({ semanas: [], profesionales: [] }),
  };

  beforeAll(async () => {
    const modulo: TestingModule = await Test.createTestingModule({
      controllers: [AlertasController],
      providers: [{ provide: AlertasService, useValue: servicioMock }],
    }).compile();

    app = modulo.createNestApplication();
    configurarApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('permite GET /proyectos/:proyectoId/alertas a JP y CC', async () => {
    const resJp = await request(app.getHttpServer())
      .get('/proyectos/1/alertas?activas=true')
      .set('X-Rol', 'JP');
    expect(resJp.status).toBe(200);

    const resCc = await request(app.getHttpServer()).get('/proyectos/1/alertas').set('X-Rol', 'CC');
    expect(resCc.status).toBe(200);
  });

  it('permite GET /carga-recursos a JP y CC', async () => {
    const resJp = await request(app.getHttpServer())
      .get('/carga-recursos?desde=2026-11-02&hasta=2026-11-20')
      .set('X-Rol', 'JP');
    expect(resJp.status).toBe(200);

    const resCc = await request(app.getHttpServer())
      .get('/carga-recursos?desde=2026-11-02&hasta=2026-11-20')
      .set('X-Rol', 'CC');
    expect(resCc.status).toBe(200);
  });

  it('rechaza /proyectos/abc/alertas con 400 VALIDACION_FALLIDA', async () => {
    const res = await request(app.getHttpServer()).get('/proyectos/abc/alertas').set('X-Rol', 'JP');
    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('VALIDACION_FALLIDA');
  });
});
