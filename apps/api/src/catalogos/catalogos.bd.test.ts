import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EstadoProyecto, NivelTarea, Prisma, PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { claveNombre } from '@autofix/core';
import { AppModule } from '../app.module';
import { configurarApp } from '../configurar-app';

describe('Catálogos BD integración PostgreSQL', () => {
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

  it('impide eliminar profesional con asignaciones y conserva asignacion al desactivar', async () => {
    const proyecto = await prisma.proyecto.create({
      data: {
        nombre: 'AutoFix · Test Catálogo BD',
        descripcion: 'Test integración catálogos',
        responsable: 'Jefe de Proyecto',
        presupuesto: 10000000,
        fechaInicio: new Date('2026-11-02T00:00:00.000Z'),
        fechaFin: new Date('2027-03-31T00:00:00.000Z'),
        estado: EstadoProyecto.EN_CURSO,
        calendario: { create: {} },
      },
    });

    const tarea = await prisma.tarea.create({
      data: {
        proyectoId: proyecto.id,
        codigo: '1',
        nombre: 'Etapa con asignación',
        nivel: NivelTarea.ETAPA,
        duracionDias: 2,
        inicioPlan: new Date('2026-11-02T00:00:00.000Z'),
        finPlan: new Date('2026-11-03T00:00:00.000Z'),
        orden: 1,
      },
    });

    const nombreProf = 'Profesional Con Asignación BD';
    const profesional = await prisma.profesional.create({
      data: {
        nombre: nombreProf,
        claveNombre: claveNombre(nombreProf),
        cargo: 'Mecánico de prueba',
        tarifaHora: 10000,
        horasDiarias: 8,
      },
    });

    const asignacion = await prisma.asignacion.create({
      data: {
        tareaId: tarea.id,
        profesionalId: profesional.id,
        dedicacion: 50,
        tarifaAplicada: 10000,
      },
    });
    expect(asignacion.id).toBeGreaterThan(0);

    const resDelete = await request(app.getHttpServer())
      .delete(`/profesionales/${profesional.id}`)
      .set('X-Rol', 'JP');

    expect(resDelete.status).toBe(409);
    expect(resDelete.body.codigo).toBe('TIENE_ASIGNACIONES');
    expect(resDelete.body.mensaje).toBe(
      `El profesional «${nombreProf}» tiene 1 asignación. Solo puede desactivarlo.`,
    );
    expect(resDelete.body.detalles).toEqual({ asignaciones: 1 });

    const resPatch = await request(app.getHttpServer())
      .patch(`/profesionales/${profesional.id}`)
      .set('X-Rol', 'JP')
      .send({ activo: false });

    expect(resPatch.status).toBe(200);
    expect(resPatch.body.activo).toBe(false);

    const asignacionPersistida = await prisma.asignacion.findUnique({
      where: { id: asignacion.id },
    });
    expect(asignacionPersistida).not.toBeNull();
    expect(asignacionPersistida?.profesionalId).toBe(profesional.id);
  });

  it('la base de datos rechaza insercion directa de juan pérez por clave_nombre', async () => {
    const nombre1 = 'Juan Pérez Prueba BD';
    const nombre2 = 'juan pérez prueba bd';

    await prisma.profesional.create({
      data: {
        nombre: nombre1,
        claveNombre: claveNombre(nombre1),
        cargo: 'Mecánico',
        tarifaHora: 8000,
        horasDiarias: 8,
      },
    });

    await expect(
      prisma.profesional.create({
        data: {
          nombre: nombre2,
          claveNombre: claveNombre(nombre2),
          cargo: 'Mecánico',
          tarifaHora: 8000,
          horasDiarias: 8,
        },
      }),
    ).rejects.toThrow(Prisma.PrismaClientKnownRequestError);
  });

  it('resuelve creaciones concurrentes con Ana y ana resultando exactamente un 201 y un 409', async () => {
    const datos1 = {
      nombre: 'Ana Gómez Concurrente',
      cargo: 'Ingeniera de software',
      tarifaHora: 15000,
      horasDiarias: 8,
    };
    const datos2 = {
      nombre: 'ana gómez concurrente',
      cargo: 'Ingeniera de software',
      tarifaHora: 15000,
      horasDiarias: 8,
    };

    const [res1, res2] = await Promise.all([
      request(app.getHttpServer()).post('/profesionales').set('X-Rol', 'JP').send(datos1),
      request(app.getHttpServer()).post('/profesionales').set('X-Rol', 'JP').send(datos2),
    ]);

    const estados = [res1.status, res2.status].sort();
    expect(estados).toEqual([201, 409]);

    const exitoso = res1.status === 201 ? res1 : res2;
    const fallido = res1.status === 409 ? res1 : res2;

    expect(exitoso.body.id).toBeGreaterThan(0);
    expect(fallido.body.codigo).toBe('REGISTRO_DUPLICADO');
  });
});
