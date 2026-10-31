import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ProfesionalResumen, RecursoResumen, TipoRecursoResumen } from '@autofix/core';
import { configurarApp } from '../configurar-app';
import { ProfesionalesController } from './profesionales.controller';
import { ProfesionalesService } from './profesionales.service';
import { RecursosController } from './recursos.controller';
import { RecursosService } from './recursos.service';
import { TiposRecursoController } from './tipos-recurso.controller';
import { TiposRecursoService } from './tipos-recurso.service';

describe('Catalogos Controllers HTTP', () => {
  let app: INestApplication;

  const profesionalMock: ProfesionalResumen = {
    id: 1,
    nombre: 'Rodrigo Fuentes',
    cargo: 'Jefe de taller',
    tarifaHora: 12000,
    horasDiarias: 8,
    activo: true,
    numeroAsignaciones: 0,
  };

  const recursoMock: RecursoResumen = {
    id: 1,
    nombre: 'Mecánico subcontratado',
    tipoRecurso: { id: 1, nombre: 'Humano' },
    unidad: 'hora',
    costoUnitario: 9000,
    activo: true,
    numeroAsignaciones: 0,
  };

  const tipoMock: TipoRecursoResumen = {
    id: 1,
    nombre: 'Humano',
    descripcion: 'Mano de obra externa',
  };

  const profesionalesServiceMock = {
    listar: vi.fn().mockResolvedValue([profesionalMock]),
    obtenerPorId: vi.fn().mockResolvedValue(profesionalMock),
    crear: vi.fn().mockResolvedValue(profesionalMock),
    actualizar: vi.fn().mockResolvedValue(profesionalMock),
    eliminar: vi.fn().mockResolvedValue(undefined),
  };

  const recursosServiceMock = {
    listar: vi.fn().mockResolvedValue([recursoMock]),
    obtenerPorId: vi.fn().mockResolvedValue(recursoMock),
    crear: vi.fn().mockResolvedValue(recursoMock),
    actualizar: vi.fn().mockResolvedValue(recursoMock),
    eliminar: vi.fn().mockResolvedValue(undefined),
  };

  const tiposRecursoServiceMock = {
    listar: vi.fn().mockResolvedValue([tipoMock]),
  };

  beforeAll(async () => {
    const modulo: TestingModule = await Test.createTestingModule({
      controllers: [ProfesionalesController, RecursosController, TiposRecursoController],
      providers: [
        {
          provide: ProfesionalesService,
          useValue: profesionalesServiceMock,
        },
        {
          provide: RecursosService,
          useValue: recursosServiceMock,
        },
        {
          provide: TiposRecursoService,
          useValue: tiposRecursoServiceMock,
        },
      ],
    }).compile();

    app = modulo.createNestApplication();
    configurarApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('permite GET a JP y CC en las rutas de consulta', async () => {
    for (const rol of ['JP', 'CC']) {
      const resProf = await request(app.getHttpServer()).get('/profesionales').set('X-Rol', rol);
      expect(resProf.status).toBe(200);

      const resRec = await request(app.getHttpServer()).get('/recursos').set('X-Rol', rol);
      expect(resRec.status).toBe(200);

      const resTipos = await request(app.getHttpServer()).get('/tipos-recurso').set('X-Rol', rol);
      expect(resTipos.status).toBe(200);
    }
  });

  it('rechaza con 403 al rol CC en las 6 operaciones de escritura', async () => {
    const resPostProf = await request(app.getHttpServer())
      .post('/profesionales')
      .set('X-Rol', 'CC')
      .send({
        nombre: 'Nuevo',
        cargo: 'Cargo',
        tarifaHora: 10000,
        horasDiarias: 8,
      });
    expect(resPostProf.status).toBe(403);

    const resPatchProf = await request(app.getHttpServer())
      .patch('/profesionales/1')
      .set('X-Rol', 'CC')
      .send({ cargo: 'Modificado' });
    expect(resPatchProf.status).toBe(403);

    const resDeleteProf = await request(app.getHttpServer())
      .delete('/profesionales/1')
      .set('X-Rol', 'CC');
    expect(resDeleteProf.status).toBe(403);

    const resPostRec = await request(app.getHttpServer())
      .post('/recursos')
      .set('X-Rol', 'CC')
      .send({
        nombre: 'Nuevo Recurso',
        tipoRecursoId: 1,
        unidad: 'hora',
        costoUnitario: 5000,
      });
    expect(resPostRec.status).toBe(403);

    const resPatchRec = await request(app.getHttpServer())
      .patch('/recursos/1')
      .set('X-Rol', 'CC')
      .send({ unidad: 'día' });
    expect(resPatchRec.status).toBe(403);

    const resDeleteRec = await request(app.getHttpServer())
      .delete('/recursos/1')
      .set('X-Rol', 'CC');
    expect(resDeleteRec.status).toBe(403);
  });

  it('responde 204 sin cuerpo al eliminar con rol JP', async () => {
    const resProf = await request(app.getHttpServer())
      .delete('/profesionales/1')
      .set('X-Rol', 'JP');
    expect(resProf.status).toBe(204);
    expect(resProf.text).toBe('');

    const resRec = await request(app.getHttpServer()).delete('/recursos/1').set('X-Rol', 'JP');
    expect(resRec.status).toBe(204);
    expect(resRec.text).toBe('');
  });

  it('rechaza con 400 y detalles cuando NumberInput envia vacio', async () => {
    const res = await request(app.getHttpServer()).post('/profesionales').set('X-Rol', 'JP').send({
      nombre: 'Rodrigo',
      cargo: 'Jefe',
      tarifaHora: '',
      horasDiarias: 8,
    });
    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('VALIDACION_FALLIDA');
    expect(res.body.detalles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          campo: 'tarifaHora',
          mensaje: 'Ingrese la tarifa por hora.',
        }),
      ]),
    );
  });

  it('entrega tarifaHora como number y no como string', async () => {
    const res = await request(app.getHttpServer()).get('/profesionales/1').set('X-Rol', 'JP');
    expect(res.status).toBe(200);
    expect(typeof res.body.tarifaHora).toBe('number');
    expect(res.body.tarifaHora).toBe(12000);
  });
});
