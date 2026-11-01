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

    await prisma.kpiDefinicion.upsert({
      where: { codigo: 'SPI' },
      update: {},
      create: {
        codigo: 'SPI',
        nombre: 'Índice de desempeño del cronograma',
        formula: 'EV / PV',
        unidad: 'INDICE',
        meta: 1,
        direccion: 'MAYOR_MEJOR',
        ambito: 'PROYECTO',
        esAdicional: false,
      },
    });

    const kpisCambio = [
      {
        codigo: 'CAMBIO_TOTAL',
        formula: 'SC_TOTAL',
        nombre: 'Total solicitudes',
        esAdicional: false,
      },
      {
        codigo: 'CAMBIO_APROBADAS',
        formula: 'SC_APROBADAS',
        nombre: 'Solicitudes aprobadas',
        esAdicional: false,
      },
      {
        codigo: 'CAMBIO_RECHAZADAS',
        formula: 'SC_RECHAZADAS',
        nombre: 'Solicitudes rechazadas',
        esAdicional: false,
      },
      {
        codigo: 'CAMBIO_ABIERTAS',
        formula: 'SC_ABIERTAS',
        nombre: 'Solicitudes abiertas',
        esAdicional: false,
      },
      {
        codigo: 'CAMBIO_TIEMPO_EVAL',
        formula: 'SC_TIEMPO_EVAL_PROM',
        nombre: 'Tiempo promedio de evaluación',
        esAdicional: false,
      },
      {
        codigo: 'CAMBIO_ETAPAS_VENCIDAS',
        formula: 'SC_ETAPAS_VENCIDAS',
        nombre: 'Etapas vencidas',
        esAdicional: false,
      },
      {
        codigo: 'CAMBIO_IMPACTO_COSTO',
        formula: 'SC_IMPACTO_COSTO_TOTAL',
        nombre: 'Impacto en costo total',
        esAdicional: false,
      },
      {
        codigo: 'CAMBIO_IMPACTO_DIAS',
        formula: 'SC_IMPACTO_DIAS_TOTAL',
        nombre: 'Impacto en días total',
        esAdicional: false,
      },
      {
        codigo: 'CAMBIO_ACC_CORRECTIVAS',
        formula: 'SC_ACC_CORRECTIVAS_TOTAL',
        nombre: 'Total acciones correctivas',
        esAdicional: false,
      },
      {
        codigo: 'CAMBIO_TIEMPO_CICLO',
        formula: 'SC_TIEMPO_CICLO_PROM',
        nombre: 'Tiempo promedio de ciclo',
        esAdicional: true,
      },
      {
        codigo: 'CAMBIO_PCT_ACCIONES_CERRADAS',
        formula:
          'SC_ACC_CORRECTIVAS_TOTAL > 0 ? (SC_ACC_CORRECTIVAS_CERRADAS / SC_ACC_CORRECTIVAS_TOTAL) * 100 : 100',
        nombre: 'Porcentaje de acciones cerradas',
        esAdicional: true,
      },
      {
        codigo: 'CAMBIO_INDICE_ADOPCION',
        formula: 'SC_ADOPCION_PROM',
        nombre: 'Índice de adopción',
        esAdicional: true,
      },
    ];

    for (const k of kpisCambio) {
      await prisma.kpiDefinicion.upsert({
        where: { codigo: k.codigo },
        update: {},
        create: {
          codigo: k.codigo,
          nombre: k.nombre,
          formula: k.formula,
          unidad: 'NUMERO',
          meta: 0,
          direccion: 'MENOR_MEJOR',
          ambito: 'CAMBIO',
          esAdicional: k.esAdicional,
        },
      });
    }
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

  it('PATCH /kpi/:id con solo ambito: CAMBIO sobre SPI responde 422 y no cambia la fila', async () => {
    const kpiSpi = await prisma.kpiDefinicion.findFirstOrThrow({
      where: { codigo: 'SPI' },
    });
    expect(kpiSpi.ambito).toBe('PROYECTO');

    const res = await request(app.getHttpServer())
      .patch(`/kpi/${kpiSpi.id}`)
      .set('X-Rol', 'JP')
      .send({ ambito: 'CAMBIO' });

    expect(res.status).toBe(422);
    expect(res.body.codigo).toBe('FORMULA_INVALIDA');

    const kpiDespues = await prisma.kpiDefinicion.findUniqueOrThrow({
      where: { id: kpiSpi.id },
    });
    expect(kpiDespues.ambito).toBe('PROYECTO');
  });

  it('completar una etapa crea 12 mediciones de cambio y etapa vencida crea y cierra alerta ETAPA_VENCIDA', async () => {
    const proyecto = await prisma.proyecto.create({
      data: {
        nombre: 'AutoFix · Test KPI Cambio BD',
        descripcion: 'Test integración kpi cambio y etapa vencida',
        responsable: 'Jefe de Proyecto',
        presupuesto: 15000000,
        fechaInicio: new Date('2026-10-01T00:00:00.000Z'),
        fechaFin: new Date('2026-12-31T00:00:00.000Z'),
        estado: EstadoProyecto.EN_CURSO,
        calendario: { create: {} },
      },
    });
    const proyectoId = proyecto.id;

    const resCrear = await request(app.getHttpServer())
      .post(`/proyectos/${proyectoId}/solicitudes-cambio`)
      .set('X-Rol', 'JP')
      .send({
        titulo: 'Solicitud para prueba de KPI de cambio',
        descripcion: 'Verificar mediciones de cambio y alertas de etapa vencida',
        justificacion: 'Requisitos del issue #17',
        solicitante: 'Valeria Guardia',
        responsable: 'Carlos Morales',
        prioridad: 'ALTA',
        categoria: 'COSTO',
        probabilidadRiesgo: 4,
        impactoRiesgo: 3,
      });
    expect(resCrear.status).toBe(201);
    const solicitudId = resCrear.body.id;

    const resIniciar1 = await request(app.getHttpServer())
      .post(`/solicitudes-cambio/${solicitudId}/etapas/1/iniciar`)
      .set('X-Rol', 'CC');
    expect(resIniciar1.status).toBe(200);

    const medicionesAntesCambio = await prisma.kpiMedicion.count({
      where: { proyectoId, kpi: { ambito: 'CAMBIO' } },
    });
    const medicionesAntesProyecto = await prisma.kpiMedicion.count({
      where: { proyectoId, kpi: { ambito: 'PROYECTO' } },
    });

    const resCompletar1 = await request(app.getHttpServer())
      .post(`/solicitudes-cambio/${solicitudId}/etapas/1/completar`)
      .set('X-Rol', 'CC');
    expect(resCompletar1.status).toBe(200);

    const medicionesDespuesCambio = await prisma.kpiMedicion.count({
      where: { proyectoId, kpi: { ambito: 'CAMBIO' } },
    });
    const medicionesDespuesProyecto = await prisma.kpiMedicion.count({
      where: { proyectoId, kpi: { ambito: 'PROYECTO' } },
    });

    expect(medicionesDespuesCambio - medicionesAntesCambio).toBe(12);
    expect(medicionesDespuesProyecto - medicionesAntesProyecto).toBe(0);

    const resIniciar2 = await request(app.getHttpServer())
      .post(`/solicitudes-cambio/${solicitudId}/etapas/2/iniciar`)
      .set('X-Rol', 'CC');
    expect(resIniciar2.status).toBe(200);

    const resActualizarEtapa2 = await request(app.getHttpServer())
      .patch(`/solicitudes-cambio/${solicitudId}/etapas/2`)
      .set('X-Rol', 'CC')
      .send({
        fechaFin: '2026-10-30',
      });
    expect(resActualizarEtapa2.status).toBe(200);
    const etapa2Id = resActualizarEtapa2.body.id;

    const claveAlertaVencida = `ETAPA_VENCIDA:${etapa2Id}`;
    const alertaVencida = await prisma.alerta.findFirst({
      where: {
        proyectoId,
        tipo: TipoAlerta.ETAPA_VENCIDA,
        clave: claveAlertaVencida,
        activa: true,
      },
    });
    expect(alertaVencida).not.toBeNull();
    expect(alertaVencida?.severidad).toBe(SeveridadAlerta.ADVERTENCIA);

    const resCompletar2 = await request(app.getHttpServer())
      .post(`/solicitudes-cambio/${solicitudId}/etapas/2/completar`)
      .set('X-Rol', 'CC');
    expect(resCompletar2.status).toBe(200);

    const alertaDespues = await prisma.alerta.findFirst({
      where: { id: alertaVencida!.id },
    });
    expect(alertaDespues?.activa).toBe(false);
    expect(alertaDespues?.cerradaEn).not.toBeNull();

    await prisma.solicitudCambio.deleteMany({ where: { proyectoId } });
    await prisma.kpiMedicion.deleteMany({ where: { proyectoId } });
    await prisma.alerta.deleteMany({ where: { proyectoId } });
    await prisma.proyecto.delete({ where: { id: proyectoId } });
  });
});
