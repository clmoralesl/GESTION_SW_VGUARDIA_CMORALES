import { HttpStatus, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ConsultaTablero, TableroProyecto } from '@autofix/core';
import { configurarApp } from '../configurar-app';
import { ExcepcionApi } from '../comun/errores/excepcion-api';
import { errorProyectoNoEncontrado } from '../proyectos/proyecto-abierto';
import { TableroController } from './tablero.controller';
import { TableroService } from './tablero.service';

describe('TableroController', () => {
  let app: INestApplication;

  const respuestaMock: TableroProyecto = {
    proyectoId: 1,
    fechaCorte: '2026-11-16',
    tarjetas: {
      avance: { real: 40, plan: 50, semaforo: 'AMARILLO', variacion: 5 },
      spi: { valor: 0.8, semaforo: 'AMARILLO', variacion: -0.05 },
      cpi: { valor: 0.93, semaforo: 'VERDE', variacion: 0.02 },
      costo: {
        costoReal: 970,
        presupuesto: 3000,
        porcentaje: 32.33,
        semaforo: 'VERDE',
        variacion: -2.5,
      },
    },
    curvaS: {
      origen: 'PLAN_ACTUAL',
      puntos: [{ fecha: '2026-11-16', pv: 900, ev: 900, ac: 970 }],
    },
    hitos: {
      cumplidos: 1,
      total: 2,
      items: [{ id: 1, nombre: 'Hito 1', fecha: '2026-11-06', estado: 'CUMPLIDO' }],
    },
    costoPorEtapa: [
      { etapaId: 1, codigo: '1', nombre: 'Etapa 1', costoPlan: 1500, costoReal: 970 },
    ],
    carga: [
      {
        profesionalId: 7,
        nombre: 'Nicolás Núñez',
        ocupacionMaxima: 100,
        diaPico: '2026-11-02',
        sobreasignado: false,
      },
    ],
    atrasadas: [],
    alertas: [],
    opciones: {
      etapas: [{ id: 1, codigo: '1', nombre: 'Etapa 1' }],
      profesionales: [{ id: 7, nombre: 'Nicolás Núñez' }],
    },
  };

  const servicioMock = {
    obtenerTablero: vi.fn().mockImplementation((proyectoId: number, consulta: ConsultaTablero) => {
      if (proyectoId === 999) throw errorProyectoNoEncontrado();
      if (consulta.etapaId === 99) {
        throw new ExcepcionApi(
          HttpStatus.BAD_REQUEST,
          'FILTRO_INVALIDO',
          'La etapa especificada no existe o no es una etapa raíz del proyecto.',
        );
      }
      return Promise.resolve(respuestaMock);
    }),
  };

  beforeAll(async () => {
    const modulo: TestingModule = await Test.createTestingModule({
      controllers: [TableroController],
      providers: [{ provide: TableroService, useValue: servicioMock }],
    }).compile();

    app = modulo.createNestApplication();
    configurarApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('permite GET /proyectos/1/tablero sin filtros con rol JP y CC', async () => {
    const resJp = await request(app.getHttpServer()).get('/proyectos/1/tablero').set('X-Rol', 'JP');
    expect(resJp.status).toBe(200);
    expect(resJp.body.proyectoId).toBe(1);

    const resCc = await request(app.getHttpServer()).get('/proyectos/1/tablero').set('X-Rol', 'CC');
    expect(resCc.status).toBe(200);
    expect(resCc.body.proyectoId).toBe(1);
  });

  it('permite GET /proyectos/1/tablero con filtros válidos', async () => {
    const res = await request(app.getHttpServer())
      .get('/proyectos/1/tablero?etapaId=1&profesionalId=7&desde=2026-11-02&hasta=2026-11-20')
      .set('X-Rol', 'JP');
    expect(res.status).toBe(200);
    expect(servicioMock.obtenerTablero).toHaveBeenCalledWith(1, {
      etapaId: 1,
      profesionalId: 7,
      desde: '2026-11-02',
      hasta: '2026-11-20',
    });
  });

  it('responde 400 VALIDACION_FALLIDA ante consultas inválidas', async () => {
    const resFechas = await request(app.getHttpServer())
      .get('/proyectos/1/tablero?desde=2026-11-20&hasta=2026-11-01')
      .set('X-Rol', 'JP');
    expect(resFechas.status).toBe(400);
    expect(resFechas.body.codigo).toBe('VALIDACION_FALLIDA');

    const resFechaInexistente = await request(app.getHttpServer())
      .get('/proyectos/1/tablero?desde=2026-02-30')
      .set('X-Rol', 'JP');
    expect(resFechaInexistente.status).toBe(400);
    expect(resFechaInexistente.body.codigo).toBe('VALIDACION_FALLIDA');

    const resEtapaInvalida = await request(app.getHttpServer())
      .get('/proyectos/1/tablero?etapaId=0')
      .set('X-Rol', 'JP');
    expect(resEtapaInvalida.status).toBe(400);
    expect(resEtapaInvalida.body.codigo).toBe('VALIDACION_FALLIDA');

    const resEtapaTexto = await request(app.getHttpServer())
      .get('/proyectos/1/tablero?etapaId=abc')
      .set('X-Rol', 'JP');
    expect(resEtapaTexto.status).toBe(400);
    expect(resEtapaTexto.body.codigo).toBe('VALIDACION_FALLIDA');

    const resParamDesconocido = await request(app.getHttpServer())
      .get('/proyectos/1/tablero?fase=1')
      .set('X-Rol', 'JP');
    expect(resParamDesconocido.status).toBe(400);
    expect(resParamDesconocido.body.codigo).toBe('VALIDACION_FALLIDA');
  });

  it('responde 400 FILTRO_INVALIDO ante filtro no existente o inválido en el servicio', async () => {
    const res = await request(app.getHttpServer())
      .get('/proyectos/1/tablero?etapaId=99')
      .set('X-Rol', 'JP');
    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('FILTRO_INVALIDO');
  });

  it('responde 404 ante proyecto inexistente', async () => {
    const res = await request(app.getHttpServer()).get('/proyectos/999/tablero').set('X-Rol', 'JP');
    expect(res.status).toBe(404);
  });
});
