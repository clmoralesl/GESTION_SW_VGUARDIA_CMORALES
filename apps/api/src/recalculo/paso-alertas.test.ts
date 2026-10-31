import { EstadoProyecto, Prisma, TipoAlerta, type Tarea } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { CALENDARIO_POR_DEFECTO } from '@autofix/core';
import { PasoAlertas } from './paso-alertas';
import type { ContextoRecalculo } from './recalculo.tipos';

const tareaBase = (id: number, ini: string, fin: string): Tarea => ({
  id,
  proyectoId: 1,
  padreId: null,
  nivel: 'ACTIVIDAD',
  codigo: `1.${id}`,
  orden: id,
  nombre: `Tarea ${id}`,
  descripcion: null,
  responsable: null,
  duracionDias: 3,
  fechaFija: null,
  inicioPlan: new Date(`${ini}T00:00:00.000Z`),
  finPlan: new Date(`${fin}T00:00:00.000Z`),
  inicioReal: null,
  finReal: null,
  porcentajeAvance: new Prisma.Decimal(0),
  inicioTardio: null,
  finTardio: null,
  holguraDias: null,
  esCritica: false,
  costoPlan: new Prisma.Decimal(0),
  costoReal: new Prisma.Decimal(0),
  creadoEn: new Date(),
  actualizadoEn: new Date(),
});

