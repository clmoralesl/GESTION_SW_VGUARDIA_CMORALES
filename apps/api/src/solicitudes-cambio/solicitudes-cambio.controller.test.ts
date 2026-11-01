import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { configurarApp } from '../configurar-app';
import { SolicitudesCambioController } from './solicitudes-cambio.controller';
import { DetalleSolicitudCambio, SolicitudesCambioService } from './solicitudes-cambio.service';

describe('SolicitudesCambioController', () => {
  let app: INestApplication;

  const solicitudMock: DetalleSolicitudCambio = {
    id: 1,
    proyectoId: 1,
    codigo: 'SC-001',
    titulo: 'Solicitud mock',
    descripcion: 'Descripcion mock',
    justificacion: 'Justificacion mock',
    solicitante: 'Juan Pérez',
    responsable: 'María López',
    prioridad: 'MEDIA',
    categoria: 'ALCANCE',
    probabilidadRiesgo: 2,
    impactoRiesgo: 3,
    nivelRiesgo: 'MEDIO',
    estado: 'REGISTRADA',
    etapaActual: 1,
    motivoRechazo: null,
    fechaRegistro: '2026-10-31T00:00:00.000Z',
    fechaDecision: null,
    fechaCierre: null,
    actualizadoEn: '2026-10-31T00:00:00.000Z',
    etapas: [],
  };

  const servicioMock = {
    listar: vi.fn().mockResolvedValue([solicitudMock]),
    obtener: vi.fn().mockResolvedValue(solicitudMock),
    crear: vi.fn().mockResolvedValue(solicitudMock),
    actualizar: vi.fn().mockResolvedValue(solicitudMock),
    actualizarEtapa: vi.fn().mockResolvedValue({ id: 1, numero: 2, estado: 'PENDIENTE' }),
    ejecutarAccionEtapa: vi.fn().mockResolvedValue(solicitudMock),
    adjuntarEvidencia: vi.fn().mockResolvedValue({ id: 1, nombreArchivo: 'doc.pdf' }),
    obtenerEvidenciaParaDescarga: vi.fn().mockResolvedValue({
      ruta: 'C:/mock/doc.pdf',
      nombreArchivo: 'doc.pdf',
      tipoMime: 'application/pdf',
    }),
    eliminarEvidencia: vi.fn().mockResolvedValue(undefined),
    crearAccionCorrectiva: vi.fn().mockResolvedValue({ id: 1, descripcion: 'Accion' }),
    actualizarAccionCorrectiva: vi.fn().mockResolvedValue({ id: 1, descripcion: 'Actualizada' }),
  };

  beforeAll(async () => {
    const modulo: TestingModule = await Test.createTestingModule({
      controllers: [SolicitudesCambioController],
      providers: [{ provide: SolicitudesCambioService, useValue: servicioMock }],
    }).compile();

    app = modulo.createNestApplication();
    configurarApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('permite GET /proyectos/:proyectoId/solicitudes-cambio a JP y CC', async () => {
    const resJp = await request(app.getHttpServer())
      .get('/proyectos/1/solicitudes-cambio')
      .set('X-Rol', 'JP');
    expect(resJp.status).toBe(200);

    const resCc = await request(app.getHttpServer())
      .get('/proyectos/1/solicitudes-cambio')
      .set('X-Rol', 'CC');
    expect(resCc.status).toBe(200);
  });

  it('permite POST solo a rol JP y rechaza con 403 a CC', async () => {
    const cuerpoValido = {
      titulo: 'Nueva solicitud',
      descripcion: 'Detalle',
      justificacion: 'Motivo',
      solicitante: 'Juan',
      responsable: 'María',
      prioridad: 'ALTA',
      categoria: 'PLAZO',
      probabilidadRiesgo: 2,
      impactoRiesgo: 3,
    };

    const resCc = await request(app.getHttpServer())
      .post('/proyectos/1/solicitudes-cambio')
      .set('X-Rol', 'CC')
      .send(cuerpoValido);
    expect(resCc.status).toBe(403);
    expect(resCc.body.codigo).toBe('ROL_NO_PERMITIDO');

    const resJp = await request(app.getHttpServer())
      .post('/proyectos/1/solicitudes-cambio')
      .set('X-Rol', 'JP')
      .send(cuerpoValido);
    expect(resJp.status).toBe(201);
  });

  it('permite PATCH /solicitudes-cambio/:id solo a JP', async () => {
    const resCc = await request(app.getHttpServer())
      .patch('/solicitudes-cambio/1')
      .set('X-Rol', 'CC')
      .send({ titulo: 'Titulo nuevo' });
    expect(resCc.status).toBe(403);

    const resJp = await request(app.getHttpServer())
      .patch('/solicitudes-cambio/1')
      .set('X-Rol', 'JP')
      .send({ titulo: 'Titulo nuevo' });
    expect(resJp.status).toBe(200);
  });

  it('permite PATCH y POST de etapas solo a CC', async () => {
    const resJp = await request(app.getHttpServer())
      .patch('/solicitudes-cambio/1/etapas/2')
      .set('X-Rol', 'JP')
      .send({ responsable: 'Pedro' });
    expect(resJp.status).toBe(403);

    const resCc = await request(app.getHttpServer())
      .patch('/solicitudes-cambio/1/etapas/2')
      .set('X-Rol', 'CC')
      .send({ responsable: 'Pedro' });
    expect(resCc.status).toBe(200);

    const resIniciarJp = await request(app.getHttpServer())
      .post('/solicitudes-cambio/1/etapas/2/iniciar')
      .set('X-Rol', 'JP');
    expect(resIniciarJp.status).toBe(403);

    const resIniciarCc = await request(app.getHttpServer())
      .post('/solicitudes-cambio/1/etapas/2/iniciar')
      .set('X-Rol', 'CC');
    expect(resIniciarCc.status).toBe(200);
  });

  it('permite adjuntar y eliminar evidencias a ambos roles', async () => {
    const buffer = Buffer.from('%PDF-1.4 prueba');
    const resJp = await request(app.getHttpServer())
      .post('/solicitudes-cambio/1/etapas/2/evidencias')
      .set('X-Rol', 'JP')
      .attach('archivo', buffer, 'documento.pdf');
    expect(resJp.status).toBe(201);

    const resCc = await request(app.getHttpServer())
      .post('/solicitudes-cambio/1/etapas/2/evidencias')
      .set('X-Rol', 'CC')
      .attach('archivo', buffer, 'documento.pdf');
    expect(resCc.status).toBe(201);

    const resDelJp = await request(app.getHttpServer()).delete('/evidencias/1').set('X-Rol', 'JP');
    expect(resDelJp.status).toBe(204);

    const resDelCc = await request(app.getHttpServer()).delete('/evidencias/1').set('X-Rol', 'CC');
    expect(resDelCc.status).toBe(204);
  });

  it('valida numero de etapa entre 1 y 10 con 400', async () => {
    const res11 = await request(app.getHttpServer())
      .post('/solicitudes-cambio/1/etapas/11/iniciar')
      .set('X-Rol', 'CC');
    expect(res11.status).toBe(400);
    expect(res11.body.codigo).toBe('VALIDACION_FALLIDA');

    const res0 = await request(app.getHttpServer())
      .post('/solicitudes-cambio/1/etapas/0/iniciar')
      .set('X-Rol', 'CC');
    expect(res0.status).toBe(400);
  });

  it('rechaza cuerpos con datos invalidos con 400 VALIDACION_FALLIDA', async () => {
    const res = await request(app.getHttpServer())
      .patch('/solicitudes-cambio/1')
      .set('X-Rol', 'JP')
      .send({ probabilidadRiesgo: 99 });
    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('VALIDACION_FALLIDA');
  });

  it('acepta PATCH {} vacio sin fallar', async () => {
    const res = await request(app.getHttpServer())
      .patch('/solicitudes-cambio/1')
      .set('X-Rol', 'JP')
      .send({});
    expect(res.status).toBe(200);
  });
});
