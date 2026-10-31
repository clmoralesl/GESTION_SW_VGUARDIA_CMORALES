import { describe, expect, it, vi } from 'vitest';
import type { BitacoraService } from '../comun/bitacora/bitacora.service';
import { ExcepcionApi } from '../comun/errores/excepcion-api';
import type { Reloj } from '../comun/reloj/reloj';
import type { PrismaService } from '../prisma/prisma.service';
import { KpiService } from './kpi.service';

describe('KpiService validaciones y lógica', () => {
  const relojMock = {
    hoy: vi.fn().mockReturnValue('2026-11-06'),
  } as unknown as Reloj;

  const bitacoraMock = {
    registrarCreacion: vi.fn().mockResolvedValue(undefined),
    registrarCambios: vi.fn().mockResolvedValue(undefined),
    registrarEliminacion: vi.fn().mockResolvedValue(undefined),
  } as unknown as BitacoraService;

  it('rechaza con 422 FORMULA_INVALIDA cuando la formula tiene una variable inexistente', async () => {
    const prismaMock = {
      kpiDefinicion: { findUnique: vi.fn() },
    } as unknown as PrismaService;

    const servicio = new KpiService(prismaMock, bitacoraMock, relojMock);

    await expect(
      servicio.crear(
        {
          codigo: 'TEST',
          nombre: 'Test',
          ambito: 'PROYECTO',
          formula: 'EV / VARIABLE_INEXISTENTE',
          unidad: 'INDICE',
          direccion: 'MAYOR_MEJOR',
        },
        'JP',
      ),
    ).rejects.toSatisfy((e: unknown) => {
      return e instanceof ExcepcionApi && e.getStatus() === 422 && e.codigo === 'FORMULA_INVALIDA';
    });
  });

  it('rechaza con 422 FORMULA_INVALIDA cuando la formula intenta usar import({})', async () => {
    const prismaMock = {
      kpiDefinicion: { findUnique: vi.fn() },
    } as unknown as PrismaService;

    const servicio = new KpiService(prismaMock, bitacoraMock, relojMock);

    await expect(
      servicio.crear(
        {
          codigo: 'MALICIOSO',
          nombre: 'Inyeccion',
          ambito: 'PROYECTO',
          formula: 'import({})',
          unidad: 'INDICE',
          direccion: 'MAYOR_MEJOR',
        },
        'JP',
      ),
    ).rejects.toSatisfy((e: unknown) => {
      return e instanceof ExcepcionApi && e.getStatus() === 422 && e.codigo === 'FORMULA_INVALIDA';
    });
  });

  it('rechaza con 409 KPI_CODIGO_DUPLICADO cuando el codigo ya existe', async () => {
    const prismaMock = {
      kpiDefinicion: {
        findUnique: vi.fn().mockResolvedValue({ id: 1, codigo: 'SPI' }),
      },
    } as unknown as PrismaService;

    const servicio = new KpiService(prismaMock, bitacoraMock, relojMock);

    await expect(
      servicio.crear(
        {
          codigo: 'SPI',
          nombre: 'SPI Duplicado',
          ambito: 'PROYECTO',
          formula: 'EV / PV',
          unidad: 'INDICE',
          direccion: 'MAYOR_MEJOR',
        },
        'JP',
      ),
    ).rejects.toSatisfy((e: unknown) => {
      return (
        e instanceof ExcepcionApi && e.getStatus() === 409 && e.codigo === 'KPI_CODIGO_DUPLICADO'
      );
    });
  });

  it('rechaza con 409 KPI_CON_MEDICIONES al intentar eliminar un KPI con mediciones registradas', async () => {
    const prismaMock = {
      kpiDefinicion: {
        findUnique: vi.fn().mockResolvedValue({ id: 1, codigo: 'SPI' }),
      },
      kpiMedicion: {
        count: vi.fn().mockResolvedValue(5),
      },
    } as unknown as PrismaService;

    const servicio = new KpiService(prismaMock, bitacoraMock, relojMock);

    await expect(servicio.eliminar(1, 'JP')).rejects.toSatisfy((e: unknown) => {
      return (
        e instanceof ExcepcionApi && e.getStatus() === 409 && e.codigo === 'KPI_CON_MEDICIONES'
      );
    });
  });

  it('permite eliminar un KPI si no tiene mediciones', async () => {
    const txMock = {
      kpiDefinicion: {
        delete: vi.fn().mockResolvedValue({ id: 2 }),
      },
      bitacora: {
        create: vi.fn().mockResolvedValue({ id: 1 }),
      },
    };

    const prismaMock = {
      kpiDefinicion: {
        findUnique: vi.fn().mockResolvedValue({ id: 2, codigo: 'TEMP', nombre: 'Temporal' }),
      },
      kpiMedicion: {
        count: vi.fn().mockResolvedValue(0),
      },
      $transaction: vi.fn().mockImplementation(async (cb) => cb(txMock)),
    } as unknown as PrismaService;

    const servicio = new KpiService(prismaMock, bitacoraMock, relojMock);
    await servicio.eliminar(2, 'JP');
    expect(txMock.kpiDefinicion.delete).toHaveBeenCalledWith({ where: { id: 2 } });
  });

  it('validarFormula responde valida=true con el valor evaluado cuando la formula es correcta', async () => {
    const prismaMock = {
      proyecto: { findUnique: vi.fn().mockResolvedValue({ id: 1 }) },
      calendario: { findUnique: vi.fn().mockResolvedValue(null) },
      tarea: { findMany: vi.fn().mockResolvedValue([]) },
      lineaBase: { findFirst: vi.fn().mockResolvedValue(null) },
      hito: { findMany: vi.fn().mockResolvedValue([]) },
      asignacion: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;

    const servicio = new KpiService(prismaMock, bitacoraMock, relojMock);
    const res = await servicio.validarFormula({
      formula: 'min(10, 5) * 2',
    });

    expect(res.valida).toBe(true);
    expect(res.valor).toBe(10);
    expect(res.errores).toHaveLength(0);
  });

  it('A1: actualizar conserva los umbrales existentes cuando no se envian en el PATCH', async () => {
    const kpiActual = {
      id: 1,
      codigo: 'SPI',
      nombre: 'Original',
      descripcion: null,
      ambito: 'PROYECTO',
      formula: 'EV / PV',
      unidad: 'INDICE',
      meta: 1,
      direccion: 'MAYOR_MEJOR',
      esAdicional: false,
      activo: true,
      umbrales: [
        { semaforo: 'VERDE', valorDesde: 0.95 },
        { semaforo: 'AMARILLO', valorDesde: 0.85 },
      ],
    };

    const txMock = {
      kpiDefinicion: {
        update: vi.fn().mockResolvedValue({
          ...kpiActual,
          nombre: 'Actualizado',
        }),
      },
      kpiUmbral: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
    };

    const prismaMock = {
      kpiDefinicion: {
        findUnique: vi.fn().mockResolvedValue(kpiActual),
      },
      $transaction: vi.fn().mockImplementation(async (cb) => cb(txMock)),
    } as unknown as PrismaService;

    const servicio = new KpiService(prismaMock, bitacoraMock, relojMock);
    const res = await servicio.actualizar(1, { nombre: 'Actualizado' }, 'JP');

    expect(txMock.kpiUmbral.deleteMany).not.toHaveBeenCalled();
    expect(res.umbrales.verde).toBe(0.95);
    expect(res.umbrales.amarillo).toBe(0.85);
  });

  it('A1: actualizar rechaza con 422 UMBRALES_INVALIDOS si la nueva direccion es incoherente con los umbrales guardados', async () => {
    const kpiActual = {
      id: 1,
      codigo: 'SPI',
      nombre: 'Original',
      descripcion: null,
      ambito: 'PROYECTO',
      formula: 'EV / PV',
      unidad: 'INDICE',
      meta: 1,
      direccion: 'MAYOR_MEJOR',
      esAdicional: false,
      activo: true,
      umbrales: [
        { semaforo: 'VERDE', valorDesde: 0.95 },
        { semaforo: 'AMARILLO', valorDesde: 0.85 },
      ],
    };

    const prismaMock = {
      kpiDefinicion: {
        findUnique: vi.fn().mockResolvedValue(kpiActual),
      },
    } as unknown as PrismaService;

    const servicio = new KpiService(prismaMock, bitacoraMock, relojMock);
    await expect(servicio.actualizar(1, { direccion: 'MENOR_MEJOR' }, 'JP')).rejects.toMatchObject({
      status: 422,
      codigo: 'UMBRALES_INVALIDOS',
    });
  });

  it('A2: listarMediciones devuelve las ultimas N mediciones en orden cronologico ascendente', async () => {
    const medicionesDb = [
      {
        id: 3,
        kpiId: 1,
        proyectoId: 1,
        hitoId: null,
        valor: 0.95,
        semaforo: 'VERDE',
        origen: 'corte=2026-11-03',
        medidoEn: new Date('2026-11-03T10:00:00Z'),
      },
      {
        id: 2,
        kpiId: 1,
        proyectoId: 1,
        hitoId: null,
        valor: 0.9,
        semaforo: 'AMARILLO',
        origen: 'corte=2026-11-02',
        medidoEn: new Date('2026-11-02T10:00:00Z'),
      },
    ];

    const prismaMock = {
      kpiMedicion: {
        findMany: vi.fn().mockResolvedValue(medicionesDb),
      },
    } as unknown as PrismaService;

    const servicio = new KpiService(prismaMock, bitacoraMock, relojMock);
    const resultado = await servicio.listarMediciones(1, 1, 2);

    expect(prismaMock.kpiMedicion.findMany).toHaveBeenCalledWith({
      where: { proyectoId: 1, kpiId: 1 },
      orderBy: [{ medidoEn: 'desc' }, { id: 'desc' }],
      take: 2,
    });
    expect(resultado).toHaveLength(2);
    expect(resultado[0]?.id).toBe(2);
    expect(resultado[1]?.id).toBe(3);
  });
});
