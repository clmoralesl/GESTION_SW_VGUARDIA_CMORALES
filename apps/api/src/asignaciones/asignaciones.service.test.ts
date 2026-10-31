import { HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { BitacoraService } from '../comun/bitacora/bitacora.service';
import { PrismaService } from '../prisma/prisma.service';
import { RecalculoService } from '../recalculo/recalculo.service';
import { AsignacionesService } from './asignaciones.service';

describe('AsignacionesService', () => {
  it('rechaza crear asignacion si la tarea no es hoja con 409 TAREA_NO_HOJA', async () => {
    const mockTx = {
      tarea: {
        findUnique: vi.fn().mockResolvedValue({ id: 1, proyectoId: 10, duracionDias: 5 }),
        count: vi.fn().mockResolvedValue(1),
      },
      proyecto: {
        findUnique: vi.fn().mockResolvedValue({ id: 10, estado: 'EN_CURSO' }),
      },
      $queryRaw: vi.fn().mockResolvedValue([]),
    };

    const prismaMock = {
      $transaction: vi.fn().mockImplementation((cb) => cb(mockTx)),
    };

    const servicio = new AsignacionesService(
      prismaMock as unknown as PrismaService,
      {} as unknown as BitacoraService,
      {} as unknown as RecalculoService,
    );

    await expect(servicio.crear(1, { profesionalId: 5, dedicacion: 50 }, 'JP')).rejects.toThrow(
      expect.objectContaining({
        codigo: 'TAREA_NO_HOJA',
        status: HttpStatus.CONFLICT,
      }),
    );
  });

  it('rechaza crear asignacion para profesional inactivo con 409 PROFESIONAL_INACTIVO', async () => {
    const mockTx = {
      tarea: {
        findUnique: vi.fn().mockResolvedValue({ id: 1, proyectoId: 10, duracionDias: 5 }),
        count: vi.fn().mockResolvedValue(0),
      },
      proyecto: {
        findUnique: vi.fn().mockResolvedValue({ id: 10, estado: 'EN_CURSO' }),
      },
      profesional: {
        findUnique: vi.fn().mockResolvedValue({ id: 5, activo: false }),
      },
      $queryRaw: vi.fn().mockResolvedValue([]),
    };

    const prismaMock = {
      $transaction: vi.fn().mockImplementation((cb) => cb(mockTx)),
    };

    const servicio = new AsignacionesService(
      prismaMock as unknown as PrismaService,
      {} as unknown as BitacoraService,
      {} as unknown as RecalculoService,
    );

    await expect(servicio.crear(1, { profesionalId: 5, dedicacion: 50 }, 'JP')).rejects.toThrow(
      expect.objectContaining({
        codigo: 'PROFESIONAL_INACTIVO',
        status: HttpStatus.CONFLICT,
      }),
    );
  });

  it('crea asignacion de profesional congelando tarifa y recalculando', async () => {
    const mockTx = {
      tarea: {
        findUnique: vi.fn().mockResolvedValue({ id: 1, proyectoId: 10, duracionDias: 5 }),
        count: vi.fn().mockResolvedValue(0),
      },
      proyecto: {
        findUnique: vi.fn().mockResolvedValue({ id: 10, estado: 'EN_CURSO' }),
      },
      profesional: {
        findUnique: vi.fn().mockResolvedValue({
          id: 5,
          activo: true,
          tarifaHora: 15_000,
          horasDiarias: 8,
        }),
      },
      asignacion: {
        findUnique: vi.fn().mockResolvedValue(null),
        findUniqueOrThrow: vi.fn().mockImplementation(() =>
          Promise.resolve({
            id: 100,
            tareaId: 1,
            profesionalId: 5,
            recursoId: null,
            dedicacion: new Prisma.Decimal(50),
            horasPlan: new Prisma.Decimal(20),
            horasPlanManual: false,
            horasReales: null,
            tarifaAplicada: new Prisma.Decimal(15_000),
            cantidadPlan: null,
            cantidadReal: null,
            costoUnitarioAplicado: null,
            profesional: {
              id: 5,
              nombre: 'Carlos',
              cargo: 'Mecánico',
              activo: true,
              tarifaHora: 15_000,
              horasDiarias: 8,
            },
            recurso: null,
          }),
        ),
        create: vi.fn().mockResolvedValue({
          id: 100,
          tareaId: 1,
          profesionalId: 5,
          recursoId: null,
          dedicacion: new Prisma.Decimal(50),
          horasPlan: new Prisma.Decimal(20),
          horasPlanManual: false,
          horasReales: null,
          tarifaAplicada: new Prisma.Decimal(15_000),
          cantidadPlan: null,
          cantidadReal: null,
          costoUnitarioAplicado: null,
          profesional: {
            id: 5,
            nombre: 'Carlos',
            cargo: 'Mecánico',
            activo: true,
            tarifaHora: 15_000,
            horasDiarias: 8,
          },
          recurso: null,
        }),
      },
      $queryRaw: vi.fn().mockResolvedValue([]),
    };

    const prismaMock = {
      $transaction: vi.fn().mockImplementation((cb) => cb(mockTx)),
    };
    const bitacoraMock = {
      registrarCreacion: vi.fn().mockResolvedValue({}),
    };
    const recalculoMock = {
      ejecutar: vi.fn().mockResolvedValue({
        costos: {
          presupuesto: 1_000_000,
          costoPlan: 300_000,
          costoReal: 0,
          diferenciaMonto: 700_000,
          diferenciaPorcentaje: 70,
          excedePresupuesto: false,
        },
      }),
    };

    const servicio = new AsignacionesService(
      prismaMock as unknown as PrismaService,
      bitacoraMock as unknown as BitacoraService,
      recalculoMock as unknown as RecalculoService,
    );

    const res = await servicio.crear(1, { profesionalId: 5, dedicacion: 50 }, 'JP');

    expect(mockTx.asignacion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tarifaAplicada: new Prisma.Decimal(15_000),
          horasPlan: new Prisma.Decimal(20),
          horasPlanManual: false,
        }),
      }),
    );
    expect(res.asignacion.tarifaAplicada).toBe(15_000);
    expect(res.asignacion.costoPlan).toBe(300_000);
    expect(res.costos?.costoPlan).toBe(300_000);
  });

  it('actualizar rechaza cambio de destino con 400 DESTINO_INMUTABLE', async () => {
    const servicio = new AsignacionesService(
      {} as unknown as PrismaService,
      {} as unknown as BitacoraService,
      {} as unknown as RecalculoService,
    );

    await expect(
      servicio.actualizar(
        100,
        { profesionalId: 6 } as unknown as Parameters<typeof servicio.actualizar>[1],
        'JP',
      ),
    ).rejects.toThrow(
      expect.objectContaining({
        codigo: 'DESTINO_INMUTABLE',
        status: HttpStatus.BAD_REQUEST,
      }),
    );
  });

  it('actualizar rechaza cuerpo que no es un objeto con 400 VALIDACION_FALLIDA', async () => {
    const servicio = new AsignacionesService(
      {} as unknown as PrismaService,
      {} as unknown as BitacoraService,
      {} as unknown as RecalculoService,
    );

    await expect(
      servicio.actualizar(100, null as unknown as Parameters<typeof servicio.actualizar>[1], 'JP'),
    ).rejects.toThrow(
      expect.objectContaining({
        codigo: 'VALIDACION_FALLIDA',
        status: HttpStatus.BAD_REQUEST,
      }),
    );
  });

  it('actualizar con actualizarTarifa recopia la tarifa vigente del catalogo', async () => {
    const asigExistente = {
      id: 100,
      tareaId: 1,
      profesionalId: 5,
      recursoId: null,
      dedicacion: new Prisma.Decimal(50),
      horasPlan: new Prisma.Decimal(20),
      horasPlanManual: false,
      horasReales: null,
      tarifaAplicada: new Prisma.Decimal(10_000),
      cantidadPlan: null,
      cantidadReal: null,
      costoUnitarioAplicado: null,
      tarea: { id: 1, proyectoId: 10 },
      profesional: {
        id: 5,
        tarifaHora: 20_000,
        horasDiarias: 8,
        activo: true,
        nombre: 'Carlos',
        cargo: 'Mecánico',
      },
      recurso: null,
    };

    const mockTx = {
      asignacion: {
        findUnique: vi.fn().mockResolvedValue(asigExistente),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          ...asigExistente,
          tarifaAplicada: new Prisma.Decimal(20_000),
        }),
        update: vi.fn().mockResolvedValue({
          ...asigExistente,
          tarifaAplicada: new Prisma.Decimal(20_000),
        }),
      },
      proyecto: {
        findUnique: vi.fn().mockResolvedValue({ id: 10, estado: 'EN_CURSO' }),
      },
      profesional: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 5, tarifaHora: 20_000 }),
      },
      $queryRaw: vi.fn().mockResolvedValue([]),
    };

    const prismaMock = {
      $transaction: vi.fn().mockImplementation((cb) => cb(mockTx)),
    };
    const bitacoraMock = {
      registrarCambios: vi.fn().mockResolvedValue({}),
    };
    const recalculoMock = {
      ejecutar: vi.fn().mockResolvedValue({ costos: null }),
    };

    const servicio = new AsignacionesService(
      prismaMock as unknown as PrismaService,
      bitacoraMock as unknown as BitacoraService,
      recalculoMock as unknown as RecalculoService,
    );

    await servicio.actualizar(100, { actualizarTarifa: true }, 'JP');

    expect(mockTx.asignacion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tarifaAplicada: new Prisma.Decimal(20_000),
        }),
      }),
    );
  });
});
