import { INestApplication, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { configurarApp } from '../../configurar-app';
import { BitacoraController } from './bitacora.controller';
import { BitacoraLecturaService } from './bitacora-lectura.service';

describe('BitacoraController', () => {
  let app: INestApplication;

  const respuestaMock = {
    registros: [],
    total: 0,
    pagina: 1,
    tamanoPagina: 25,
    totalPaginas: 0,
  };

  const lecturaMock = {
    consultar: vi.fn().mockResolvedValue(respuestaMock),
  };

  beforeAll(async () => {
    const modulo: TestingModule = await Test.createTestingModule({
      controllers: [BitacoraController],
      providers: [{ provide: BitacoraLecturaService, useValue: lecturaMock }],
    }).compile();

    app = modulo.createNestApplication();
    configurarApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('D7: demuestra solo lectura mediante metadatos asegurando que todo metodo es GET', () => {
    const prototipo = BitacoraController.prototype;
    const metodos = Object.getOwnPropertyNames(prototipo).filter(
      (m) => m !== 'constructor' && typeof (prototipo as Record<string, unknown>)[m] === 'function',
    );

    expect(metodos.length).toBeGreaterThan(0);
    for (const metodo of metodos) {
      const tipoHttp = Reflect.getMetadata(
        METHOD_METADATA,
        (prototipo as Record<string, (...args: unknown[]) => unknown>)[metodo],
      );
      expect(tipoHttp).toBe(RequestMethod.GET);
    }
  });

  it('permite GET /bitacora con rol JP y rol CC', async () => {
    const resJp = await request(app.getHttpServer()).get('/bitacora').set('X-Rol', 'JP');
    expect(resJp.status).toBe(200);
    expect(resJp.body).toEqual(respuestaMock);

    const resCc = await request(app.getHttpServer()).get('/bitacora').set('X-Rol', 'CC');
    expect(resCc.status).toBe(200);
    expect(resCc.body).toEqual(respuestaMock);
  });

  it('responde 400 VALIDACION_FALLIDA ante parametros invalidos', async () => {
    const res = await request(app.getHttpServer())
      .get('/bitacora?tamanoPagina=0')
      .set('X-Rol', 'JP');
    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('VALIDACION_FALLIDA');
  });

  it('D7 y Caso 10: responde 404 ante mutaciones POST, PUT, PATCH y DELETE sobre /bitacora y /bitacora/1', async () => {
    const postRuta = await request(app.getHttpServer()).post('/bitacora').set('X-Rol', 'JP');
    expect(postRuta.status).toBe(404);

    const putRuta = await request(app.getHttpServer()).put('/bitacora').set('X-Rol', 'JP');
    expect(putRuta.status).toBe(404);

    const patchRuta = await request(app.getHttpServer()).patch('/bitacora').set('X-Rol', 'JP');
    expect(patchRuta.status).toBe(404);

    const deleteRuta = await request(app.getHttpServer()).delete('/bitacora').set('X-Rol', 'JP');
    expect(deleteRuta.status).toBe(404);

    const postItem = await request(app.getHttpServer()).post('/bitacora/1').set('X-Rol', 'JP');
    expect(postItem.status).toBe(404);

    const putItem = await request(app.getHttpServer()).put('/bitacora/1').set('X-Rol', 'JP');
    expect(putItem.status).toBe(404);

    const patchItem = await request(app.getHttpServer()).patch('/bitacora/1').set('X-Rol', 'JP');
    expect(patchItem.status).toBe(404);

    const deleteItem = await request(app.getHttpServer()).delete('/bitacora/1').set('X-Rol', 'JP');
    expect(deleteItem.status).toBe(404);
  });
});
