import { HttpStatus } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { NivelTarea } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import type { PrismaService } from '../prisma/prisma.service';
import { LineasBaseService } from './lineas-base.service';

describe('LineasBaseService', () => {
  it('lanza 404 si el proyecto no existe', async () => {
    const prismaMock = {
      proyecto: { findUnique: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;

    const servicio = new LineasBaseService(prismaMock);

    await expect(servicio.obtenerVigente(999)).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
      codigo: 'REGISTRO_NO_ENCONTRADO',
    });
  });

  it('devuelve lineaBase null si el proyecto existe pero no tiene lineas base', async () => {
    const prismaMock = {
      proyecto: { findUnique: vi.fn().mockResolvedValue({ id: 1 }) },
      lineaBase: { findFirst: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;

    const servicio = new LineasBaseService(prismaMock);
    const resultado = await servicio.obtenerVigente(1);

    expect(resultado).toEqual({
      proyectoId: 1,
      lineaBase: null,
    });
  });

  it('devuelve la linea base con sus tareas mapeadas', async () => {
    const entidadMock = {
      id: 5,
      proyectoId: 1,
      version: 2,
      descripcion: 'Linea base v2',
      solicitudCambioId: null,
      fechaFinProyecto: new Date('2026-12-10T00:00:00.000Z'),
      costoPlanTotal: new Decimal(0),
      creadoEn: new Date('2026-10-31T12:00:00.000Z'),
      tareas: [
        {
          id: 10,
          lineaBaseId: 5,
          tareaId: 3,
          codigo: '1.1.1',
          nombre: 'Tarea 1',
          nivel: NivelTarea.SUBACTIVIDAD,
          duracionDias: 3,
          inicioPlan: new Date('2026-11-02T00:00:00.000Z'),
          finPlan: new Date('2026-11-04T00:00:00.000Z'),
          costoPlan: new Decimal(0),
        },
      ],
    };

    const prismaMock = {
      proyecto: { findUnique: vi.fn().mockResolvedValue({ id: 1 }) },
      lineaBase: { findFirst: vi.fn().mockResolvedValue(entidadMock) },
    } as unknown as PrismaService;

    const servicio = new LineasBaseService(prismaMock);
    const resultado = await servicio.obtenerVigente(1);

    expect(prismaMock.lineaBase.findFirst).toHaveBeenCalledWith({
      where: { proyectoId: 1 },
      orderBy: { version: 'desc' },
      include: {
        tareas: {
          orderBy: { codigo: 'asc' },
        },
      },
    });

    expect(resultado.proyectoId).toBe(1);
    expect(resultado.lineaBase?.version).toBe(2);
    expect(resultado.lineaBase?.tareas[0]?.codigo).toBe('1.1.1');
  });
});
