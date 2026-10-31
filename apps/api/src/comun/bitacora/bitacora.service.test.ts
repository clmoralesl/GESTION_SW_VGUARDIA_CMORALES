import { AccionBitacora, Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { BitacoraService, ContextoBitacora } from './bitacora.service';

describe('BitacoraService', () => {
  it('registra creacion con proyectoId nulo para catalogos globales', async () => {
    const servicio = new BitacoraService();
    const createMock = vi.fn().mockResolvedValue({});
    const tx = {
      bitacora: {
        create: createMock,
      },
    } as unknown as Prisma.TransactionClient;

    const contexto: ContextoBitacora = {
      proyectoId: null,
      entidad: 'Profesional',
      entidadId: 10,
      rol: 'JP',
    };

    await servicio.registrarCreacion(tx, contexto, {
      nombre: 'Rodrigo Fuentes',
      tarifaHora: 12000,
    });

    expect(createMock).toHaveBeenCalledWith({
      data: {
        proyectoId: null,
        entidad: 'Profesional',
        entidadId: 10,
        rol: 'JEFE_PROYECTO',
        accion: AccionBitacora.CREAR,
        valorNuevo: {
          nombre: 'Rodrigo Fuentes',
          tarifaHora: 12000,
        },
      },
    });
  });
});
