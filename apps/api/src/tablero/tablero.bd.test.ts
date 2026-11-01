import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EstadoProyecto, NivelTarea, PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  calcularVariablesKpi,
  claveNombre,
  fechaIsoADate,
  feriadosChileDesde,
  redondear,
  type CostoPorEtapa,
} from '@autofix/core';
import { AppModule } from '../app.module';
import { cargarCalendarioLaboral } from '../calendario/calendario-laboral';
import { Reloj } from '../comun/reloj/reloj';
import { configurarApp } from '../configurar-app';
import { cargarDatosVariablesKpi } from '../kpi/datos-variables-kpi';

describe('Tablero BD integración PostgreSQL', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();

    const modulo: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(Reloj)
      .useValue({ hoy: () => '2026-11-16' })
      .compile();

    app = modulo.createNestApplication();
    configurarApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('filtra por etapa y por profesional comparando costoPorEtapa y atrasadas con la BD real', async () => {
    const sufijo = Date.now();
    const nombreA = `Prof A ${sufijo}`;
    const profA = await prisma.profesional.create({
      data: {
        nombre: nombreA,
        claveNombre: claveNombre(nombreA),
        cargo: 'Mecánico especialista',
        tarifaHora: 25000,
      },
    });

    const nombreB = `Prof B ${sufijo}`;
    const profB = await prisma.profesional.create({
      data: {
        nombre: nombreB,
        claveNombre: claveNombre(nombreB),
        cargo: 'Técnico eléctrico',
        tarifaHora: 30000,
      },
    });

    const proyecto = await prisma.proyecto.create({
      data: {
        nombre: `AutoFix · Tablero BD ${sufijo}`,
        descripcion: 'Test integración tablero',
        responsable: 'Jefe de Proyecto',
        presupuesto: 10000000,
        fechaInicio: new Date('2026-11-02T00:00:00.000Z'),
        fechaFin: new Date('2026-12-31T00:00:00.000Z'),
        estado: EstadoProyecto.EN_CURSO,
        calendario: { create: {} },
      },
      include: { calendario: true },
    });
    const proyectoId = proyecto.id;
    const calendarioId = proyecto.calendario!.id;

    await prisma.feriado.createMany({
      data: feriadosChileDesde('2026-11-02').map((f) => ({
        calendarioId,
        fecha: fechaIsoADate(f.fecha),
        descripcion: f.descripcion,
      })),
      skipDuplicates: true,
    });

    const etapa1 = await prisma.tarea.create({
      data: {
        proyectoId,
        codigo: '1',
        orden: 1,
        nombre: 'Etapa Diagnóstico',
        nivel: NivelTarea.ETAPA,
        duracionDias: 10,
        inicioPlan: new Date('2026-11-02T00:00:00.000Z'),
        finPlan: new Date('2026-11-13T00:00:00.000Z'),
        porcentajeAvance: 50,
      },
    });

    const tarea11 = await prisma.tarea.create({
      data: {
        proyectoId,
        padreId: etapa1.id,
        codigo: '1.1',
        orden: 1,
        nombre: 'Revisión inicial',
        nivel: NivelTarea.ACTIVIDAD,
        duracionDias: 5,
        inicioPlan: new Date('2026-11-02T00:00:00.000Z'),
        finPlan: new Date('2026-11-06T00:00:00.000Z'),
        inicioReal: new Date('2026-11-02T00:00:00.000Z'),
        finReal: new Date('2026-11-06T00:00:00.000Z'),
        porcentajeAvance: 100,
        costoPlan: 500,
        costoReal: 450,
        responsable: 'Prof A',
      },
    });

    const tarea12 = await prisma.tarea.create({
      data: {
        proyectoId,
        padreId: etapa1.id,
        codigo: '1.2',
        orden: 2,
        nombre: 'Escaneo electrónico',
        nivel: NivelTarea.ACTIVIDAD,
        duracionDias: 5,
        inicioPlan: new Date('2026-11-02T00:00:00.000Z'),
        finPlan: new Date('2026-11-06T00:00:00.000Z'),
        porcentajeAvance: 0,
        costoPlan: 1000,
        costoReal: 520,
        responsable: 'Prof B',
      },
    });

    const etapa2 = await prisma.tarea.create({
      data: {
        proyectoId,
        codigo: '2',
        orden: 2,
        nombre: 'Etapa Reparación',
        nivel: NivelTarea.ETAPA,
        duracionDias: 10,
        inicioPlan: new Date('2026-11-23T00:00:00.000Z'),
        finPlan: new Date('2026-12-04T00:00:00.000Z'),
        porcentajeAvance: 0,
      },
    });

    const tarea21 = await prisma.tarea.create({
      data: {
        proyectoId,
        padreId: etapa2.id,
        codigo: '2.1',
        orden: 1,
        nombre: 'Cambio de piezas',
        nivel: NivelTarea.ACTIVIDAD,
        duracionDias: 10,
        inicioPlan: new Date('2026-11-23T00:00:00.000Z'),
        finPlan: new Date('2026-12-04T00:00:00.000Z'),
        porcentajeAvance: 0,
        costoPlan: 1500,
        costoReal: 0,
        responsable: 'Prof A',
      },
    });

    await prisma.asignacion.createMany({
      data: [
        {
          tareaId: tarea11.id,
          profesionalId: profA.id,
          horasPlan: 20,
          horasReales: 18,
          tarifaAplicada: 25,
        },
        {
          tareaId: tarea12.id,
          profesionalId: profB.id,
          horasPlan: 100,
          horasReales: 52,
          tarifaAplicada: 10,
        },
        {
          tareaId: tarea21.id,
          profesionalId: profA.id,
          horasPlan: 60,
          horasReales: 0,
          tarifaAplicada: 25,
        },
      ],
    });

    const kpiCambioTest = await prisma.kpiDefinicion.create({
      data: {
        codigo: 'CAMBIO_PRUEBA_AJ3',
        nombre: 'KPI Cambio Excluido',
        ambito: 'CAMBIO',
        formula: '1',
        unidad: 'NUMERO',
        direccion: 'MAYOR_MEJOR',
        activo: true,
      },
    });

    await prisma.alerta.create({
      data: {
        proyectoId,
        clave: 'KPI:CAMBIO_PRUEBA_AJ3',
        tipo: 'KPI',
        severidad: 'ADVERTENCIA',
        mensaje: 'Alerta de KPI de cambio que debe ser excluida',
        entidad: 'KpiDefinicion',
        entidadId: kpiCambioTest.id,
      },
    });

    const calLaboral = await cargarCalendarioLaboral(prisma, proyectoId);
    const todasTareasDb = await prisma.tarea.findMany({
      where: { proyectoId },
      orderBy: { orden: 'asc' },
    });
    const varsEsperadas = calcularVariablesKpi(
      await cargarDatosVariablesKpi(prisma, proyectoId, calLaboral, '2026-11-16', todasTareasDb),
    );
    const avancePlanEsperado =
      varsEsperadas.valores['AVANCE_PLAN'] !== null &&
      varsEsperadas.valores['AVANCE_PLAN'] !== undefined
        ? redondear(varsEsperadas.valores['AVANCE_PLAN'], 2)
        : null;

    const resSinFiltro = await request(app.getHttpServer())
      .get(`/proyectos/${proyectoId}/tablero`)
      .set('X-Rol', 'JP');
    expect(resSinFiltro.status).toBe(200);
    expect(resSinFiltro.body.tarjetas.avance.plan).toBe(avancePlanEsperado);
    expect(
      resSinFiltro.body.alertas.some(
        (a: { mensaje: string }) => a.mensaje === 'Alerta de KPI de cambio que debe ser excluida',
      ),
    ).toBe(false);
    expect(resSinFiltro.body.carga[0]).toHaveProperty('diaPico');
    expect(resSinFiltro.body.costoPorEtapa).toHaveLength(2);
    expect(
      resSinFiltro.body.costoPorEtapa.find((e: CostoPorEtapa) => e.etapaId === etapa1.id),
    ).toMatchObject({
      etapaId: etapa1.id,
      codigo: '1',
      costoPlan: 1500,
      costoReal: 970,
    });
    expect(
      resSinFiltro.body.costoPorEtapa.find((e: CostoPorEtapa) => e.etapaId === etapa2.id),
    ).toMatchObject({
      etapaId: etapa2.id,
      codigo: '2',
      costoPlan: 1500,
      costoReal: 0,
    });
    expect(resSinFiltro.body.atrasadas).toHaveLength(1);
    expect(resSinFiltro.body.atrasadas[0].tareaId).toBe(tarea12.id);
    expect(resSinFiltro.body.atrasadas[0].diasAtraso).toBeGreaterThan(0);

    const resFiltroEtapa2 = await request(app.getHttpServer())
      .get(`/proyectos/${proyectoId}/tablero?etapaId=${etapa2.id}`)
      .set('X-Rol', 'JP');
    expect(resFiltroEtapa2.status).toBe(200);
    expect(resFiltroEtapa2.body.costoPorEtapa).toHaveLength(1);
    expect(resFiltroEtapa2.body.costoPorEtapa[0].etapaId).toBe(etapa2.id);
    expect(resFiltroEtapa2.body.atrasadas).toHaveLength(0);

    const resFiltroProfB = await request(app.getHttpServer())
      .get(`/proyectos/${proyectoId}/tablero?profesionalId=${profB.id}`)
      .set('X-Rol', 'JP');
    expect(resFiltroProfB.status).toBe(200);
    expect(resFiltroProfB.body.costoPorEtapa).toHaveLength(1);
    expect(resFiltroProfB.body.costoPorEtapa[0].etapaId).toBe(etapa1.id);
    expect(resFiltroProfB.body.costoPorEtapa[0].costoPlan).toBe(1000);
    expect(resFiltroProfB.body.costoPorEtapa[0].costoReal).toBe(520);
    expect(resFiltroProfB.body.atrasadas).toHaveLength(1);
    expect(resFiltroProfB.body.atrasadas[0].tareaId).toBe(tarea12.id);

    const resFiltroProfA = await request(app.getHttpServer())
      .get(`/proyectos/${proyectoId}/tablero?profesionalId=${profA.id}`)
      .set('X-Rol', 'JP');
    expect(resFiltroProfA.status).toBe(200);
    expect(resFiltroProfA.body.costoPorEtapa).toHaveLength(2);
    expect(resFiltroProfA.body.atrasadas).toHaveLength(0);
  });
});
