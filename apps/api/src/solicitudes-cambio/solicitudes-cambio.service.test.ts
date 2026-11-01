import { HttpStatus } from '@nestjs/common';
import {
  EstadoEtapa as EstadoEtapaPrisma,
  EstadoProyecto,
  EstadoSolicitud as EstadoSolicitudPrisma,
} from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { fechaIsoADate } from '@autofix/core';
import type { BitacoraService } from '../comun/bitacora/bitacora.service';
import type { Reloj } from '../comun/reloj/reloj';
import type { PrismaService } from '../prisma/prisma.service';
import { SolicitudesCambioService } from './solicitudes-cambio.service';

describe('SolicitudesCambioService', () => {
  const proyectoMock = {
    id: 1,
    nombre: 'AutoFix',
    estado: EstadoProyecto.EN_CURSO,
  };

  const relojMock = {
    hoy: () => '2026-11-16',
  } as Reloj;

  const bitacoraMock = {
    registrarCreacion: vi.fn().mockResolvedValue(undefined),
    registrarCambios: vi.fn().mockResolvedValue(undefined),
    registrarEliminacion: vi.fn().mockResolvedValue(undefined),
  } as unknown as BitacoraService;

  it('AJ1: al completar una etapa respeta Reloj.hoy() y calcula duracionRealDias positiva', async () => {
    const solicitudMock = {
      id: 3,
      proyectoId: 1,
      codigo: 'SC-003',
      titulo: 'Incorporación de escáneres',
      descripcion: 'Adquisición de escáneres',
      justificacion: 'Diagnóstico directo',
      solicitante: 'Jefe Diagnóstico',
      responsable: 'Carlos Morales',
      prioridad: 'ALTA',
      categoria: 'COSTO',
      probabilidadRiesgo: 2,
      impactoRiesgo: 4,
      estado: EstadoSolicitudPrisma.APROBADA,
      etapaActual: 4,
      motivoRechazo: null,
      fechaRegistro: new Date('2026-10-15T11:00:00.000Z'),
      fechaDecision: new Date('2026-10-28T14:00:00.000Z'),
      fechaCierre: null,
      actualizadoEn: new Date('2026-11-16T12:00:00.000Z'),
      etapas: [
        {
          id: 21,
          solicitudId: 3,
          numero: 1,
          nombre: 'Identificar',
          responsable: null,
          estado: EstadoEtapaPrisma.COMPLETADA,
          fechaInicio: null,
          fechaFin: null,
          fechaIniciada: fechaIsoADate('2026-11-16'),
          fechaCompletada: fechaIsoADate('2026-11-16'),
          comentario: null,
          porcentajeAdopcion: null,
          evidencias: [],
          acciones: [],
        },
        {
          id: 22,
          solicitudId: 3,
          numero: 2,
          nombre: 'Analizar',
          responsable: null,
          estado: EstadoEtapaPrisma.COMPLETADA,
          fechaInicio: null,
          fechaFin: null,
          fechaIniciada: fechaIsoADate('2026-11-16'),
          fechaCompletada: fechaIsoADate('2026-11-16'),
          comentario: null,
          porcentajeAdopcion: null,
          evidencias: [],
          acciones: [],
        },
        {
          id: 23,
          solicitudId: 3,
          numero: 3,
          nombre: 'Riesgos',
          responsable: null,
          estado: EstadoEtapaPrisma.COMPLETADA,
          fechaInicio: null,
          fechaFin: null,
          fechaIniciada: fechaIsoADate('2026-11-16'),
          fechaCompletada: fechaIsoADate('2026-11-16'),
          comentario: null,
          porcentajeAdopcion: null,
          evidencias: [],
          acciones: [],
        },
        {
          id: 24,
          solicitudId: 3,
          numero: 4,
          nombre: 'Planificación',
          responsable: null,
          estado: EstadoEtapaPrisma.EN_CURSO,
          fechaInicio: null,
          fechaFin: null,
          fechaIniciada: fechaIsoADate('2026-11-16'),
          fechaCompletada: null,
          comentario: null,
          porcentajeAdopcion: null,
          evidencias: [],
          acciones: [],
        },
        {
          id: 25,
          solicitudId: 3,
          numero: 5,
          nombre: 'Comunicación',
          responsable: null,
          estado: EstadoEtapaPrisma.PENDIENTE,
          fechaInicio: null,
          fechaFin: null,
          fechaIniciada: null,
          fechaCompletada: null,
          comentario: null,
          porcentajeAdopcion: null,
          evidencias: [],
          acciones: [],
        },
      ],
    };

    let etapaActualizadaData: Record<string, unknown> = {};

    const txMock = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      proyecto: {
        findUnique: vi.fn().mockResolvedValue(proyectoMock),
      },
      solicitudCambio: {
        findUnique: vi.fn().mockResolvedValue(solicitudMock),
        update: vi.fn().mockResolvedValue(solicitudMock),
        findUniqueOrThrow: vi.fn().mockImplementation(() => {
          return Promise.resolve({
            ...solicitudMock,
            etapas: solicitudMock.etapas.map((e) =>
              e.numero === 4
                ? {
                    ...e,
                    estado: EstadoEtapaPrisma.COMPLETADA,
                    fechaCompletada: etapaActualizadaData.fechaCompletada ?? new Date(),
                  }
                : e,
            ),
          });
        }),
      },
      etapaCambio: {
        update: vi.fn().mockImplementation(({ data }) => {
          etapaActualizadaData = data;
          return Promise.resolve({ ...solicitudMock.etapas[3], ...data });
        }),
      },
    };

    const prismaMock = {
      $transaction: vi.fn().mockImplementation((cb) => cb(txMock)),
    } as unknown as PrismaService;

    const servicio = new SolicitudesCambioService(prismaMock, bitacoraMock, relojMock);

    const resultado = await servicio.ejecutarAccionEtapa(3, 4, 'completar', undefined, 'CC');

    const etapa4 = resultado.etapas.find((e) => e.numero === 4);
    expect(etapa4).toBeDefined();
    expect(etapa4?.fechaCompletada).toBe('2026-11-16');
    expect(etapa4?.duracionRealDias).toBe(1);

    expect(bitacoraMock.registrarCambios).toHaveBeenCalledWith(
      txMock,
      expect.objectContaining({
        entidad: 'EtapaCambio',
        entidadId: 24,
      }),
      expect.anything(),
      [{ campo: 'estado', anterior: 'EN_CURSO', nuevo: 'COMPLETADA' }],
    );
  });

  it('AJ3: rechaza con 400 VALIDACION_FALLIDA cuando porcentajeAdopcion se envia en etapa diferente a 10', async () => {
    const prismaMock = {} as PrismaService;
    const servicio = new SolicitudesCambioService(prismaMock, bitacoraMock, relojMock);

    await expect(
      servicio.actualizarEtapa(3, 9, { porcentajeAdopcion: 80 }, 'JP'),
    ).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
      response: expect.objectContaining({
        codigo: 'VALIDACION_FALLIDA',
      }),
    });
  });

  it('AJ3: rechaza con 409 TRANSICION_INVALIDA COMENTARIO_REQUERIDO al actualizar etapa OMITIDA con comentario nulo o en blanco', async () => {
    const etapaOmitidaMock = {
      id: 25,
      solicitudId: 3,
      numero: 5,
      nombre: 'Comunicación',
      responsable: null,
      estado: EstadoEtapaPrisma.OMITIDA,
      fechaInicio: null,
      fechaFin: null,
      fechaIniciada: null,
      fechaCompletada: null,
      comentario: 'Omitida por mutuo acuerdo',
      porcentajeAdopcion: null,
      solicitud: {
        id: 3,
        proyectoId: 1,
        estado: EstadoSolicitudPrisma.APROBADA,
      },
      evidencias: [],
      acciones: [],
    };

    const txMock = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      proyecto: {
        findUnique: vi.fn().mockResolvedValue(proyectoMock),
      },
      etapaCambio: {
        findUnique: vi.fn().mockResolvedValue(etapaOmitidaMock),
      },
    };

    const prismaMock = {
      $transaction: vi.fn().mockImplementation((cb) => cb(txMock)),
    } as unknown as PrismaService;

    const servicio = new SolicitudesCambioService(prismaMock, bitacoraMock, relojMock);

    await expect(servicio.actualizarEtapa(3, 5, { comentario: '   ' }, 'JP')).rejects.toMatchObject(
      {
        status: HttpStatus.CONFLICT,
        response: expect.objectContaining({
          codigo: 'TRANSICION_INVALIDA',
          detalles: expect.objectContaining({
            motivo: 'COMENTARIO_REQUERIDO',
          }),
        }),
      },
    );
  });

  it('AJ4: rechaza con 409 PROYECTO_CERRADO cuando el proyecto esta en estado CERRADO', async () => {
    const proyectoCerradoMock = {
      id: 1,
      nombre: 'AutoFix',
      estado: EstadoProyecto.CERRADO,
    };

    const txMock = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      proyecto: {
        findUnique: vi.fn().mockResolvedValue(proyectoCerradoMock),
      },
      solicitudCambio: {
        findUnique: vi.fn().mockResolvedValue({
          id: 3,
          proyectoId: 1,
          estado: EstadoSolicitudPrisma.APROBADA,
          etapas: [],
        }),
      },
    };

    const prismaMock = {
      $transaction: vi.fn().mockImplementation((cb) => cb(txMock)),
    } as unknown as PrismaService;

    const servicio = new SolicitudesCambioService(prismaMock, bitacoraMock, relojMock);

    await expect(
      servicio.ejecutarAccionEtapa(3, 4, 'completar', undefined, 'CC'),
    ).rejects.toMatchObject({
      status: HttpStatus.CONFLICT,
      response: expect.objectContaining({
        codigo: 'PROYECTO_CERRADO',
      }),
    });
  });
});
