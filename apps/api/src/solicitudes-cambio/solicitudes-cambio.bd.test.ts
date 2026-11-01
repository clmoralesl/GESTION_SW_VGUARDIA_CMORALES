import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EstadoProyecto, PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../app.module';
import { configurarApp } from '../configurar-app';
import { Reloj } from '../comun/reloj/reloj';

describe('SolicitudesCambio BD integración PostgreSQL', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let proyectoId: number;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();

    const modulo: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(Reloj)
      .useValue({ hoy: () => '2026-10-31' })
      .compile();

    app = modulo.createNestApplication();
    configurarApp(app);
    await app.init();

    const proyecto = await prisma.proyecto.create({
      data: {
        nombre: 'AutoFix · Test Solicitudes BD',
        descripcion: 'Proyecto de prueba para solicitudes de cambio',
        responsable: 'Jefe de Proyecto',
        presupuesto: 20000000,
        fechaInicio: new Date('2026-11-02T00:00:00.000Z'),
        fechaFin: new Date('2027-02-28T00:00:00.000Z'),
        estado: EstadoProyecto.EN_CURSO,
        calendario: { create: {} },
      },
    });
    proyectoId = proyecto.id;
  });

  afterAll(async () => {
    if (proyectoId) {
      await prisma.solicitudCambio.deleteMany({ where: { proyectoId } });
      await prisma.proyecto.delete({ where: { id: proyectoId } });
    }
    await app.close();
    await prisma.$disconnect();
  });

  it('crea solicitudes en paralelo asignando codigos correlativos sin duplicados', async () => {
    const payload = {
      titulo: 'Solicitud concurrente',
      descripcion: 'Detalle de prueba concurrente',
      justificacion: 'Justificacion de prueba concurrente',
      solicitante: 'Mecánico',
      responsable: 'Carlos Morales',
      prioridad: 'MEDIA',
      categoria: 'ALCANCE',
      probabilidadRiesgo: 2,
      impactoRiesgo: 3,
    };

    const [res1, res2] = await Promise.all([
      request(app.getHttpServer())
        .post(`/proyectos/${proyectoId}/solicitudes-cambio`)
        .set('X-Rol', 'JP')
        .send({ ...payload, titulo: 'Concurrente 1' }),
      request(app.getHttpServer())
        .post(`/proyectos/${proyectoId}/solicitudes-cambio`)
        .set('X-Rol', 'JP')
        .send({ ...payload, titulo: 'Concurrente 2' }),
    ]);

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);

    const codigos = [res1.body.codigo, res2.body.codigo].sort();
    expect(codigos).toEqual(['SC-001', 'SC-002']);
    expect(res1.body.etapas).toHaveLength(10);
    expect(res2.body.etapas).toHaveLength(10);
  });

  it('ejecuta flujo completo de 10 etapas con transiciones y validaciones', async () => {
    const resCrear = await request(app.getHttpServer())
      .post(`/proyectos/${proyectoId}/solicitudes-cambio`)
      .set('X-Rol', 'JP')
      .send({
        titulo: 'Flujo completo',
        descripcion: 'Prueba de transiciones de las 10 etapas',
        justificacion: 'Validar reglas de negocio y restricciones',
        solicitante: 'Valeria Guardia',
        responsable: 'Carlos Morales',
        prioridad: 'ALTA',
        categoria: 'CALIDAD',
        probabilidadRiesgo: 3,
        impactoRiesgo: 4,
      });
    expect(resCrear.status).toBe(201);
    const solId = resCrear.body.id;

    const resIni1 = await request(app.getHttpServer())
      .post(`/solicitudes-cambio/${solId}/etapas/1/iniciar`)
      .set('X-Rol', 'CC');
    expect(resIni1.status).toBe(200);

    const resComp1 = await request(app.getHttpServer())
      .post(`/solicitudes-cambio/${solId}/etapas/1/completar`)
      .set('X-Rol', 'CC');
    expect(resComp1.status).toBe(200);

    const resIni2 = await request(app.getHttpServer())
      .post(`/solicitudes-cambio/${solId}/etapas/2/iniciar`)
      .set('X-Rol', 'CC');
    expect(resIni2.status).toBe(200);
    expect(resIni2.body.estado).toBe('EN_EVALUACION');

    const resInv4 = await request(app.getHttpServer())
      .post(`/solicitudes-cambio/${solId}/etapas/4/iniciar`)
      .set('X-Rol', 'CC');
    expect(resInv4.status).toBe(409);
    expect(resInv4.body.codigo).toBe('TRANSICION_INVALIDA');

    const resComp2 = await request(app.getHttpServer())
      .post(`/solicitudes-cambio/${solId}/etapas/2/completar`)
      .set('X-Rol', 'CC');
    expect(resComp2.status).toBe(200);

    await request(app.getHttpServer())
      .post(`/solicitudes-cambio/${solId}/etapas/3/iniciar`)
      .set('X-Rol', 'CC');
    await request(app.getHttpServer())
      .post(`/solicitudes-cambio/${solId}/etapas/3/completar`)
      .set('X-Rol', 'CC');

    await prisma.solicitudCambio.update({
      where: { id: solId },
      data: { estado: 'APROBADA', fechaDecision: new Date() },
    });

    const resOmitirSinComentario = await request(app.getHttpServer())
      .post(`/solicitudes-cambio/${solId}/etapas/4/omitir`)
      .set('X-Rol', 'CC')
      .send({ comentario: '   ' });
    expect(resOmitirSinComentario.status).toBe(400);

    const resOmitir4 = await request(app.getHttpServer())
      .post(`/solicitudes-cambio/${solId}/etapas/4/omitir`)
      .set('X-Rol', 'CC')
      .send({ comentario: 'Planificación previa existente' });
    expect(resOmitir4.status).toBe(200);

    await request(app.getHttpServer())
      .post(`/solicitudes-cambio/${solId}/etapas/5/iniciar`)
      .set('X-Rol', 'CC');
    await request(app.getHttpServer())
      .post(`/solicitudes-cambio/${solId}/etapas/5/completar`)
      .set('X-Rol', 'CC');

    await request(app.getHttpServer())
      .post(`/solicitudes-cambio/${solId}/etapas/6/iniciar`)
      .set('X-Rol', 'CC');
    const resComp6 = await request(app.getHttpServer())
      .post(`/solicitudes-cambio/${solId}/etapas/6/completar`)
      .set('X-Rol', 'CC');
    expect(resComp6.status).toBe(200);
    expect(resComp6.body.estado).toBe('IMPLEMENTADA');

    await request(app.getHttpServer())
      .post(`/solicitudes-cambio/${solId}/etapas/7/iniciar`)
      .set('X-Rol', 'CC');
    await request(app.getHttpServer())
      .post(`/solicitudes-cambio/${solId}/etapas/7/completar`)
      .set('X-Rol', 'CC');

    await request(app.getHttpServer())
      .post(`/solicitudes-cambio/${solId}/etapas/8/omitir`)
      .set('X-Rol', 'CC')
      .send({ comentario: 'Resultados informados en comité' });

    await request(app.getHttpServer())
      .post(`/solicitudes-cambio/${solId}/etapas/9/iniciar`)
      .set('X-Rol', 'CC');

    const resAccion = await request(app.getHttpServer())
      .post(`/solicitudes-cambio/${solId}/etapas/9/acciones-correctivas`)
      .set('X-Rol', 'CC')
      .send({
        descripcion: 'Ajuste de torque en herramientas',
        responsable: 'Mecánico 1',
        fechaCompromiso: '2026-11-15',
      });
    expect(resAccion.status).toBe(201);
    const accionId = resAccion.body.id;

    const resComp9Falla = await request(app.getHttpServer())
      .post(`/solicitudes-cambio/${solId}/etapas/9/completar`)
      .set('X-Rol', 'CC');
    expect(resComp9Falla.status).toBe(409);
    expect(resComp9Falla.body.detalles.motivo).toBe('ACCIONES_ABIERTAS');

    const resCerrarAccion = await request(app.getHttpServer())
      .patch(`/acciones-correctivas/${accionId}`)
      .set('X-Rol', 'CC')
      .send({ estado: 'CERRADA' });
    expect(resCerrarAccion.status).toBe(200);
    expect(resCerrarAccion.body.fechaCierre).toBe('2026-10-31');

    const resComp9Exito = await request(app.getHttpServer())
      .post(`/solicitudes-cambio/${solId}/etapas/9/completar`)
      .set('X-Rol', 'CC');
    expect(resComp9Exito.status).toBe(200);

    await request(app.getHttpServer())
      .post(`/solicitudes-cambio/${solId}/etapas/10/iniciar`)
      .set('X-Rol', 'CC');

    const resComp10SinAdopcion = await request(app.getHttpServer())
      .post(`/solicitudes-cambio/${solId}/etapas/10/completar`)
      .set('X-Rol', 'CC');
    expect(resComp10SinAdopcion.status).toBe(409);
    expect(resComp10SinAdopcion.body.detalles.motivo).toBe('ADOPCION_REQUERIDA');

    await request(app.getHttpServer())
      .patch(`/solicitudes-cambio/${solId}/etapas/10`)
      .set('X-Rol', 'CC')
      .send({ porcentajeAdopcion: 92.5 });

    const resComp10Exito = await request(app.getHttpServer())
      .post(`/solicitudes-cambio/${solId}/etapas/10/completar`)
      .set('X-Rol', 'CC');
    expect(resComp10Exito.status).toBe(200);
    expect(resComp10Exito.body.estado).toBe('CERRADA');
    expect(resComp10Exito.body.fechaCierre).not.toBeNull();

    const resAccionTerminal = await request(app.getHttpServer())
      .post(`/solicitudes-cambio/${solId}/etapas/10/iniciar`)
      .set('X-Rol', 'CC');
    expect(resAccionTerminal.status).toBe(409);
    expect(resAccionTerminal.body.detalles.motivo).toBe('SOLICITUD_TERMINAL');
  });

  it('permite adjuntar evidencias reales, descargarlas y rechaza ejecutables falsos', async () => {
    const resCrear = await request(app.getHttpServer())
      .post(`/proyectos/${proyectoId}/solicitudes-cambio`)
      .set('X-Rol', 'JP')
      .send({
        titulo: 'Solicitud para evidencias',
        descripcion: 'Verificar almacenamiento y control mime',
        justificacion: 'Seguridad en subida de ficheros',
        solicitante: 'Valeria Guardia',
        responsable: 'Carlos Morales',
        prioridad: 'MEDIA',
        categoria: 'CALIDAD',
        probabilidadRiesgo: 1,
        impactoRiesgo: 2,
      });
    const solId = resCrear.body.id;

    const bufferPdfValido = Buffer.from('%PDF-1.4\nContenido de prueba');
    const resSubida = await request(app.getHttpServer())
      .post(`/solicitudes-cambio/${solId}/etapas/1/evidencias`)
      .set('X-Rol', 'JP')
      .attach('archivo', bufferPdfValido, 'informe_seguridad.pdf');
    expect(resSubida.status).toBe(201);
    const evidenciaId = resSubida.body.id;

    const resDescarga = await request(app.getHttpServer())
      .get(`/evidencias/${evidenciaId}/descarga`)
      .set('X-Rol', 'CC');
    expect(resDescarga.status).toBe(200);
    expect(resDescarga.headers['content-type']).toContain('application/pdf');
    expect(resDescarga.headers['x-content-type-options']).toBe('nosniff');

    const bufferExeFalso = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03]);
    const resSubidaFalsa = await request(app.getHttpServer())
      .post(`/solicitudes-cambio/${solId}/etapas/1/evidencias`)
      .set('X-Rol', 'JP')
      .attach('archivo', bufferExeFalso, 'virus.pdf');
    expect(resSubidaFalsa.status).toBe(415);
    expect(resSubidaFalsa.body.codigo).toBe('TIPO_ARCHIVO_NO_PERMITIDO');

    const resBorrar = await request(app.getHttpServer())
      .delete(`/evidencias/${evidenciaId}`)
      .set('X-Rol', 'JP');
    expect(resBorrar.status).toBe(204);
  });
});
