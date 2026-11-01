import { HttpStatus, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ExcepcionApi } from '../comun/errores/excepcion-api';
import { configurarApp } from '../configurar-app';
import { ImportacionesController } from './importaciones.controller';
import {
  ImportacionesService,
  type ResultadoConfirmacionImportacion,
  type ResultadoVistaPrevia,
} from './importaciones.service';

describe('ImportacionesController', () => {
  let app: INestApplication;

  const mockVistaPrevia: ResultadoVistaPrevia = {
    valido: true,
    hojas: [],
    errores: [],
    advertencias: [],
    truncado: false,
    destino: {
      proyectoId: null,
      tieneDatos: false,
    },
  };

  const mockConfirmar: ResultadoConfirmacionImportacion = {
    proyectoId: 1,
    conteos: {
      tareas: 3,
      dependencias: 2,
      asignaciones: 2,
      hitos: 1,
      solicitudes: 0,
    },
  };

  const servicioMock = {
    obtenerPlantilla: vi.fn().mockResolvedValue(Buffer.from('fake-xlsx')),
    exportarProyecto: vi.fn().mockResolvedValue({
      buffer: Buffer.from('fake-export-xlsx'),
      nombreArchivo: 'proyecto_1_2026-11-01.xlsx',
    }),
    vistaPrevia: vi.fn().mockImplementation((archivo) => {
      if (!archivo || !archivo.buffer) {
        throw new ExcepcionApi(
          HttpStatus.BAD_REQUEST,
          'SOLICITUD_INVALIDA',
          'Debe adjuntar un archivo para la vista previa.',
        );
      }
      if (archivo.originalname.endsWith('.txt')) {
        throw new ExcepcionApi(
          HttpStatus.UNSUPPORTED_MEDIA_TYPE,
          'TIPO_ARCHIVO_NO_PERMITIDO',
          'El archivo debe ser un libro Excel con extensión .xlsx válido.',
        );
      }
      return Promise.resolve(mockVistaPrevia);
    }),
    confirmar: vi.fn().mockImplementation((archivo, proyectoId, reemplazar) => {
      if (!archivo || !archivo.buffer) {
        throw new ExcepcionApi(
          HttpStatus.BAD_REQUEST,
          'SOLICITUD_INVALIDA',
          'Debe adjuntar un archivo para confirmar la importación.',
        );
      }
      if (archivo.originalname.endsWith('.txt')) {
        throw new ExcepcionApi(
          HttpStatus.UNSUPPORTED_MEDIA_TYPE,
          'TIPO_ARCHIVO_NO_PERMITIDO',
          'El archivo debe ser un libro Excel con extensión .xlsx válido.',
        );
      }
      if (archivo.originalname === 'errores.xlsx') {
        throw new ExcepcionApi(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'IMPORTACION_INVALIDA',
          'El archivo contiene errores de validación.',
          [{ celda: 'Tareas!A2', mensaje: 'Código inválido' }],
        );
      }
      if (proyectoId === 1 && !reemplazar) {
        throw new ExcepcionApi(
          HttpStatus.CONFLICT,
          'PROYECTO_CON_DATOS',
          'El proyecto destino contiene datos y no se especificó reemplazar=true.',
        );
      }
      return Promise.resolve(mockConfirmar);
    }),
  };

  beforeAll(async () => {
    const modulo: TestingModule = await Test.createTestingModule({
      controllers: [ImportacionesController],
      providers: [{ provide: ImportacionesService, useValue: servicioMock }],
    }).compile();

    app = modulo.createNestApplication();
    configurarApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('permite GET /importaciones/plantilla a JP y CC', async () => {
    const resJp = await request(app.getHttpServer())
      .get('/importaciones/plantilla')
      .set('X-Rol', 'JP');
    expect(resJp.status).toBe(200);
    expect(resJp.headers['content-type']).toContain('spreadsheetml.sheet');

    const resCc = await request(app.getHttpServer())
      .get('/importaciones/plantilla')
      .set('X-Rol', 'CC');
    expect(resCc.status).toBe(200);
    expect(resCc.headers['content-type']).toContain('spreadsheetml.sheet');
  });

  it('permite GET /proyectos/:proyectoId/exportacion a JP y CC', async () => {
    const resJp = await request(app.getHttpServer())
      .get('/proyectos/1/exportacion')
      .set('X-Rol', 'JP');
    expect(resJp.status).toBe(200);
    expect(resJp.headers['content-disposition']).toContain('proyecto_1_2026-11-01.xlsx');

    const resCc = await request(app.getHttpServer())
      .get('/proyectos/1/exportacion')
      .set('X-Rol', 'CC');
    expect(resCc.status).toBe(200);
  });

  it('rechaza POST /importaciones/vista-previa con 403 a CC', async () => {
    const res = await request(app.getHttpServer())
      .post('/importaciones/vista-previa')
      .set('X-Rol', 'CC')
      .attach('archivo', Buffer.from([0x50, 0x4b, 0x03, 0x04]), 'prueba.xlsx');
    expect(res.status).toBe(403);
    expect(res.body.codigo).toBe('ROL_NO_PERMITIDO');
  });

  it('rechaza POST /importaciones con 403 a CC', async () => {
    const res = await request(app.getHttpServer())
      .post('/importaciones')
      .set('X-Rol', 'CC')
      .attach('archivo', Buffer.from([0x50, 0x4b, 0x03, 0x04]), 'prueba.xlsx');
    expect(res.status).toBe(403);
    expect(res.body.codigo).toBe('ROL_NO_PERMITIDO');
  });

  it('permite POST /importaciones/vista-previa a JP y devuelve 200', async () => {
    const res = await request(app.getHttpServer())
      .post('/importaciones/vista-previa')
      .set('X-Rol', 'JP')
      .attach('archivo', Buffer.from([0x50, 0x4b, 0x03, 0x04]), 'valido.xlsx');
    expect(res.status).toBe(200);
    expect(res.body.valido).toBe(true);
  });

  it('rechaza archivo no soportado con 415 TIPO_ARCHIVO_NO_PERMITIDO', async () => {
    const res = await request(app.getHttpServer())
      .post('/importaciones/vista-previa')
      .set('X-Rol', 'JP')
      .attach('archivo', Buffer.from('texto plano'), 'archivo.txt');
    expect(res.status).toBe(415);
    expect(res.body.codigo).toBe('TIPO_ARCHIVO_NO_PERMITIDO');
  });

  it('rechaza confirmar proyecto con datos sin reemplazar con 409 PROYECTO_CON_DATOS', async () => {
    const res = await request(app.getHttpServer())
      .post('/importaciones?proyectoId=1')
      .set('X-Rol', 'JP')
      .attach('archivo', Buffer.from([0x50, 0x4b, 0x03, 0x04]), 'valido.xlsx');
    expect(res.status).toBe(409);
    expect(res.body.codigo).toBe('PROYECTO_CON_DATOS');
  });

  it('rechaza confirmar archivo con errores con 422 IMPORTACION_INVALIDA', async () => {
    const res = await request(app.getHttpServer())
      .post('/importaciones')
      .set('X-Rol', 'JP')
      .attach('archivo', Buffer.from([0x50, 0x4b, 0x03, 0x04]), 'errores.xlsx');
    expect(res.status).toBe(422);
    expect(res.body.codigo).toBe('IMPORTACION_INVALIDA');
    expect(res.body.detalles).toBeDefined();
  });

  it('permite confirmar importación con JP y devuelve 201 con conteos', async () => {
    const res = await request(app.getHttpServer())
      .post('/importaciones?proyectoId=1&reemplazar=true')
      .set('X-Rol', 'JP')
      .attach('archivo', Buffer.from([0x50, 0x4b, 0x03, 0x04]), 'valido.xlsx');
    expect(res.status).toBe(201);
    expect(res.body.proyectoId).toBe(1);
    expect(res.body.conteos.tareas).toBe(3);
  });
});