describe('PasoAlertas', () => {
  it('crea alerta de sobreasignacion y de presupuesto, y las cierra al resolverse', async () => {
    const tarea1 = tareaBase(1, '2026-11-02', '2026-11-06');
    const tarea2 = tareaBase(2, '2026-11-04', '2026-11-10');

    const asignacionesProyecto = [{ profesionalId: 9 }, { profesionalId: 9 }];

    const asignacionesActivas = [
      {
        tareaId: 1,
        profesionalId: 9,
        dedicacion: new Prisma.Decimal(60),
        tarea: {
          id: 1,
          codigo: '1.1',
          nombre: 'Tarea 1',
          proyectoId: 1,
          inicioPlan: new Date('2026-11-02T00:00:00.000Z'),
          finPlan: new Date('2026-11-06T00:00:00.000Z'),
          porcentajeAvance: new Prisma.Decimal(0),
        },
        profesional: { id: 9, nombre: 'Ana Gómez' },
      },
      {
        tareaId: 2,
        profesionalId: 9,
        dedicacion: new Prisma.Decimal(60),
        tarea: {
          id: 2,
          codigo: '1.2',
          nombre: 'Tarea 2',
          proyectoId: 1,
          inicioPlan: new Date('2026-11-04T00:00:00.000Z'),
          finPlan: new Date('2026-11-10T00:00:00.000Z'),
          porcentajeAvance: new Prisma.Decimal(0),
        },
        profesional: { id: 9, nombre: 'Ana Gómez' },
      },
    ];

    const alertaCreateMock = vi.fn().mockResolvedValue({});
    const alertaUpdateMock = vi.fn().mockResolvedValue({});
    const executeRawMock = vi.fn().mockResolvedValue(1);

    const txMock = {
      $executeRaw: executeRawMock,
      asignacion: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce(asignacionesProyecto)
          .mockResolvedValueOnce(asignacionesActivas),
      },
      alerta: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
        create: alertaCreateMock,
        update: alertaUpdateMock,
      },
    } as unknown as Prisma.TransactionClient;

    const paso = new PasoAlertas();
    const contexto: ContextoRecalculo = {
      tx: txMock,
      proyecto: {
        id: 1,
        presupuesto: new Prisma.Decimal(100_000),
        fechaInicio: new Date('2026-11-02T00:00:00.000Z'),
        estado: EstadoProyecto.EN_CURSO,
      } as unknown as ContextoRecalculo['proyecto'],
      calendario: CALENDARIO_POR_DEFECTO,
      tareas: [tarea1, tarea2],
      dependencias: [],
      tareasAfectadas: [],
      hitos: null,
      costos: {
        presupuesto: 100_000,
        costoPlan: 150_000,
        costoReal: 0,
        diferenciaMonto: -50_000,
        diferenciaPorcentaje: -50,
        excedePresupuesto: true,
      },
      detalle: {},
      huboCambios: false,
    };

    await paso.ejecutar(contexto);

    expect(executeRawMock).toHaveBeenCalled();
    expect(alertaCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tipo: TipoAlerta.SOBREASIGNACION,
          clave: 'SOBREASIGNACION:9:2026-11-04:2026-11-06',
          activa: true,
        }),
      }),
    );
    expect(alertaCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tipo: TipoAlerta.PRESUPUESTO,
          clave: 'PRESUPUESTO:1',
          activa: true,
        }),
      }),
    );
  });

  it('cierra alertas cuando el conflicto se resuelve', async () => {
    const tarea1 = tareaBase(1, '2026-11-02', '2026-11-06');
    const alertaActivaExistente = {
      id: 50,
      proyectoId: 1,
      tipo: TipoAlerta.SOBREASIGNACION,
      clave: 'SOBREASIGNACION:9:2026-11-04:2026-11-06',
      activa: true,
    };
    const alertaPresupuestoExistente = {
      id: 51,
      proyectoId: 1,
      tipo: TipoAlerta.PRESUPUESTO,
      clave: 'PRESUPUESTO:1',
      activa: true,
    };

    const alertaUpdateMock = vi.fn().mockResolvedValue({});
    const txMock = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      asignacion: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([{ profesionalId: 9 }])
          .mockResolvedValueOnce([]),
      },
      alerta: {
        findMany: vi.fn().mockResolvedValue([alertaActivaExistente]),
        findFirst: vi.fn().mockResolvedValue(alertaPresupuestoExistente),
        create: vi.fn().mockResolvedValue({}),
        update: alertaUpdateMock,
      },
    } as unknown as Prisma.TransactionClient;

    const paso = new PasoAlertas();
    const contexto: ContextoRecalculo = {
      tx: txMock,
      proyecto: {
        id: 1,
        presupuesto: new Prisma.Decimal(200_000),
        fechaInicio: new Date('2026-11-02T00:00:00.000Z'),
        estado: EstadoProyecto.EN_CURSO,
      } as unknown as ContextoRecalculo['proyecto'],
      calendario: CALENDARIO_POR_DEFECTO,
      tareas: [tarea1],
      dependencias: [],
      tareasAfectadas: [],
      hitos: null,
      costos: {
        presupuesto: 200_000,
        costoPlan: 150_000,
        costoReal: 0,
        diferenciaMonto: 50_000,
        diferenciaPorcentaje: 25,
        excedePresupuesto: false,
      },
      detalle: {},
      huboCambios: false,
    };

    await paso.ejecutar(contexto);

    expect(alertaUpdateMock).toHaveBeenCalledWith({
      where: { id: 50 },
      data: expect.objectContaining({ activa: false }),
    });
    expect(alertaUpdateMock).toHaveBeenCalledWith({
      where: { id: 51 },
      data: expect.objectContaining({ activa: false }),
    });
  });

  it('cierra alerta activa de sobreasignacion cuando el proyecto ya no tiene asignaciones del profesional', async () => {
    const alertasDb: {
      id: number;
      clave: string;
      entidadId: number;
      activa: boolean;
      cerradaEn: Date | null;
    }[] = [
      {
        id: 99,
        clave: 'SOBREASIGNACION:4:2026-11-12:2026-11-13',
        entidadId: 4,
        activa: true,
        cerradaEn: null,
      },
    ];

    const mockTx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      asignacion: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      calendario: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      alerta: {
        findMany: vi
          .fn()
          .mockImplementation(
            (args?: {
              where?: { tipo?: TipoAlerta; activa?: boolean; entidadId?: { in?: number[] } };
              select?: { entidadId?: boolean };
            }) => {
              if (
                args?.where?.tipo === TipoAlerta.SOBREASIGNACION &&
                args?.where?.activa === true &&
                args?.select?.entidadId
              ) {
                return [{ entidadId: 4 }];
              }
              if (args?.where?.tipo === TipoAlerta.SOBREASIGNACION) {
                const inIds: number[] = args?.where?.entidadId?.in ?? [];
                return alertasDb.filter((a) => inIds.includes(a.entidadId) && a.activa);
              }
              return [];
            },
          ),
        create: vi.fn(),
        findFirst: vi.fn().mockResolvedValue(null),
        update: vi
          .fn()
          .mockImplementation(
            ({
              where,
              data,
            }: {
              where: { id: number };
              data: { activa?: boolean; cerradaEn?: Date };
            }) => {
              const a = alertasDb.find((item) => item.id === where.id);
              if (a) Object.assign(a, data);
              return a;
            },
          ),
      },
    };

    const contexto: ContextoRecalculo = {
      tx: mockTx as unknown as Prisma.TransactionClient,
      proyecto: {
        id: 1,
        presupuesto: new Prisma.Decimal(100000),
      } as unknown as ContextoRecalculo['proyecto'],
      calendario: CALENDARIO_POR_DEFECTO,
      tareas: [],
      dependencias: [],
      tareasAfectadas: [],
      hitos: null,
      costos: {
        presupuesto: 100000,
        costoPlan: 0,
        costoReal: 0,
        diferenciaMonto: 100000,
        diferenciaPorcentaje: 100,
        excedePresupuesto: false,
      },
      detalle: {},
      huboCambios: false,
    };

    const paso = new PasoAlertas();
    await paso.ejecutar(contexto);

    expect(alertasDb[0]?.activa).toBe(false);
  });
});
