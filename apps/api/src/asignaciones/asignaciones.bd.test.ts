import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EstadoProyecto, NivelTarea, PrismaClient, TipoAlerta } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../app.module';
import { configurarApp } from '../configurar-app';

describe('Asignaciones y Alertas BD integración PostgreSQL', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();

    const modulo: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = modulo.createNestApplication();
    configurarApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('rechaza asignacion sobre profesional inexistente con 404', async () => {
    const proyecto = await prisma.proyecto.create({
      data: {
        nombre: 'AutoFix · Test P2003',
        descripcion: 'Test P2003',
        responsable: 'JP',
        presupuesto: 1000000,
        fechaInicio: new Date('2026-11-02T00:00:00.000Z'),
        estado: EstadoProyecto.EN_CURSO,
        calendario: { create: {} },
      },
    });

    const tarea = await prisma.tarea.create({
      data: {
        proyectoId: proyecto.id,
        codigo: '1',
        nombre: 'Tarea hoja',
        nivel: NivelTarea.ETAPA,
        duracionDias: 3,
        inicioPlan: new Date('2026-11-02T00:00:00.000Z'),
        finPlan: new Date('2026-11-04T00:00:00.000Z'),
        orden: 1,
      },
    });

    const res = await request(app.getHttpServer())
      .post(`/tareas/${tarea.id}/asignaciones`)
      .set('X-Rol', 'JP')
      .send({ profesionalId: 999999, dedicacion: 50 });

    expect(res.status).toBe(404);
    expect(res.body.mensaje).toBe('El profesional no existe.');
  });

  it('rechaza crear asignacion en proyecto cerrado con 409 PROYECTO_CERRADO', async () => {
    const proyecto = await prisma.proyecto.create({
      data: {
        nombre: 'AutoFix · Test Proyecto Cerrado',
        descripcion: 'Test Cerrado',
        responsable: 'JP',
        presupuesto: 1000000,
        fechaInicio: new Date('2026-11-02T00:00:00.000Z'),
        estado: EstadoProyecto.CERRADO,
        calendario: { create: {} },
      },
    });

    const tarea = await prisma.tarea.create({
      data: {
        proyectoId: proyecto.id,
        codigo: '1',
        nombre: 'Tarea en cerrado',
        nivel: NivelTarea.ETAPA,
        duracionDias: 3,
        inicioPlan: new Date('2026-11-02T00:00:00.000Z'),
        finPlan: new Date('2026-11-04T00:00:00.000Z'),
        orden: 1,
      },
    });

    const prof = await prisma.profesional.create({
      data: {
        nombre: 'Mecánico Test Cerrado',
        claveNombre: 'mecanico test cerrado',
        cargo: 'Mecánico',
        tarifaHora: 10000,
        horasDiarias: 8,
        activo: true,
      },
    });

    const res = await request(app.getHttpServer())
      .post(`/tareas/${tarea.id}/asignaciones`)
      .set('X-Rol', 'JP')
      .send({ profesionalId: prof.id, dedicacion: 50 });

    expect(res.status).toBe(409);
    expect(res.body.codigo).toBe('PROYECTO_CERRADO');
  });

  it('genera alerta de sobreasignacion en dos proyectos abiertos para el mismo profesional', async () => {
    const prof = await prisma.profesional.create({
      data: {
        nombre: 'Profesional Dos Proyectos',
        claveNombre: 'profesional dos proyectos',
        cargo: 'Especialista',
        tarifaHora: 12000,
        horasDiarias: 8,
        activo: true,
      },
    });

    const proyA = await prisma.proyecto.create({
      data: {
        nombre: 'AutoFix · Proyecto A Sobreasignado',
        descripcion: 'A',
        responsable: 'JP',
        presupuesto: 2000000,
        fechaInicio: new Date('2026-11-02T00:00:00.000Z'),
        estado: EstadoProyecto.EN_CURSO,
        calendario: { create: {} },
      },
    });

    const proyB = await prisma.proyecto.create({
      data: {
        nombre: 'AutoFix · Proyecto B Sobreasignado',
        descripcion: 'B',
        responsable: 'JP',
        presupuesto: 2000000,
        fechaInicio: new Date('2026-11-02T00:00:00.000Z'),
        estado: EstadoProyecto.EN_CURSO,
        calendario: { create: {} },
      },
    });

    const tareaA = await prisma.tarea.create({
      data: {
        proyectoId: proyA.id,
        codigo: '1',
        nombre: 'Tarea Proyecto A',
        nivel: NivelTarea.ETAPA,
        duracionDias: 5,
        inicioPlan: new Date('2026-11-02T00:00:00.000Z'),
        finPlan: new Date('2026-11-06T00:00:00.000Z'),
        orden: 1,
      },
    });

    const tareaB = await prisma.tarea.create({
      data: {
        proyectoId: proyB.id,
        codigo: '1',
        nombre: 'Tarea Proyecto B',
        nivel: NivelTarea.ETAPA,
        duracionDias: 5,
        inicioPlan: new Date('2026-11-02T00:00:00.000Z'),
        finPlan: new Date('2026-11-06T00:00:00.000Z'),
        orden: 1,
      },
    });

    const resA = await request(app.getHttpServer())
      .post(`/tareas/${tareaA.id}/asignaciones`)
      .set('X-Rol', 'JP')
      .send({ profesionalId: prof.id, dedicacion: 60 });
    expect(resA.status).toBe(201);

    const resB = await request(app.getHttpServer())
      .post(`/tareas/${tareaB.id}/asignaciones`)
      .set('X-Rol', 'JP')
      .send({ profesionalId: prof.id, dedicacion: 60 });
    expect(resB.status).toBe(201);

    const alertasA = await prisma.alerta.findMany({
      where: { proyectoId: proyA.id, tipo: TipoAlerta.SOBREASIGNACION, activa: true },
    });
    const alertasB = await prisma.alerta.findMany({
      where: { proyectoId: proyB.id, tipo: TipoAlerta.SOBREASIGNACION, activa: true },
    });

    expect(alertasA.length).toBeGreaterThanOrEqual(1);
    expect(alertasB.length).toBeGreaterThanOrEqual(1);
    expect(alertasA[0].clave).toBe(`SOBREASIGNACION:${prof.id}:2026-11-02:2026-11-06`);
    expect(alertasB[0].clave).toBe(`SOBREASIGNACION:${prof.id}:2026-11-02:2026-11-06`);

    const delB = await request(app.getHttpServer())
      .delete(`/asignaciones/${resB.body.asignacion.id}`)
      .set('X-Rol', 'JP');
    expect(delB.status).toBe(204);

    const alertasADespues = await prisma.alerta.findMany({
      where: { proyectoId: proyA.id, tipo: TipoAlerta.SOBREASIGNACION, activa: true },
    });
    const alertasBDespues = await prisma.alerta.findMany({
      where: { proyectoId: proyB.id, tipo: TipoAlerta.SOBREASIGNACION, activa: true },
    });

    expect(alertasBDespues.length).toBe(0);
    expect(alertasADespues.length).toBe(0);
  });

  it('H1: eliminar la asignacion en proyecto 3 cierra la alerta en proyecto 3 y actualiza proyecto 1', async () => {
    const prof = await prisma.profesional.create({
      data: {
        nombre: 'Valentina Muñoz H1',
        claveNombre: 'valentina munoz h1',
        cargo: 'Mecánica Senior',
        tarifaHora: 15000,
        horasDiarias: 8,
        activo: true,
      },
    });

    const proy1 = await prisma.proyecto.create({
      data: {
        nombre: 'AutoFix · Proyecto 1 H1',
        descripcion: 'P1',
        responsable: 'JP',
        presupuesto: 5000000,
        fechaInicio: new Date('2026-11-02T00:00:00.000Z'),
        estado: EstadoProyecto.EN_CURSO,
        calendario: { create: {} },
      },
    });

    const proy3 = await prisma.proyecto.create({
      data: {
        nombre: 'AutoFix · Proyecto 3 H1',
        descripcion: 'P3',
        responsable: 'JP',
        presupuesto: 5000000,
        fechaInicio: new Date('2026-11-02T00:00:00.000Z'),
        estado: EstadoProyecto.EN_CURSO,
        calendario: { create: {} },
      },
    });

    const tarea1A = await prisma.tarea.create({
      data: {
        proyectoId: proy1.id,
        codigo: '1.1',
        nombre: 'Tarea 1A',
        nivel: NivelTarea.ETAPA,
        duracionDias: 5,
        fechaFija: new Date('2026-11-09T00:00:00.000Z'),
        orden: 1,
      },
    });

    const tarea1B = await prisma.tarea.create({
      data: {
        proyectoId: proy1.id,
        codigo: '1.2',
        nombre: 'Tarea 1B',
        nivel: NivelTarea.ETAPA,
        duracionDias: 5,
        fechaFija: new Date('2026-11-12T00:00:00.000Z'),
        orden: 2,
      },
    });

    const tarea3 = await prisma.tarea.create({
      data: {
        proyectoId: proy3.id,
        codigo: '1.1',
        nombre: 'Tarea 3',
        nivel: NivelTarea.ETAPA,
        duracionDias: 5,
        fechaFija: new Date('2026-11-10T00:00:00.000Z'),
        orden: 1,
      },
    });

    await request(app.getHttpServer())
      .post(`/tareas/${tarea1A.id}/asignaciones`)
      .set('X-Rol', 'JP')
      .send({ profesionalId: prof.id, dedicacion: 60 });

    await request(app.getHttpServer())
      .post(`/tareas/${tarea1B.id}/asignaciones`)
      .set('X-Rol', 'JP')
      .send({ profesionalId: prof.id, dedicacion: 60 });

    const alertas1Inicial = await prisma.alerta.findMany({
      where: { proyectoId: proy1.id, tipo: TipoAlerta.SOBREASIGNACION, activa: true },
    });
    expect(alertas1Inicial).toHaveLength(1);
    expect(alertas1Inicial[0].clave).toBe(`SOBREASIGNACION:${prof.id}:2026-11-12:2026-11-13`);

    const resAsig3 = await request(app.getHttpServer())
      .post(`/tareas/${tarea3.id}/asignaciones`)
      .set('X-Rol', 'JP')
      .send({ profesionalId: prof.id, dedicacion: 60 });
    expect(resAsig3.status).toBe(201);

    const alertas3Antes = await prisma.alerta.findMany({
      where: { proyectoId: proy3.id, tipo: TipoAlerta.SOBREASIGNACION, activa: true },
    });
    expect(alertas3Antes).toHaveLength(1);
    expect(alertas3Antes[0].clave).toBe(`SOBREASIGNACION:${prof.id}:2026-11-10:2026-11-16`);

    const del3 = await request(app.getHttpServer())
      .delete(`/asignaciones/${resAsig3.body.asignacion.id}`)
      .set('X-Rol', 'JP');
    expect(del3.status).toBe(204);

    const alertas3Despues = await prisma.alerta.findMany({
      where: { proyectoId: proy3.id, tipo: TipoAlerta.SOBREASIGNACION, activa: true },
    });
    expect(alertas3Despues).toHaveLength(0);

    const alertas1Despues = await prisma.alerta.findMany({
      where: { proyectoId: proy1.id, tipo: TipoAlerta.SOBREASIGNACION, activa: true },
    });
    expect(alertas1Despues).toHaveLength(1);
    expect(alertas1Despues[0].clave).toBe(`SOBREASIGNACION:${prof.id}:2026-11-12:2026-11-13`);
  });
});
