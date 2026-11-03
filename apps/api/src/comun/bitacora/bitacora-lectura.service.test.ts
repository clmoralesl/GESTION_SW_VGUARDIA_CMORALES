import { HttpStatus } from '@nestjs/common';
import { AccionBitacora, RolUsuario } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../prisma/prisma.service';
import { ExcepcionApi } from '../errores/excepcion-api';
import { BitacoraLecturaService } from './bitacora-lectura.service';

describe('BitacoraLecturaService', () => {
  it('consulta bitacora con filtros, paginacion y derivacion de origen', async () => {
    const filaMock = {
      id: 1,
      proyectoId: 1,
      fecha: new Date('2026-11-02T10:00:00.000Z'),
      rol: RolUsuario.JEFE_PROYECTO,
      entidad: 'Tarea',
      entidadId: 5,
      accion: AccionBitacora.ACTUALIZAR,
      campo: 'duracionDias',
      valorAnterior: 5,
      valorNuevo: 8,
      origen: null,
      solicitudCambioId: 2,
      solicitudCambio: { codigo: 'SC-002' },
    };

    const prismaMock = {
      $transaction: vi.fn().mockResolvedValue([1, [filaMock]]),
      bitacora: {
        count: vi.fn(),
        findMany: vi.fn(),
      },
    } as unknown as PrismaService;

    const servicio = new BitacoraLecturaService(prismaMock);
    const res = await servicio.consultar({
      proyectoId: 1,
      entidad: 'Tarea',
      entidadId: 5,
      rol: 'JP',
      accion: 'ACTUALIZAR',
      desde: '2026-11-01',
      hasta: '2026-11-02',
      pagina: 1,
      tamanoPagina: 25,
    });

    expect(res.total).toBe(1);
    expect(res.totalPaginas).toBe(1);
    expect(res.registros.length).toBe(1);
    expect(res.registros[0].rol).toBe('JP');
    expect(res.registros[0].origen.tipo).toBe('APROBACION');
    expect(res.registros[0].origen.etiqueta).toBe('Aprobación SC-002');
  });

  it('ordena por fecha y desempata por id descendente en ambas consultas', async () => {
    const findMany = vi.fn().mockReturnValue('consulta-filas');
    const prismaMock = {
      solicitudCambio: {
        findUnique: vi.fn().mockResolvedValue({ id: 2, etapas: [], impactos: [] }),
      },
      $transaction: vi.fn().mockResolvedValue([0, []]),
      bitacora: {
        count: vi.fn(),
        findMany,
      },
    } as unknown as PrismaService;

    const servicio = new BitacoraLecturaService(prismaMock);
    await servicio.consultar({ pagina: 2, tamanoPagina: 10 });
    await servicio.obtenerHistorialSolicitud(2, { pagina: 1, tamanoPagina: 25 });

    expect(findMany).toHaveBeenCalledTimes(2);
    for (const [argumentos] of findMany.mock.calls) {
      expect(argumentos.orderBy).toEqual([{ fecha: 'desc' }, { id: 'desc' }]);
    }
    expect(findMany.mock.calls[0]?.[0]).toMatchObject({ skip: 10, take: 10 });
  });

  it('devuelve totalPaginas 0 si no hay resultados', async () => {
    const prismaMock = {
      $transaction: vi.fn().mockResolvedValue([0, []]),
      bitacora: {
        count: vi.fn(),
        findMany: vi.fn(),
      },
    } as unknown as PrismaService;

    const servicio = new BitacoraLecturaService(prismaMock);
    const res = await servicio.consultar({
      pagina: 1,
      tamanoPagina: 25,
    });

    expect(res.total).toBe(0);
    expect(res.totalPaginas).toBe(0);
    expect(res.registros).toEqual([]);
  });

  it('obtenerHistorialSolicitud lanza 404 si la solicitud no existe', async () => {
    const prismaMock = {
      solicitudCambio: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    } as unknown as PrismaService;

    const servicio = new BitacoraLecturaService(prismaMock);

    await expect(
      servicio.obtenerHistorialSolicitud(999, { pagina: 1, tamanoPagina: 25 }),
    ).rejects.toThrow(ExcepcionApi);

    try {
      await servicio.obtenerHistorialSolicitud(999, { pagina: 1, tamanoPagina: 25 });
    } catch (err: unknown) {
      const apiErr = err as ExcepcionApi;
      expect(apiErr.getStatus()).toBe(HttpStatus.NOT_FOUND);
      expect(apiErr.codigo).toBe('RECURSO_NO_ENCONTRADO');
    }
  });

  it('obtenerHistorialSolicitud reune entidades relacionadas y solicitudCambioId', async () => {
    const solicitudMock = {
      id: 2,
      etapas: [
        {
          id: 10,
          evidencias: [{ id: 100 }],
          acciones: [{ id: 200 }],
        },
      ],
      impactos: [{ id: 300 }],
    };

    const filaMock = {
      id: 50,
      proyectoId: 1,
      fecha: new Date('2026-11-02T12:00:00.000Z'),
      rol: RolUsuario.COMITE_CAMBIOS,
      entidad: 'SolicitudCambio',
      entidadId: 2,
      accion: AccionBitacora.APROBAR,
      campo: null,
      valorAnterior: null,
      valorNuevo: null,
      origen: null,
      solicitudCambioId: 2,
      solicitudCambio: { codigo: 'SC-002' },
    };

    const prismaMock = {
      solicitudCambio: {
        findUnique: vi.fn().mockResolvedValue(solicitudMock),
      },
      $transaction: vi.fn().mockResolvedValue([1, [filaMock]]),
      bitacora: {
        count: vi.fn(),
        findMany: vi.fn(),
      },
    } as unknown as PrismaService;

    const servicio = new BitacoraLecturaService(prismaMock);
    const res = await servicio.obtenerHistorialSolicitud(2, { pagina: 1, tamanoPagina: 25 });

    expect(res.total).toBe(1);
    expect(res.registros[0].origen.etiqueta).toBe('Aprobación SC-002');
  });
});
