import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  EstadoEtapa,
  EstadoProyecto,
  EstadoSolicitud,
  NivelTarea,
  PrismaClient,
  TipoDependencia,
} from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { claveNombre, NOMBRES_ETAPAS } from '@autofix/core';
import { AppModule } from '../app.module';
import { Reloj } from '../comun/reloj/reloj';
import { configurarApp } from '../configurar-app';
import { RecalculoService } from '../recalculo/recalculo.service';

describe('Importaciones BD integración PostgreSQL', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let semillaId: number;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();

    const modulo: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(Reloj)
      .useValue({ hoy: () => '2026-11-01' })
      .compile();

    app = modulo.createNestApplication();
    configurarApp(app);
    await app.init();

    const prof1 = await prisma.profesional.upsert({
      where: { nombre: 'Valeria Guardia Semilla' },
      update: {},
      create: {
        nombre: 'Valeria Guardia Semilla',
        claveNombre: claveNombre('Valeria Guardia Semilla'),
        cargo: 'Jefe de Proyecto',
        tarifaHora: 30000,
      },
    });

    const tipoRec = await prisma.tipoRecurso.upsert({
      where: { nombre: 'Equipamiento' },
      update: {},
      create: { nombre: 'Equipamiento' },
    });

    const rec1 = await prisma.recurso.upsert({
      where: { nombre: 'Escáner automotriz Semilla' },
      update: {},
      create: {
        nombre: 'Escáner automotriz Semilla',
        claveNombre: claveNombre('Escáner automotriz Semilla'),
        tipoRecursoId: tipoRec.id,
        unidad: 'hora',
        costoUnitario: 15000,
      },
    });

    const proyecto = await prisma.proyecto.create({
      data: {
        nombre: `AutoFix · Semilla Importación ${Date.now()}`,
        descripcion: 'Proyecto semilla para prueba de ida y vuelta',
        responsable: 'Valeria Guardia',
        presupuesto: 45000000,
        fechaInicio: new Date('2026-11-02T00:00:00.000Z'),
        estado: EstadoProyecto.PLANIFICADO,
        calendario: {
          create: {
            diasLaborables: [1, 2, 3, 4, 5],
            horasPorDia: 8,
            feriados: {
              create: [
                { fecha: new Date('2026-12-25T00:00:00.000Z'), descripcion: 'Navidad' },
                { fecha: new Date('2027-01-01T00:00:00.000Z'), descripcion: 'Año Nuevo' },
              ],
            },
          },
        },
      },
      include: { calendario: true },
    });
    semillaId = proyecto.id;

    const t1 = await prisma.tarea.create({
      data: {
        proyectoId: proyecto.id,
        nivel: NivelTarea.ETAPA,
        codigo: '1',
        orden: 1,
        nombre: 'Levantamiento inicial',
        duracionDias: 5,
      },
    });

    const t11 = await prisma.tarea.create({
      data: {
        proyectoId: proyecto.id,
        padreId: t1.id,
        nivel: NivelTarea.ACTIVIDAD,
        codigo: '1.1',
        orden: 1,
        nombre: 'Entrevistas de taller',
        duracionDias: 3,
      },
    });

    const t12 = await prisma.tarea.create({
      data: {
        proyectoId: proyecto.id,
        padreId: t1.id,
        nivel: NivelTarea.ACTIVIDAD,
        codigo: '1.2',
        orden: 2,
        nombre: 'Diagramación de procesos',
        duracionDias: 2,
      },
    });

    const t2 = await prisma.tarea.create({
      data: {
        proyectoId: proyecto.id,
        nivel: NivelTarea.ETAPA,
        codigo: '2',
        orden: 2,
        nombre: 'Desarrollo de módulos',
        duracionDias: 10,
      },
    });

    const t21 = await prisma.tarea.create({
      data: {
        proyectoId: proyecto.id,
        padreId: t2.id,
        nivel: NivelTarea.ACTIVIDAD,
        codigo: '2.1',
        orden: 1,
        nombre: 'Módulo de recepción',
        duracionDias: 5,
      },
    });

    const t211 = await prisma.tarea.create({
      data: {
        proyectoId: proyecto.id,
        padreId: t21.id,
        nivel: NivelTarea.SUBACTIVIDAD,
        codigo: '2.1.1',
        orden: 1,
        nombre: 'Formulario de ingreso',
        duracionDias: 5,
      },
    });

    await prisma.dependencia.create({
      data: {
        proyectoId: proyecto.id,
        predecesoraId: t11.id,
        sucesoraId: t12.id,
        tipo: TipoDependencia.FS,
        desfaseDias: 0,
      },
    });

    await prisma.dependencia.create({
      data: {
        proyectoId: proyecto.id,
        predecesoraId: t12.id,
        sucesoraId: t211.id,
        tipo: TipoDependencia.FS,
        desfaseDias: 0,
      },
    });

    await prisma.asignacion.create({
      data: {
        tareaId: t11.id,
        profesionalId: prof1.id,
        dedicacion: 100,
        tarifaAplicada: 30000,
      },
    });

    await prisma.asignacion.create({
      data: {
        tareaId: t211.id,
        recursoId: rec1.id,
        cantidadPlan: 10,
        costoUnitarioAplicado: 15000,
      },
    });

    await prisma.hito.create({
      data: {
        proyectoId: proyecto.id,
        tareaId: t12.id,
        nombre: 'Hito Procesos Aprobados',
        fechaObjetivo: new Date('2026-11-20T00:00:00.000Z'),
      },
    });

    await prisma.solicitudCambio.create({
      data: {
        proyectoId: proyecto.id,
        codigo: 'SC-001',
        titulo: 'Ampliación de alcance módulo taller',
        descripcion: 'Detalle de ampliación',
        justificacion: 'Solicitud del cliente',
        solicitante: 'Valeria Guardia',
        responsable: 'Valeria Guardia',
        prioridad: 'MEDIA',
        categoria: 'ALCANCE',
        probabilidadRiesgo: 2,
        impactoRiesgo: 3,
        estado: EstadoSolicitud.REGISTRADA,
        etapaActual: 1,
        etapas: {
          create: Array.from({ length: 10 }, (_, i) => ({
            numero: i + 1,
            nombre: NOMBRES_ETAPAS[i + 1] ?? `Etapa ${i + 1}`,
            estado: EstadoEtapa.PENDIENTE,
          })),
        },
      },
    });

    const recalculo = app.get(RecalculoService);
    await prisma.$transaction(async (tx) => {
      await recalculo.ejecutar(proyecto.id, tx, {
        rol: 'JP',
        descripcion: 'Inicialización de semilla para test BD',
      });
    });
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('ida y vuelta: exporta el proyecto del seed, importa como nuevo y compara tareas, dependencias, asignaciones, fechaFin y costoPlan', async () => {
    const proyectoOriginal = await prisma.proyecto.findUnique({
      where: { id: semillaId },
      include: {
        tareas: {
          include: {
            asignaciones: true,
          },
        },
        dependencias: true,
        hitos: true,
      },
    });
    expect(proyectoOriginal).not.toBeNull();

    const resExport = await request(app.getHttpServer())
      .get(`/proyectos/${semillaId}/exportacion`)
      .set('X-Rol', 'JP')
      .buffer()
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    expect(resExport.status).toBe(200);
    const bufferExportado = resExport.body as Buffer;
    expect(bufferExportado.length).toBeGreaterThan(0);

    const resImport = await request(app.getHttpServer())
      .post('/importaciones')
      .set('X-Rol', 'JP')
      .attach('archivo', bufferExportado, 'proyecto_semilla_exportado.xlsx');

    expect(resImport.status).toBe(201);
    const nuevoProyectoId = resImport.body.proyectoId as number;
    expect(nuevoProyectoId).toBeGreaterThan(0);
    expect(nuevoProyectoId).not.toBe(semillaId);

    const nuevoProyecto = await prisma.proyecto.findUnique({
      where: { id: nuevoProyectoId },
      include: {
        tareas: {
          include: {
            asignaciones: true,
          },
        },
        dependencias: true,
        hitos: true,
      },
    });
    expect(nuevoProyecto).not.toBeNull();

    expect(nuevoProyecto!.tareas.length).toBe(proyectoOriginal!.tareas.length);
    expect(nuevoProyecto!.dependencias.length).toBe(proyectoOriginal!.dependencias.length);

    const conteoAsigOrig = proyectoOriginal!.tareas.reduce(
      (sum, t) => sum + t.asignaciones.length,
      0,
    );
    const conteoAsigNuevo = nuevoProyecto!.tareas.reduce(
      (sum, t) => sum + t.asignaciones.length,
      0,
    );
    expect(conteoAsigNuevo).toBe(conteoAsigOrig);

    const finOrig = proyectoOriginal!.fechaFin?.toISOString().slice(0, 10);
    const finNuevo = nuevoProyecto!.fechaFin?.toISOString().slice(0, 10);
    expect(finNuevo).toBe(finOrig);

    const costoTotalOrig = proyectoOriginal!.tareas.reduce(
      (sum, t) => sum + Number(t.costoPlan),
      0,
    );
    const costoTotalNuevo = nuevoProyecto!.tareas.reduce((sum, t) => sum + Number(t.costoPlan), 0);
    expect(costoTotalNuevo).toBe(costoTotalOrig);
  });

  it('sin rastro: fuerza un fallo en el recálculo tras insertar tareas y verifica que los conteos no cambian', async () => {
    const resExport = await request(app.getHttpServer())
      .get(`/proyectos/${semillaId}/exportacion`)
      .set('X-Rol', 'JP')
      .buffer()
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    expect(resExport.status).toBe(200);
    const bufferExportado = resExport.body as Buffer;

    const tareasAntes = await prisma.tarea.count();
    const proyectosAntes = await prisma.proyecto.count();
    const dependenciasAntes = await prisma.dependencia.count();
    const asignacionesAntes = await prisma.asignacion.count();
    const feriadosAntes = await prisma.feriado.count();

    const recalculo = app.get(RecalculoService);
    const spyRecalculo = vi
      .spyOn(recalculo, 'ejecutar')
      .mockRejectedValueOnce(new Error('Fallo forzado en recálculo para probar rollback'));

    const resImport = await request(app.getHttpServer())
      .post('/importaciones')
      .set('X-Rol', 'JP')
      .attach('archivo', bufferExportado, 'rollback.xlsx');

    expect(resImport.status).toBe(500);
    spyRecalculo.mockRestore();

    const tareasDespues = await prisma.tarea.count();
    const proyectosDespues = await prisma.proyecto.count();
    const dependenciasDespues = await prisma.dependencia.count();
    const asignacionesDespues = await prisma.asignacion.count();
    const feriadosDespues = await prisma.feriado.count();

    expect(tareasDespues).toBe(tareasAntes);
    expect(proyectosDespues).toBe(proyectosAntes);
    expect(dependenciasDespues).toBe(dependenciasAntes);
    expect(asignacionesDespues).toBe(asignacionesAntes);
    expect(feriadosDespues).toBe(feriadosAntes);
  });
});
