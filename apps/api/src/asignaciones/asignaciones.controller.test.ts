import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { AsignacionResumen, ResumenCostos } from '@autofix/core';
import { configurarApp } from '../configurar-app';
import { AsignacionesController } from './asignaciones.controller';
import { AsignacionesService } from './asignaciones.service';

describe('AsignacionesController', () => {
  let app: INestApplication;

  const asignacionMock: AsignacionResumen = {
    id: 1,
    tareaId: 10,
    profesionalId: 5,
    recursoId: null,
    dedicacion: 50,
    horasPlan: 20,
    horasPlanManual: false,
    horasReales: null,
    tarifaAplicada: 15_000,
    cantidadPlan: null,
    cantidadReal: null,
    costoUnitarioAplicado: null,
    costoPlan: 300_000,
    costoReal: 0,
    profesional: {
      id: 5,
      nombre: 'Carlos',
      cargo: 'Mecánico',
      activo: true,
      tarifaHora: 15_000,
      horasDiarias: 8,
    },
    recurso: null,
  };

  const costosMock: ResumenCostos = {
    presupuesto: 1_000_000,
    costoPlan: 300_000,
    costoReal: 0,
    diferenciaMonto: 700_000,
    diferenciaPorcentaje: 70,
    excedePresupuesto: false,
  };

  const servicioMock = {
    listarPorTarea: vi.fn().mockResolvedValue([asignacionMock]),
    obtenerCostos: vi.fn().mockResolvedValue(costosMock),
    crear: vi.fn().mockResolvedValue({ asignacion: asignacionMock, costos: costosMock }),
    actualizar: vi.fn().mockResolvedValue({ asignacion: asignacionMock, costos: costosMock }),
    eliminar: vi.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    const modulo: TestingModule = await Test.createTestingModule({
      controllers: [AsignacionesController],
      providers: [{ provide: AsignacionesService, useValue: servicioMock }],
    }).compile();

    app = modulo.createNestApplication();
    configurarApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('permite GET /tareas/:tareaId/asignaciones y GET /proyectos/:proyectoId/costos a rol JP y CC', async () => {
    const resAsigJp = await request(app.getHttpServer())
      .get('/tareas/10/asignaciones')
      .set('X-Rol', 'JP');
    expect(resAsigJp.status).toBe(200);

    const resAsigCc = await request(app.getHttpServer())
      .get('/tareas/10/asignaciones')
      .set('X-Rol', 'CC');
    expect(resAsigCc.status).toBe(200);

    const resCostosJp = await request(app.getHttpServer())
      .get('/proyectos/1/costos')
      .set('X-Rol', 'JP');
    expect(resCostosJp.status).toBe(200);
    expect(resCostosJp.body).toEqual(costosMock);

    const resCostosCc = await request(app.getHttpServer())
      .get('/proyectos/1/costos')
      .set('X-Rol', 'CC');
    expect(resCostosCc.status).toBe(200);
  });

  it('rechaza con 403 al rol CC en POST, PATCH y DELETE', async () => {
    const resPost = await request(app.getHttpServer())
      .post('/tareas/10/asignaciones')
      .set('X-Rol', 'CC')
      .send({ profesionalId: 5, dedicacion: 50 });
    expect(resPost.status).toBe(403);
    expect(resPost.body.codigo).toBe('ROL_NO_PERMITIDO');

    const resPatch = await request(app.getHttpServer())
      .patch('/asignaciones/1')
      .set('X-Rol', 'CC')
      .send({ dedicacion: 60 });
    expect(resPatch.status).toBe(403);
    expect(resPatch.body.codigo).toBe('ROL_NO_PERMITIDO');

    const resDelete = await request(app.getHttpServer())
      .delete('/asignaciones/1')
      .set('X-Rol', 'CC');
    expect(resDelete.status).toBe(403);
    expect(resDelete.body.codigo).toBe('ROL_NO_PERMITIDO');
  });

  it('permite POST, PATCH y DELETE al rol JP', async () => {
    const resPost = await request(app.getHttpServer())
      .post('/tareas/10/asignaciones')
      .set('X-Rol', 'JP')
      .send({ profesionalId: 5, dedicacion: 50 });
    expect(resPost.status).toBe(201);
    expect(resPost.body.asignacion.id).toBe(1);

    const resPatch = await request(app.getHttpServer())
      .patch('/asignaciones/1')
      .set('X-Rol', 'JP')
      .send({ dedicacion: 60 });
    expect(resPatch.status).toBe(200);

    const resDelete = await request(app.getHttpServer())
      .delete('/asignaciones/1')
      .set('X-Rol', 'JP');
    expect(resDelete.status).toBe(204);
  });

  it('rechaza mezcla de profesional y recurso con 400 VALIDACION_FALLIDA', async () => {
    const res = await request(app.getHttpServer())
      .post('/tareas/10/asignaciones')
      .set('X-Rol', 'JP')
      .send({ profesionalId: 5, dedicacion: 50, recursoId: 2 });
    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('VALIDACION_FALLIDA');
  });
});
