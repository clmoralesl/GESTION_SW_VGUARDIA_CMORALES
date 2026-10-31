import { EstadoProyecto, Prisma, type Tarea } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { CALENDARIO_POR_DEFECTO } from '@autofix/core';
import { PasoCostos } from './paso-costos';
import type { ContextoRecalculo } from './recalculo.tipos';

const tareaBase = (id: number, duracion: number, padreId: number | null = null): Tarea => ({
  id,
  proyectoId: 1,
  padreId,
  nivel: padreId === null ? 'ETAPA' : 'ACTIVIDAD',
  codigo: `${id}`,
  orden: id,
  nombre: `Tarea ${id}`,
  descripcion: null,
  responsable: null,
  duracionDias: duracion,
  fechaFija: null,
  inicioPlan: new Date('2026-11-02T00:00:00.000Z'),
  finPlan: new Date('2026-11-06T00:00:00.000Z'),
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

describe('PasoCostos', () => {
  it('recalcula horas plan no manuales y conserva horas manuales', async () => {
    const tarea1 = tareaBase(1, 5);
    const tarea2 = tareaBase(2, 5);

    const asignacionAutomatica = {
      id: 101,
      tareaId: 1,
      profesionalId: 10,
      recursoId: null,
      dedicacion: new Prisma.Decimal(50),
      horasPlan: new Prisma.Decimal(10),
      horasPlanManual: false,
      horasReales: null,
      tarifaAplicada: new Prisma.Decimal(20_000),
      cantidadPlan: null,
      cantidadReal: null,
      costoUnitarioAplicado: null,
      profesional: { id: 10, horasDiarias: new Prisma.Decimal(8), tarifaHora: 20_000 },
      recurso: null,
    };

    const asignacionManual = {
      id: 102,
      tareaId: 2,
      profesionalId: 10,
      recursoId: null,
      dedicacion: new Prisma.Decimal(50),
      horasPlan: new Prisma.Decimal(15),
      horasPlanManual: true,
      horasReales: null,
      tarifaAplicada: new Prisma.Decimal(20_000),
      cantidadPlan: null,
      cantidadReal: null,
      costoUnitarioAplicado: null,
      profesional: { id: 10, horasDiarias: new Prisma.Decimal(8), tarifaHora: 20_000 },
      recurso: null,
    };

    const updateMock = vi.fn().mockResolvedValue({});
    const txMock = {
      asignacion: {
        findMany: vi.fn().mockResolvedValue([asignacionAutomatica, asignacionManual]),
        update: updateMock,
      },
      tarea: {
        update: vi.fn().mockResolvedValue({}),
      },
    } as unknown as Prisma.TransactionClient;

    const paso = new PasoCostos();
    const contexto: ContextoRecalculo = {
      tx: txMock,
      proyecto: {
        id: 1,
        presupuesto: new Prisma.Decimal(1_000_000),
        fechaInicio: new Date('2026-11-02T00:00:00.000Z'),
        estado: EstadoProyecto.EN_CURSO,
      } as unknown as ContextoRecalculo['proyecto'],
      calendario: CALENDARIO_POR_DEFECTO,
      tareas: [tarea1, tarea2],
      dependencias: [],
      tareasAfectadas: [],
      hitos: null,
      costos: null,
      detalle: { campoPrevio: 'valor' },
      huboCambios: false,
    };

    await paso.ejecutar(contexto);

    expect(updateMock).toHaveBeenCalledWith({
      where: { id: 101 },
      data: { horasPlan: new Prisma.Decimal(20) },
    });
    expect(updateMock).not.toHaveBeenCalledWith(expect.objectContaining({ where: { id: 102 } }));

    expect(contexto.detalle).toHaveProperty('campoPrevio', 'valor');
    expect(contexto.detalle).toHaveProperty('costoPlanAnterior', 0);
    expect(contexto.detalle).toHaveProperty('costoPlanNuevo', 700_000);
    expect(contexto.costos).not.toBeNull();
    expect(contexto.costos?.costoPlan).toBe(700_000);
    expect(contexto.costos?.excedePresupuesto).toBe(false);
  });
});
