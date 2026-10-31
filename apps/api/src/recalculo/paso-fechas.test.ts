import { EstadoProyecto, Prisma, type Tarea } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { CALENDARIO_POR_DEFECTO } from '@autofix/core';
import { PasoFechas } from './paso-fechas';
import type { ContextoRecalculo } from './recalculo.tipos';

describe('PasoFechas', () => {
  it('no hace nada si no hay tareas en el contexto', async () => {
    const paso = new PasoFechas();
    const contexto: ContextoRecalculo = {
      tx: {} as Prisma.TransactionClient,
      proyecto: {
        id: 1,
        fechaInicio: new Date('2026-11-02T00:00:00.000Z'),
      } as unknown as ContextoRecalculo['proyecto'],
      calendario: CALENDARIO_POR_DEFECTO,
      tareas: [],
      dependencias: [],
      tareasAfectadas: [],
      detalle: {},
      huboCambios: false,
    };

    await paso.ejecutar(contexto);
    expect(contexto.huboCambios).toBe(false);
    expect(contexto.tareasAfectadas).toHaveLength(0);
  });

  it('calcula planificacion, detecta filas que cambian y actualiza contexto', async () => {
    const txMock = {
      $executeRaw: vi.fn().mockResolvedValue(1),
    } as unknown as Prisma.TransactionClient;

    const tarea1: Tarea = {
      id: 1,
      proyectoId: 1,
      padreId: null,
      nivel: 'ETAPA',
      codigo: '1',
      orden: 1,
      nombre: 'Etapa 1',
      descripcion: null,
      responsable: null,
      duracionDias: 3,
      fechaFija: null,
      inicioPlan: new Date('2026-11-02T00:00:00.000Z'),
      finPlan: new Date('2026-11-04T00:00:00.000Z'),
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
    };

    const tarea2: Tarea = {
      id: 2,
      proyectoId: 1,
      padreId: 1,
      nivel: 'ACTIVIDAD',
      codigo: '1.1',
      orden: 1,
      nombre: 'Actividad 1.1',
      descripcion: null,
      responsable: null,
      duracionDias: 3,
      fechaFija: null,
      inicioPlan: new Date('2026-11-02T00:00:00.000Z'),
      finPlan: new Date('2026-11-04T00:00:00.000Z'),
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
    };

    const paso = new PasoFechas();
    const contexto: ContextoRecalculo = {
      tx: txMock,
      proyecto: {
        id: 1,
        fechaInicio: new Date('2026-11-02T00:00:00.000Z'),
        estado: EstadoProyecto.EN_CURSO,
      } as unknown as ContextoRecalculo['proyecto'],
      calendario: CALENDARIO_POR_DEFECTO,
      tareas: [tarea1, tarea2],
      dependencias: [],
      tareasAfectadas: [],
      detalle: {},
      huboCambios: false,
    };

    await paso.ejecutar(contexto);

    expect(txMock.$executeRaw).toHaveBeenCalled();
    expect(contexto.huboCambios).toBe(true);
    expect(contexto.detalle.finProyectoNuevo).toBe('2026-11-04');
    expect(contexto.tareas[0].esCritica).toBe(true);
    expect(contexto.tareas[1].esCritica).toBe(true);
  });

  it('conserva campos previos en contexto.detalle sin pisarlos', async () => {
    const txMock = {
      $executeRaw: vi.fn().mockResolvedValue(1),
    } as unknown as Prisma.TransactionClient;

    const tarea: Tarea = {
      id: 1,
      proyectoId: 1,
      padreId: null,
      nivel: 'ETAPA',
      codigo: '1',
      orden: 1,
      nombre: 'Etapa 1',
      descripcion: null,
      responsable: null,
      duracionDias: 3,
      fechaFija: null,
      inicioPlan: new Date('2026-11-02T00:00:00.000Z'),
      finPlan: new Date('2026-11-04T00:00:00.000Z'),
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
    };

    const paso = new PasoFechas();
    const contexto: ContextoRecalculo = {
      tx: txMock,
      proyecto: {
        id: 1,
        fechaInicio: new Date('2026-11-02T00:00:00.000Z'),
        estado: EstadoProyecto.EN_CURSO,
      } as unknown as ContextoRecalculo['proyecto'],
      calendario: CALENDARIO_POR_DEFECTO,
      tareas: [tarea],
      dependencias: [],
      tareasAfectadas: [],
      detalle: { campoPrevio: 'valor-previo' },
      huboCambios: false,
    };

    await paso.ejecutar(contexto);
    expect(contexto.detalle).toHaveProperty('campoPrevio', 'valor-previo');
  });
});
