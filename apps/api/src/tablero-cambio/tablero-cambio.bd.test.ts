import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  AmbitoKpi,
  CategoriaCambio,
  EstadoEtapa,
  EstadoProyecto,
  EstadoSolicitud,
  PrismaClient,
  Prioridad,
} from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NOMBRES_ETAPAS, fechaIsoADate, feriadosChileDesde } from '@autofix/core';
import { AppModule } from '../app.module';
import { Reloj } from '../comun/reloj/reloj';
import { configurarApp } from '../configurar-app';
import { PasoKpi } from '../recalculo/paso-kpi';

describe('TableroCambio BD integración PostgreSQL (A6)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let pasoKpi: PasoKpi;
  let proyectoId: number;

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

    pasoKpi = app.get(PasoKpi);

    const kpisCambioDef = [
      { codigo: 'CAMBIO_TOTAL', formula: 'SC_TOTAL', nombre: 'Total solicitudes' },
      { codigo: 'CAMBIO_APROBADAS', formula: 'SC_APROBADAS', nombre: 'Solicitudes aprobadas' },
      { codigo: 'CAMBIO_RECHAZADAS', formula: 'SC_RECHAZADAS', nombre: 'Solicitudes rechazadas' },
      { codigo: 'CAMBIO_ABIERTAS', formula: 'SC_ABIERTAS', nombre: 'Solicitudes abiertas' },
      {
        codigo: 'CAMBIO_TIEMPO_CICLO_PROM',
        formula: 'SC_TIEMPO_CICLO_PROM',
        nombre: 'Tiempo ciclo',
      },
      {
        codigo: 'CAMBIO_TIEMPO_EVAL_PROM',
        formula: 'SC_TIEMPO_EVAL_PROM',
        nombre: 'Tiempo evaluación',
      },
      {
        codigo: 'CAMBIO_ETAPAS_VENCIDAS',
        formula: 'SC_ETAPAS_VENCIDAS',
        nombre: 'Etapas vencidas',
      },
      {
        codigo: 'CAMBIO_IMPACTO_COSTO_TOTAL',
        formula: 'SC_IMPACTO_COSTO_TOTAL',
        nombre: 'Impacto costo',
      },
      {
        codigo: 'CAMBIO_IMPACTO_DIAS_TOTAL',
        formula: 'SC_IMPACTO_DIAS_TOTAL',
        nombre: 'Impacto días',
      },
      {
        codigo: 'CAMBIO_ACC_CORRECTIVAS_CERRADAS_PCT',
        formula: 'SC_ACC_CORRECTIVAS_CERRADAS / SC_ACC_CORRECTIVAS_TOTAL * 100',
        nombre: 'Acciones correctivas cerradas',
      },
      { codigo: 'CAMBIO_RIESGO_ALTO', formula: 'SC_RIESGO_ALTO', nombre: 'Riesgo alto' },
      {
        codigo: 'CAMBIO_INDICE_ADOPCION',
        formula: 'SC_ADOPCION_PROM',
        nombre: 'Índice de adopción',
      },
    ];

    for (const k of kpisCambioDef) {
      await prisma.kpiDefinicion.upsert({
        where: { codigo: k.codigo },
        update: {},
        create: {
          codigo: k.codigo,
          nombre: k.nombre,
          formula: k.formula,
          unidad: 'NUMERO',
          meta: 80,
          direccion: 'MAYOR_MEJOR',
          ambito: AmbitoKpi.CAMBIO,
          esAdicional: false,
        },
      });
    }
  });

  afterAll(async () => {
    if (proyectoId) {
      await prisma.kpiMedicion.deleteMany({ where: { proyectoId } });
      await prisma.alerta.deleteMany({ where: { proyectoId } });
      await prisma.solicitudCambio.deleteMany({ where: { proyectoId } });
      await prisma.feriado.deleteMany({ where: { calendario: { proyecto: { id: proyectoId } } } });
      await prisma.calendario.deleteMany({ where: { proyectoId } });
      await prisma.proyecto.deleteMany({ where: { id: proyectoId } });
    }
    await prisma.kpiMedicion.deleteMany({ where: { kpi: { ambito: AmbitoKpi.CAMBIO } } });
    await prisma.kpiDefinicion.deleteMany({ where: { ambito: AmbitoKpi.CAMBIO } });
    await app.close();
    await prisma.$disconnect();
  });

  it('verifica tablero con seed: embudo, riesgos altos, etapas vencidas, adopcion, filtro responsable y avance etapa SC-001', async () => {
    const sufijo = Date.now();
    const proyecto = await prisma.proyecto.create({
      data: {
        nombre: `AutoFix · Tablero Cambio BD ${sufijo}`,
        descripcion: 'Test integración tablero cambio',
        responsable: 'Valeria Guardia',
        presupuesto: 45000000,
        fechaInicio: new Date('2026-10-01T00:00:00.000Z'),
        fechaFin: new Date('2026-12-31T00:00:00.000Z'),
        estado: EstadoProyecto.EN_CURSO,
        calendario: { create: {} },
      },
      include: { calendario: true },
    });
    proyectoId = proyecto.id;
    const calendarioId = proyecto.calendario!.id;

    await prisma.feriado.createMany({
      data: feriadosChileDesde('2026-10-01').map((f) => ({
        calendarioId,
        fecha: fechaIsoADate(f.fecha),
        descripcion: f.descripcion,
      })),
      skipDuplicates: true,
    });

    const crearEtapas = (config: {
      completadas?: number[];
      omitidas?: number[];
      enCurso?: number;
      fechas?: Record<
        number,
        { inicio?: string; fin?: string; iniciada?: string; completada?: string }
      >;
      adopcion?: number;
    }) => {
      const etapas = [];
      for (let n = 1; n <= 10; n += 1) {
        let estado: EstadoEtapa = EstadoEtapa.PENDIENTE;
        if (config.completadas?.includes(n)) estado = EstadoEtapa.COMPLETADA;
        else if (config.omitidas?.includes(n)) estado = EstadoEtapa.OMITIDA;
        else if (config.enCurso === n) estado = EstadoEtapa.EN_CURSO;

        const f = config.fechas?.[n];
        etapas.push({
          numero: n,
          nombre: NOMBRES_ETAPAS[n] ?? `Etapa ${n}`,
          estado,
          fechaInicio: f?.inicio ? fechaIsoADate(f.inicio) : null,
          fechaFin: f?.fin ? fechaIsoADate(f.fin) : null,
          fechaIniciada: f?.iniciada ? fechaIsoADate(f.iniciada) : null,
          fechaCompletada: f?.completada ? fechaIsoADate(f.completada) : null,
          porcentajeAdopcion: n === 10 && config.adopcion !== undefined ? config.adopcion : null,
        });
      }
      return etapas;
    };

    const sc1 = await prisma.solicitudCambio.create({
      data: {
        proyectoId,
        codigo: 'SC-001',
        titulo: 'Ampliación de memoria en servidores de taller',
        descripcion: 'Se requiere ampliar memoria RAM',
        justificacion: 'Evitar degradación',
        solicitante: 'Jefe de Taller',
        responsable: 'Carlos Morales',
        prioridad: Prioridad.MEDIA,
        categoria: CategoriaCambio.RECURSO,
        probabilidadRiesgo: 2,
        impactoRiesgo: 3,
        fechaRegistro: new Date('2026-10-25T09:00:00.000Z'),
        estado: EstadoSolicitud.REGISTRADA,
        etapaActual: 1,
        etapas: {
          create: crearEtapas({
            enCurso: 1,
            fechas: {
              1: { inicio: '2026-10-25', fin: '2026-10-30', iniciada: '2026-10-25' },
            },
          }),
        },
      },
    });

    await prisma.solicitudCambio.create({
      data: {
        proyectoId,
        codigo: 'SC-002',
        titulo: 'Integración de pasarela de pago web',
        descripcion: 'Permitir el pago desde la web',
        justificacion: 'Reducir filas',
        solicitante: 'Gerente Comercial',
        responsable: 'Valeria Guardia',
        prioridad: Prioridad.ALTA,
        categoria: CategoriaCambio.ALCANCE,
        probabilidadRiesgo: 3,
        impactoRiesgo: 4,
        fechaRegistro: new Date('2026-10-20T10:00:00.000Z'),
        estado: EstadoSolicitud.EN_EVALUACION,
        etapaActual: 2,
        etapas: {
          create: crearEtapas({
            completadas: [1],
            enCurso: 2,
            fechas: {
              1: {
                inicio: '2026-10-20',
                fin: '2026-10-22',
                iniciada: '2026-10-20',
                completada: '2026-10-22',
              },
              2: { inicio: '2026-10-22', fin: '2026-11-20', iniciada: '2026-10-22' },
            },
          }),
        },
      },
    });

    await prisma.solicitudCambio.create({
      data: {
        proyectoId,
        codigo: 'SC-003',
        titulo: 'Incorporación de escáneres OBD-II Bluetooth',
        descripcion: 'Nuevos lectores inalámbricos',
        justificacion: 'Diagnóstico en bahía',
        solicitante: 'Jefe de Diagnóstico',
        responsable: 'Carlos Morales',
        prioridad: Prioridad.ALTA,
        categoria: CategoriaCambio.COSTO,
        probabilidadRiesgo: 2,
        impactoRiesgo: 4,
        fechaRegistro: new Date('2026-10-15T11:00:00.000Z'),
        fechaDecision: new Date('2026-10-28T14:00:00.000Z'),
        estado: EstadoSolicitud.APROBADA,
        etapaActual: 4,
        etapas: {
          create: crearEtapas({
            completadas: [1, 2, 3],
            enCurso: 4,
            fechas: {
              1: { iniciada: '2026-10-15', completada: '2026-10-17' },
              2: { iniciada: '2026-10-17', completada: '2026-10-19' },
              3: { iniciada: '2026-10-19', completada: '2026-10-21' },
              4: { iniciada: '2026-10-28', fin: '2026-11-25' },
            },
          }),
        },
      },
    });

    await prisma.solicitudCambio.create({
      data: {
        proyectoId,
        codigo: 'SC-004',
        titulo: 'Reemplazo total de tabletas de mecánicos',
        descripcion: 'Sustitución por modelos gama alta',
        justificacion: 'Preferencia de marca',
        solicitante: 'Mecánico Senior',
        responsable: 'Valeria Guardia',
        prioridad: Prioridad.BAJA,
        categoria: CategoriaCambio.COSTO,
        probabilidadRiesgo: 4,
        impactoRiesgo: 4,
        fechaRegistro: new Date('2026-10-18T16:00:00.000Z'),
        fechaDecision: new Date('2026-10-29T17:00:00.000Z'),
        motivoRechazo: 'Costo excesivo',
        estado: EstadoSolicitud.RECHAZADA,
        etapaActual: 4,
        etapas: {
          create: crearEtapas({
            completadas: [1, 2, 3],
            fechas: {
              1: { iniciada: '2026-10-18', completada: '2026-10-20' },
              2: { iniciada: '2026-10-20', completada: '2026-10-22' },
              3: { iniciada: '2026-10-22', completada: '2026-10-24' },
            },
          }),
        },
      },
    });

    await prisma.solicitudCambio.create({
      data: {
        proyectoId,
        codigo: 'SC-005',
        titulo: 'Protocolo de sanitización y entrega limpia de vehículos',
        descripcion: 'Procedimiento de limpieza',
        justificacion: 'Mejorar satisfacción',
        solicitante: 'Atención al Cliente',
        responsable: 'Valeria Guardia',
        prioridad: Prioridad.MEDIA,
        categoria: CategoriaCambio.CALIDAD,
        probabilidadRiesgo: 1,
        impactoRiesgo: 2,
        fechaRegistro: new Date('2026-10-01T08:30:00.000Z'),
        fechaDecision: new Date('2026-10-10T11:00:00.000Z'),
        fechaCierre: new Date('2026-10-30T18:00:00.000Z'),
        estado: EstadoSolicitud.CERRADA,
        etapaActual: 10,
        etapas: {
          create: crearEtapas({
            completadas: [1, 2, 3, 5, 6, 7, 9, 10],
            omitidas: [4, 8],
            adopcion: 85,
            fechas: {
              1: { iniciada: '2026-10-01', completada: '2026-10-03' },
              2: { iniciada: '2026-10-03', completada: '2026-10-05' },
              3: { iniciada: '2026-10-05', completada: '2026-10-07' },
              5: { iniciada: '2026-10-11', completada: '2026-10-13' },
              6: { iniciada: '2026-10-13', completada: '2026-10-15' },
              7: { iniciada: '2026-10-15', completada: '2026-10-17' },
              9: { iniciada: '2026-10-26', completada: '2026-10-28' },
              10: { iniciada: '2026-10-28', completada: '2026-10-30' },
            },
          }),
        },
      },
    });

    await prisma.$transaction(async (tx) => {
      await pasoKpi.medirAmbitoCambio(tx, proyectoId);
    });

    const resSinFiltro = await request(app.getHttpServer())
      .get(`/proyectos/${proyectoId}/tablero-cambio`)
      .set('X-Rol', 'JP');

    expect(resSinFiltro.status).toBe(200);

    const alcanzaron = resSinFiltro.body.embudo.map((e: { alcanzaron: number }) => e.alcanzaron);
    expect(alcanzaron).toEqual([5, 4, 3, 2, 1, 1, 1, 1, 1, 1]);

    const codigosRiesgosAltos = resSinFiltro.body.alertas.riesgosAltos.map(
      (r: { codigo: string }) => r.codigo,
    );
    expect(codigosRiesgosAltos).toEqual(['SC-002']);

    const codigosEtapasVencidas = resSinFiltro.body.alertas.etapasVencidas.map(
      (e: { codigo: string }) => e.codigo,
    );
    expect(codigosEtapasVencidas).toEqual(['SC-001']);

    expect(resSinFiltro.body.adopcion).toEqual({
      items: [
        {
          solicitudId: expect.any(Number),
          codigo: 'SC-005',
          titulo: 'Protocolo de sanitización y entrega limpia de vehículos',
          porcentaje: 85,
        },
      ],
      promedio: 85,
    });

    const resValeria = await request(app.getHttpServer())
      .get(`/proyectos/${proyectoId}/tablero-cambio?responsable=valeria`)
      .set('X-Rol', 'JP');

    expect(resValeria.status).toBe(200);
    const solicitudesEnMatriz = resValeria.body.matrizRiesgo.flatMap(
      (c: { solicitudes: { codigo: string }[] }) => c.solicitudes,
    );
    expect(solicitudesEnMatriz).toHaveLength(1);
    expect(solicitudesEnMatriz[0].codigo).toBe('SC-002');

    const totalMedicionesAntes = resSinFiltro.body.kpis[0].historial.length;

    const resComp = await request(app.getHttpServer())
      .post(`/solicitudes-cambio/${sc1.id}/etapas/1/completar`)
      .set('X-Rol', 'CC');
    expect(resComp.status).toBe(200);

    const resIni = await request(app.getHttpServer())
      .post(`/solicitudes-cambio/${sc1.id}/etapas/2/iniciar`)
      .set('X-Rol', 'CC');
    expect(resIni.status).toBe(200);

    const resDespues = await request(app.getHttpServer())
      .get(`/proyectos/${proyectoId}/tablero-cambio`)
      .set('X-Rol', 'JP');

    expect(resDespues.status).toBe(200);
    expect(resDespues.body.embudo[1].alcanzaron).toBe(5);

    const totalMedicionesDespues = resDespues.body.kpis[0].historial.length;
    expect(totalMedicionesDespues).toBeGreaterThanOrEqual(totalMedicionesAntes + 1);
  });
});
