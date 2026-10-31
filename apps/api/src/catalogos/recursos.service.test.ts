import { AccionBitacora } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { BitacoraService } from '../comun/bitacora/bitacora.service';
import { PrismaService } from '../prisma/prisma.service';
import { RecursosService } from './recursos.service';

describe('RecursosService', () => {
  it('lanza 400 con campo tipoRecursoId si el tipo no existe al crear', async () => {
    const mockTx = {
      tipoRecurso: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    };
    const prismaMock = {
      $transaction: vi.fn().mockImplementation((cb) => cb(mockTx)),
    };
    const bitacoraMock = { registrarCreacion: vi.fn() };
    const servicio = new RecursosService(
      prismaMock as unknown as PrismaService,
      bitacoraMock as unknown as BitacoraService,
    );

    await expect(
      servicio.crear(
        {
          nombre: 'Escáner',
          tipoRecursoId: 99,
          unidad: 'hora',
          costoUnitario: 3500,
        },
        'JP',
      ),
    ).rejects.toThrow(
      expect.objectContaining({
        codigo: 'VALIDACION_FALLIDA',
        detalles: [
          {
            campo: 'tipoRecursoId',
            mensaje: 'El tipo de recurso no existe.',
          },
        ],
      }),
    );
  });

  it('lanza 409 con texto exacto si tiene asignaciones al eliminar', async () => {
    const mockTx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      recurso: {
        findUnique: vi.fn().mockResolvedValue({
          id: 1,
          nombre: 'Elevador hidráulico',
          tipoRecurso: { id: 2, nombre: 'Equipamiento' },
        }),
        delete: vi.fn(),
      },
      asignacion: {
        count: vi.fn().mockResolvedValue(3),
      },
    };
    const prismaMock = {
      $transaction: vi.fn().mockImplementation((cb) => cb(mockTx)),
    };
    const bitacoraMock = { registrarEliminacion: vi.fn() };
    const servicio = new RecursosService(
      prismaMock as unknown as PrismaService,
      bitacoraMock as unknown as BitacoraService,
    );

    await expect(servicio.eliminar(1, 'JP')).rejects.toThrow(
      expect.objectContaining({
        codigo: 'TIENE_ASIGNACIONES',
        mensaje: 'El recurso «Elevador hidráulico» tiene 3 asignaciones. Solo puede desactivarlo.',
      }),
    );
    expect(mockTx.recurso.delete).not.toHaveBeenCalled();
  });

  it('registra cambio de tipoRecurso con los nombres anterior y nuevo en la bitacora', async () => {
    const antes = {
      id: 1,
      nombre: 'Mecánico',
      claveNombre: 'mecanico',
      tipoRecursoId: 1,
      tipoRecurso: { id: 1, nombre: 'Humano' },
      unidad: 'hora',
      costoUnitario: 9000,
      activo: true,
    };
    const despues = {
      ...antes,
      tipoRecursoId: 4,
      tipoRecurso: { id: 4, nombre: 'Servicio' },
      _count: { asignaciones: 0 },
    };

    const mockTx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      tipoRecurso: {
        findUnique: vi.fn().mockResolvedValue({ id: 4, nombre: 'Servicio' }),
      },
      recurso: {
        findUnique: vi.fn().mockResolvedValue(antes),
        update: vi.fn().mockResolvedValue(despues),
      },
    };
    const prismaMock = {
      $transaction: vi.fn().mockImplementation((cb) => cb(mockTx)),
    };
    const bitacoraMock = { registrarCambios: vi.fn().mockResolvedValue({}) };
    const servicio = new RecursosService(
      prismaMock as unknown as PrismaService,
      bitacoraMock as unknown as BitacoraService,
    );

    await servicio.actualizar(1, { tipoRecursoId: 4 }, 'JP');

    expect(bitacoraMock.registrarCambios).toHaveBeenCalledWith(
      mockTx,
      { proyectoId: null, entidad: 'Recurso', entidadId: 1, rol: 'JP' },
      AccionBitacora.ACTUALIZAR,
      [
        {
          campo: 'tipoRecurso',
          anterior: 'Humano',
          nuevo: 'Servicio',
        },
      ],
    );
  });
});
