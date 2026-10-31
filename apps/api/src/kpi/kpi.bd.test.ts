import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  EstadoProyecto,
  NivelTarea,
  PrismaClient,
  SeveridadAlerta,
  TipoAlerta,
} from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fechaIsoADate } from '@autofix/core';
import { AppModule } from '../app.module';
import { configurarApp } from '../configurar-app';
import { Reloj } from '../comun/reloj/reloj';

describe('KPI BD integración PostgreSQL', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();

    const modulo: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(Reloj)
      .useValue({ hoy: () => '2026-11-06' })
      .compile();

    app = modulo.createNestApplication();
    configurarApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('registra medicion nueva, crea alerta en rojo y la cierra al volver a verde', async () => {
    const proyecto = await prisma.proyecto.create({
      data: {
        nombre: 'AutoFix · Test KPI BD',
        descripcion: 'Test integración paso KPI y alertas',
        responsable: 'Jefe de Proyecto',
        presupuesto: 10000000,
        fechaInicio: new Date('2026-10-19T00:00:00.000Z'),
        fechaFin: new Date('2026-11-30T00:00:00.000Z'),
        estado: EstadoProyecto.EN_CURSO,
        calendario: { create: {} },
      },
    });
    const proyectoId = proyecto.id;

    const tarea = await prisma.tarea.create({
      data: {
        proyectoId,
        nivel: NivelTarea.ETAPA,
        codigo: '1',
        orden: 1,
        nombre: 'Etapa inicial',
        duracionDias: 5,
        inicioPlan: fechaIsoADate('2026-10-19'),
        finPlan: fechaIsoADate('2026-10-23'),
        porcentajeAvance: 50,
        costoPlan: 1000000,
        costoReal: 1200000,
      },
    });

    const profesional = await prisma.profesional.create({
      data: {
        nombre: 'Ingeniero Test BD',
        claveNombre: 'ingeniero-test-bd',
        cargo: 'Desarrollador',
        tarifaHora: 25000,
        horasDiarias: 8,
      },
    });

    await prisma.asignacion.create({
      data: {
        tareaId: tarea.id,
        profesionalId: profesional.id,
        dedicacion: 100,
        tarifaAplicada: 25000,
      },
    });

    const kpi = await prisma.kpiDefinicion.create({
      data: {
        codigo: `SPI_BD_${Date.now()}`,
        nombre: 'SPI BD Integración',
        ambito: 'PROYECTO',
        formula: 'EV / PV',
        unidad: 'INDICE',
        meta: 1,
        direccion: 'MAYOR_MEJOR',
        umbrales: {
          create: [
            { semaforo: 'VERDE', valorDesde: 0.95 },
            { semaforo: 'AMARILLO', valorDesde: 0.85 },
          ],
        },
      },
    });

    const resPrimerRecalculo = await request(app.getHttpServer())
      .patch(`/tareas/${tarea.id}`)
      .set('X-Rol', 'JP')
      .send({ duracionDias: 5 });
    expect(resPrimerRecalculo.status).toBe(200);

    const mediciones = await prisma.kpiMedicion.findMany({
      where: { proyectoId, kpiId: kpi.id },
      orderBy: { medidoEn: 'desc' },
    });
    expect(mediciones.length).toBeGreaterThanOrEqual(1);
    expect(mediciones[0]?.semaforo).toBe('ROJO');
    expect(Number(mediciones[0]?.valor)).toBe(0.5);

    const claveAlerta = `KPI:${kpi.id}`;
    const alertaEnRojo = await prisma.alerta.findFirst({
      where: {
        proyectoId,
        tipo: TipoAlerta.KPI,
        clave: claveAlerta,
        activa: true,
      },
    });
    expect(alertaEnRojo).not.toBeNull();
    expect(alertaEnRojo?.severidad).toBe(SeveridadAlerta.CRITICA);

    const resSegundoRecalculo = await request(app.getHttpServer())
      .patch(`/tareas/${tarea.id}`)
      .set('X-Rol', 'JP')
      .send({ porcentajeAvance: 100 });
    expect(resSegundoRecalculo.status).toBe(200);

    const medicionesVerde = await prisma.kpiMedicion.findMany({
      where: { proyectoId, kpiId: kpi.id },
      orderBy: { medidoEn: 'desc' },
    });
    expect(medicionesVerde[0]?.semaforo).toBe('VERDE');
    expect(Number(medicionesVerde[0]?.valor)).toBe(1);

    const alertaCerrada = await prisma.alerta.findFirst({
      where: {
        id: alertaEnRojo!.id,
      },
    });
    expect(alertaCerrada?.activa).toBe(false);
    expect(alertaCerrada?.cerradaEn).not.toBeNull();
  });
});
