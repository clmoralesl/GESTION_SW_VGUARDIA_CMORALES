import { describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@prisma/client';
import type { Reloj } from '../comun/reloj/reloj';
import { resumirPlan } from './cambio-aplicador.service';

describe('CambioAplicadorService - resumirPlan', () => {
  it('deriva SPI null cuando PV es cero y CPI null cuando AC es cero', async () => {
    const relojMock = {
      hoy: () => '2026-10-01',
    } as Reloj;

    const txMock = {
      proyecto: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 1,
          presupuesto: 50000000,
          calendario: {},
        }),
      },
      calendario: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      tarea: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 10,
            codigo: '1.1',
            nombre: 'Tarea futura',
            nivel: 'ACTIVIDAD',
            padreId: null,
            duracionDias: 5,
            inicioPlan: new Date('2026-11-02T00:00:00.000Z'),
            finPlan: new Date('2026-11-06T00:00:00.000Z'),
            porcentajeAvance: 0,
            costoPlan: 100000,
            costoReal: 0,
          },
        ]),
      },
      lineaBase: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      hito: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      asignacion: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    } as unknown as Prisma.TransactionClient;

    const res = await resumirPlan(txMock, 1, relojMock);
    expect(res.metricas.spi).toBeNull();
    expect(res.metricas.cpi).toBeNull();
  });
});
