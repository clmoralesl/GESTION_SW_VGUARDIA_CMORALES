import { describe, expect, it, vi } from 'vitest';
import { EstadoProyecto, Prisma, SeveridadAlerta, TipoAlerta } from '@prisma/client';
import { CALENDARIO_POR_DEFECTO } from '@autofix/core';
import type { Reloj } from '../comun/reloj/reloj';
import { PasoKpi } from './paso-kpi';
import type { ContextoRecalculo } from './recalculo.tipos';

describe('PasoKpi', () => {
  const relojMock = {
    hoy: vi.fn().mockReturnValue('2026-11-06'),
  } as unknown as Reloj;

  const proyectoMock = {
    id: 1,
    nombre: 'AutoFix',
    estado: EstadoProyecto.EN_CURSO,
  };

  const tareasMock = [
    {
      id: 1,
      proyectoId: 1,
      padreId: null,
      nivel: 'ETAPA' as const,
      codigo: '1',
      orden: 1,
      nombre: 'Etapa 1',
      descripcion: null,
      responsable: null,
      duracionDias: 5,
      fechaFija: null,
      inicioPlan: new Date('2026-11-02T00:00:00.000Z'),
      finPlan: new Date('2026-11-06T00:00:00.000Z'),
      inicioReal: null,
      finReal: null,
      porcentajeAvance: new Prisma.Decimal(50),
      inicioTardio: null,
      finTardio: null,
      holguraDias: null,
      esCritica: true,
      costoPlan: new Prisma.Decimal(1000),
      costoReal: new Prisma.Decimal(1200),
      creadoEn: new Date(),
      actualizadoEn: new Date(),
    },
  ];

  const kpisMock = [
    {
      id: 101,
      codigo: 'SPI',
      nombre: 'Índice de desempeño del cronograma',
      descripcion: null,
      ambito: 'PROYECTO' as const,
      formula: 'EV / PV',
      unidad: 'INDICE' as const,
      meta: new Prisma.Decimal(1),
      direccion: 'MAYOR_MEJOR' as const,
      esAdicional: false,
      activo: true,
      umbrales: [
        { id: 1, kpiId: 101, semaforo: 'VERDE' as const, valorDesde: new Prisma.Decimal(0.95) },
        { id: 2, kpiId: 101, semaforo: 'AMARILLO' as const, valorDesde: new Prisma.Decimal(0.85) },
      ],
    },
  ];

  it('evalua KPI, crea medicion y sincroniza alertas en rojo/amarillo y cierre al volver a verde', async () => {
    const medicionesCreadas: unknown[] = [];
    const alertasCreadas: unknown[] = [];
    const alertasActualizadas: unknown[] = [];

    const txMock = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      lineaBase: { findFirst: vi.fn().mockResolvedValue(null) },
      hito: { findMany: vi.fn().mockResolvedValue([]) },
      asignacion: { findMany: vi.fn().mockResolvedValue([]) },
      kpiDefinicion: { findMany: vi.fn().mockResolvedValue(kpisMock) },
      kpiMedicion: {
        create: vi.fn().mockImplementation(async (args) => {
          medicionesCreadas.push(args.data);
          return { id: 1, ...args.data };
        }),
      },
      alerta: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockImplementation(async (args) => {
          alertasCreadas.push(args.data);
          return { id: 10, ...args.data };
        }),
        update: vi.fn().mockImplementation(async (args) => {
          alertasActualizadas.push(args);
          return args;
        }),
      },
    } as unknown as Prisma.TransactionClient;

    const contexto: ContextoRecalculo = {
      tx: txMock,
      proyecto: proyectoMock as unknown as ContextoRecalculo['proyecto'],
      calendario: CALENDARIO_POR_DEFECTO,
      tareas: tareasMock as unknown as ContextoRecalculo['tareas'],
      dependencias: [],
      tareasAfectadas: [],
      hitos: null,
      costos: null,
      detalle: {},
      huboCambios: false,
    };

    const paso = new PasoKpi(relojMock);
    await paso.ejecutar(contexto);

    expect(medicionesCreadas).toHaveLength(1);
    expect(alertasCreadas).toHaveLength(1);
    const alertaEnRojo = alertasCreadas[0] as {
      clave: string;
      severidad: SeveridadAlerta;
      tipo: TipoAlerta;
    };
    expect(alertaEnRojo.clave).toBe('KPI:101');
    expect(alertaEnRojo.tipo).toBe(TipoAlerta.KPI);
    expect(alertaEnRojo.severidad).toBe(SeveridadAlerta.CRITICA);

    vi.mocked(txMock.alerta.findMany).mockResolvedValueOnce([
      {
        id: 10,
        proyectoId: 1,
        tipo: TipoAlerta.KPI,
        clave: 'KPI:101',
        activa: true,
      },
    ] as unknown as ReturnType<typeof txMock.alerta.findMany> extends Promise<infer U> ? U : never);

    tareasMock[0].porcentajeAvance = new Prisma.Decimal(100);
    alertasCreadas.length = 0;
    alertasActualizadas.length = 0;

    await paso.ejecutar(contexto);
    expect(alertasActualizadas).toHaveLength(1);
    const primeraActualizada = alertasActualizadas[0] as { data: { activa: boolean } };
    expect(primeraActualizada.data.activa).toBe(false);
  });
});
