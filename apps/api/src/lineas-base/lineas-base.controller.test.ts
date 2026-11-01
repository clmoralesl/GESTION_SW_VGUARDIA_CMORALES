import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { LineaBaseVigente } from '@autofix/core';
import { configurarApp } from '../configurar-app';
import { errorProyectoNoEncontrado } from '../proyectos/proyecto-abierto';
import { LineasBaseController } from './lineas-base.controller';
import { LineasBaseService } from './lineas-base.service';

describe('LineasBaseController', () => {
  let app: INestApplication;

  const lineaBaseMock: LineaBaseVigente = {
    proyectoId: 1,
    lineaBase: {
      id: 1,
      version: 1,
      descripcion: 'Linea base inicial',
      creadoEn: '2026-10-31T12:00:00.000Z',
      fechaFinProyecto: '2026-12-10',
      tareas: [
        {
          tareaId: 3,
          codigo: '1.1.1',
          nombre: 'Entrevistas',
          duracionDias: 3,
          inicioPlan: '2026-11-02',
          finPlan: '2026-11-04',
        },
      ],
    },
  };

  const servicioMock = {
    obtenerVigente: vi.fn(),
    listar: vi.fn(),
    obtenerPorVersion: vi.fn(),
    comparar: vi.fn(),
  };

  beforeAll(async () => {
    const modulo: TestingModule = await Test.createTestingModule({
      controllers: [LineasBaseController],
      providers: [{ provide: LineasBaseService, useValue: servicioMock }],
    }).compile();

    app = modulo.createNestApplication();
    configurarApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('responde 200 con linea base vigente con rol JP', async () => {
    servicioMock.obtenerVigente.mockResolvedValueOnce(lineaBaseMock);

    const res = await request(app.getHttpServer())
      .get('/proyectos/1/lineas-base/vigente')
      .set('X-Rol', 'JP');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(lineaBaseMock);
    expect(servicioMock.obtenerVigente).toHaveBeenCalledWith(1);
  });

  it('permite consulta con rol CC respondiendo 200', async () => {
    servicioMock.obtenerVigente.mockResolvedValueOnce(lineaBaseMock);

    const res = await request(app.getHttpServer())
      .get('/proyectos/1/lineas-base/vigente')
      .set('X-Rol', 'CC');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(lineaBaseMock);
  });

  it('responde 200 con lineaBase null cuando no hay linea base creada', async () => {
    servicioMock.obtenerVigente.mockResolvedValueOnce({ proyectoId: 2, lineaBase: null });

    const res = await request(app.getHttpServer())
      .get('/proyectos/2/lineas-base/vigente')
      .set('X-Rol', 'JP');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ proyectoId: 2, lineaBase: null });
  });

  it('responde 404 cuando el proyecto no existe', async () => {
    servicioMock.obtenerVigente.mockRejectedValueOnce(errorProyectoNoEncontrado());

    const res = await request(app.getHttpServer())
      .get('/proyectos/999/lineas-base/vigente')
      .set('X-Rol', 'JP');

    expect(res.status).toBe(404);
    expect(res.body.codigo).toBe('REGISTRO_NO_ENCONTRADO');
  });

  it('rechaza identificador de proyecto invalido con 400', async () => {
    const res = await request(app.getHttpServer())
      .get('/proyectos/invalido/lineas-base/vigente')
      .set('X-Rol', 'JP');

    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('VALIDACION_FALLIDA');
  });

  it('permite listar versiones de linea base respondiendo 200', async () => {
    servicioMock.listar.mockResolvedValueOnce({
      versiones: [{ version: 1, creadoEn: '2026-10-31T12:00:00.000Z' }],
      versionGantt: 1,
    });

    const res = await request(app.getHttpServer())
      .get('/proyectos/1/lineas-base')
      .set('X-Rol', 'JP');

    expect(res.status).toBe(200);
    expect(res.body.versionGantt).toBe(1);
    expect(servicioMock.listar).toHaveBeenCalledWith(1);
  });

  it('obtiene linea base por version respondiendo 200', async () => {
    servicioMock.obtenerPorVersion.mockResolvedValueOnce({
      version: 1,
      descripcion: 'Linea base inicial',
      creadoEn: '2026-10-31T12:00:00.000Z',
      tareas: [],
    });

    const res = await request(app.getHttpServer())
      .get('/proyectos/1/lineas-base/1')
      .set('X-Rol', 'JP');

    expect(res.status).toBe(200);
    expect(res.body.version).toBe(1);
    expect(servicioMock.obtenerPorVersion).toHaveBeenCalledWith(1, 1);
  });

  it('compara dos lineas base respondiendo 200', async () => {
    servicioMock.comparar.mockResolvedValueOnce({
      versionA: 1,
      versionB: 2,
      filas: [],
      resumen: {
        totalTareasA: 0,
        totalTareasB: 0,
        modificadas: 0,
        agregadas: 0,
        eliminadas: 0,
        iguales: 0,
        diferenciaCostoTotal: 0,
        diferenciaDiasProyecto: 0,
      },
    });

    const res = await request(app.getHttpServer())
      .get('/proyectos/1/lineas-base/comparar?a=1&b=2')
      .set('X-Rol', 'JP');

    expect(res.status).toBe(200);
    expect(res.body.versionA).toBe(1);
    expect(res.body.versionB).toBe(2);
    expect(servicioMock.comparar).toHaveBeenCalledWith(1, 1, 2);
  });

  it('rechaza comparar sin parametros a y b con 400', async () => {
    const res = await request(app.getHttpServer())
      .get('/proyectos/1/lineas-base/comparar')
      .set('X-Rol', 'JP');

    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('SOLICITUD_INVALIDA');
  });
});
