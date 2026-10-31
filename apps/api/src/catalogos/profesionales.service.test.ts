import { AccionBitacora, Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { BitacoraService } from '../comun/bitacora/bitacora.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProfesionalesService } from './profesionales.service';

describe('ProfesionalesService', () => {
  it('eliminar con 2 asignaciones responde 409 TIENE_ASIGNACIONES y no llama a delete', async () => {
    const mockTx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      profesional: {
        findUnique: vi.fn().mockResolvedValue({
          id: 1,
          nombre: 'Matías Soto',
          claveNombre: 'matias soto',
          cargo: 'Mecánico',
          tarifaHora: 7500,
          horasDiarias: 8,
          activo: true,
        }),
        delete: vi.fn(),
      },
      asignacion: {
        count: vi.fn().mockResolvedValue(2),
      },
    };

    const prismaMock = {
      $transaction: vi.fn().mockImplementation((cb) => cb(mockTx)),
    };

    const bitacoraMock = {
      registrarEliminacion: vi.fn(),
    };

    const servicio = new ProfesionalesService(
      prismaMock as unknown as PrismaService,
      bitacoraMock as unknown as BitacoraService,
    );

    await expect(servicio.eliminar(1, 'JP')).rejects.toThrow(
      expect.objectContaining({
        codigo: 'TIENE_ASIGNACIONES',
        mensaje: 'El profesional «Matías Soto» tiene 2 asignaciones. Solo puede desactivarlo.',
      }),
    );

    expect(mockTx.profesional.delete).not.toHaveBeenCalled();
  });

  it('rechaza creacion con nombre duplicado por clave', async () => {
    const mockTx = {
      profesional: {
        findUnique: vi.fn().mockResolvedValue({
          id: 2,
          nombre: 'Juan Pérez',
          claveNombre: 'juan perez',
        }),
      },
    };
    const prismaMock = {
      $transaction: vi.fn().mockImplementation((cb) => cb(mockTx)),
    };
    const bitacoraMock = { registrarCreacion: vi.fn() };
    const servicio = new ProfesionalesService(
      prismaMock as unknown as PrismaService,
      bitacoraMock as unknown as BitacoraService,
    );

    await expect(
      servicio.crear(
        {
          nombre: 'juan perez',
          cargo: 'Mecánico',
          tarifaHora: 8000,
          horasDiarias: 8,
        },
        'JP',
      ),
    ).rejects.toThrow(
      expect.objectContaining({
        codigo: 'REGISTRO_DUPLICADO',
        mensaje: 'Ya existe un profesional con el nombre «Juan Pérez».',
      }),
    );
  });

  it('rechaza edicion con nombre duplicado de otro registro', async () => {
    const mockTx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      profesional: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({
            id: 1,
            nombre: 'Matías Soto',
            claveNombre: 'matias soto',
            cargo: 'Mecánico',
            tarifaHora: 7500,
            horasDiarias: 8,
            activo: true,
          })
          .mockResolvedValueOnce({
            id: 2,
            nombre: 'Juan Pérez',
            claveNombre: 'juan perez',
          }),
      },
    };
    const prismaMock = {
      $transaction: vi.fn().mockImplementation((cb) => cb(mockTx)),
    };
    const bitacoraMock = { registrarCambios: vi.fn() };
    const servicio = new ProfesionalesService(
      prismaMock as unknown as PrismaService,
      bitacoraMock as unknown as BitacoraService,
    );

    await expect(servicio.actualizar(1, { nombre: 'juan perez' }, 'JP')).rejects.toThrow(
      expect.objectContaining({
        codigo: 'REGISTRO_DUPLICADO',
        mensaje: 'Ya existe un profesional con el nombre «Juan Pérez».',
      }),
    );
  });

  it('permite renombrar el mismo registro cambiando solo mayusculas', async () => {
    const mockTx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      profesional: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({
            id: 1,
            nombre: 'matias soto',
            claveNombre: 'matias soto',
            cargo: 'Mecánico',
            tarifaHora: 7500,
            horasDiarias: 8,
            activo: true,
          })
          .mockResolvedValueOnce({
            id: 1,
            nombre: 'matias soto',
            claveNombre: 'matias soto',
          }),
        update: vi.fn().mockResolvedValue({
          id: 1,
          nombre: 'Matías Soto',
          claveNombre: 'matias soto',
          cargo: 'Mecánico',
          tarifaHora: 7500,
          horasDiarias: 8,
          activo: true,
          _count: { asignaciones: 0 },
        }),
      },
    };
    const prismaMock = {
      $transaction: vi.fn().mockImplementation((cb) => cb(mockTx)),
    };
    const bitacoraMock = { registrarCambios: vi.fn().mockResolvedValue({}) };
    const servicio = new ProfesionalesService(
      prismaMock as unknown as PrismaService,
      bitacoraMock as unknown as BitacoraService,
    );

    const res = await servicio.actualizar(1, { nombre: 'Matías Soto' }, 'JP');
    expect(res.nombre).toBe('Matías Soto');
  });

  it('traduce P2002 a REGISTRO_DUPLICADO con detalles bajo nombre', async () => {
    const mockError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '6.19.3',
    });
    const mockTx = {
      profesional: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockRejectedValue(mockError),
      },
    };
    const prismaMock = {
      $transaction: vi.fn().mockImplementation((cb) => cb(mockTx)),
    };
    const bitacoraMock = { registrarCreacion: vi.fn() };
    const servicio = new ProfesionalesService(
      prismaMock as unknown as PrismaService,
      bitacoraMock as unknown as BitacoraService,
    );

    await expect(
      servicio.crear(
        {
          nombre: 'Rodrigo',
          cargo: 'Jefe',
          tarifaHora: 10000,
          horasDiarias: 8,
        },
        'JP',
      ),
    ).rejects.toThrow(
      expect.objectContaining({
        codigo: 'REGISTRO_DUPLICADO',
        detalles: [
          {
            campo: 'nombre',
            mensaje: 'Ya existe un profesional con ese nombre.',
          },
        ],
      }),
    );
  });

  it('lanza 409 con 1 y con 3 asignaciones con texto exacto', async () => {
    const mockTx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      profesional: {
        findUnique: vi.fn().mockResolvedValue({
          id: 1,
          nombre: 'Matías Soto',
        }),
      },
      asignacion: {
        count: vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(3),
      },
    };
    const prismaMock = {
      $transaction: vi.fn().mockImplementation((cb) => cb(mockTx)),
    };
    const bitacoraMock = { registrarEliminacion: vi.fn() };
    const servicio = new ProfesionalesService(
      prismaMock as unknown as PrismaService,
      bitacoraMock as unknown as BitacoraService,
    );

    await expect(servicio.eliminar(1, 'JP')).rejects.toThrow(
      expect.objectContaining({
        codigo: 'TIENE_ASIGNACIONES',
        mensaje: 'El profesional «Matías Soto» tiene 1 asignación. Solo puede desactivarlo.',
      }),
    );

    await expect(servicio.eliminar(1, 'JP')).rejects.toThrow(
      expect.objectContaining({
        codigo: 'TIENE_ASIGNACIONES',
        mensaje: 'El profesional «Matías Soto» tiene 3 asignaciones. Solo puede desactivarlo.',
      }),
    );
  });

  it('lanza 404 al eliminar un id inexistente', async () => {
    const mockTx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      profesional: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    };
    const prismaMock = {
      $transaction: vi.fn().mockImplementation((cb) => cb(mockTx)),
    };
    const bitacoraMock = { registrarEliminacion: vi.fn() };
    const servicio = new ProfesionalesService(
      prismaMock as unknown as PrismaService,
      bitacoraMock as unknown as BitacoraService,
    );

    await expect(servicio.eliminar(999, 'JP')).rejects.toThrow(
      expect.objectContaining({
        codigo: 'REGISTRO_NO_ENCONTRADO',
        mensaje: 'El profesional no existe.',
      }),
    );
  });

  it('registra bitacora con proyectoId null y una fila por campo cambiado', async () => {
    const antes = {
      id: 1,
      nombre: 'Camila Rojas',
      claveNombre: 'camila rojas',
      cargo: 'Mecánica',
      tarifaHora: 9000,
      horasDiarias: 8,
      activo: true,
    };
    const despues = {
      ...antes,
      cargo: 'Mecánica senior',
      tarifaHora: 9500,
      _count: { asignaciones: 0 },
    };

    const mockTx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      profesional: {
        findUnique: vi.fn().mockResolvedValue(antes),
        update: vi.fn().mockResolvedValue(despues),
      },
    };
    const prismaMock = {
      $transaction: vi.fn().mockImplementation((cb) => cb(mockTx)),
    };
    const bitacoraMock = { registrarCambios: vi.fn().mockResolvedValue({}) };
    const servicio = new ProfesionalesService(
      prismaMock as unknown as PrismaService,
      bitacoraMock as unknown as BitacoraService,
    );

    await servicio.actualizar(1, { cargo: 'Mecánica senior', tarifaHora: 9500 }, 'JP');

    expect(bitacoraMock.registrarCambios).toHaveBeenCalledWith(
      mockTx,
      { proyectoId: null, entidad: 'Profesional', entidadId: 1, rol: 'JP' },
      AccionBitacora.ACTUALIZAR,
      [
        { campo: 'cargo', anterior: 'Mecánica', nuevo: 'Mecánica senior' },
        { campo: 'tarifaHora', anterior: 9000, nuevo: 9500 },
      ],
    );
  });

  it('no registra bitacora en PATCH { activo: false } repetido sobre registro inactivo', async () => {
    const antes = {
      id: 1,
      nombre: 'Camila Rojas',
      claveNombre: 'camila rojas',
      cargo: 'Mecánica',
      tarifaHora: 9000,
      horasDiarias: 8,
      activo: false,
    };
    const despues = {
      ...antes,
      _count: { asignaciones: 0 },
    };

    const mockTx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      profesional: {
        findUnique: vi.fn().mockResolvedValue(antes),
        update: vi.fn().mockResolvedValue(despues),
      },
    };
    const prismaMock = {
      $transaction: vi.fn().mockImplementation((cb) => cb(mockTx)),
    };
    const bitacoraMock = { registrarCambios: vi.fn().mockResolvedValue({}) };
    const servicio = new ProfesionalesService(
      prismaMock as unknown as PrismaService,
      bitacoraMock as unknown as BitacoraService,
    );

    await servicio.actualizar(1, { activo: false }, 'JP');

    expect(bitacoraMock.registrarCambios).toHaveBeenCalledWith(
      mockTx,
      { proyectoId: null, entidad: 'Profesional', entidadId: 1, rol: 'JP' },
      AccionBitacora.ACTUALIZAR,
      [],
    );
  });
});
