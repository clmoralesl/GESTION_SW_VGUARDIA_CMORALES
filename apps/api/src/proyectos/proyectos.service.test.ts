import { HttpStatus } from '@nestjs/common';
import { EstadoProyecto, Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { BitacoraService } from '../comun/bitacora/bitacora.service';
import { ExcepcionApi } from '../comun/errores/excepcion-api';
import { PrismaService } from '../prisma/prisma.service';
import type { RecalculoService } from '../recalculo/recalculo.service';
import { ProyectosService } from './proyectos.service';

describe('ProyectosService', () => {
  const proyectoBase = {
    id: 1,
    nombre: 'AutoFix · Implementación',
    descripcion: 'Descripcion',
    responsable: 'Jefe de Proyecto',
    presupuesto: new Prisma.Decimal('45000000.00'),
    fechaInicio: new Date('2026-11-02T00:00:00.000Z'),
    fechaFin: new Date('2027-03-31T00:00:00.000Z'),
    estado: EstadoProyecto.PLANIFICADO,
    creadoEn: new Date(),
    actualizadoEn: new Date(),
  };

  function crearServicioConMocks() {
    const bitacoraMock = {
      registrarCambios: vi.fn().mockResolvedValue(undefined),
      registrarCreacion: vi.fn().mockResolvedValue(undefined),
    } as unknown as BitacoraService;

    const recalculoMock = {
      ejecutar: vi.fn().mockResolvedValue({
        arbol: { proyectoId: 1, porcentajeAvanceProyecto: 0, tareas: [] },
        tareasAfectadas: [],
      }),
    } as unknown as RecalculoService;

    const prismaMock = {
      $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(prismaMock)),
      $queryRaw: vi.fn().mockResolvedValue([]),
      proyecto: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        create: vi.fn(),
        updateMany: vi.fn(),
      },
      tarea: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
      lineaBase: {
        count: vi.fn().mockResolvedValue(0),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          id: 1,
          version: 1,
          proyectoId: 1,
          descripcion: 'Línea base inicial',
          tareas: [],
        }),
      },
    } as unknown as PrismaService;

    const servicio = new ProyectosService(prismaMock, bitacoraMock, recalculoMock);
    return { servicio, prismaMock, bitacoraMock, recalculoMock };
  }

  describe('actualizar', () => {
    it('no registra cambios en bitacora si se envian los mismos valores (caso 10)', async () => {
      const { servicio, prismaMock, bitacoraMock } = crearServicioConMocks();
      vi.mocked(prismaMock.proyecto.findUnique).mockResolvedValue(proyectoBase);
      vi.mocked(prismaMock.proyecto.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(prismaMock.proyecto.findUniqueOrThrow).mockResolvedValue(proyectoBase);

      await servicio.actualizar(
        1,
        {
          nombre: 'AutoFix · Implementación',
          presupuesto: 45000000,
        },
        'JP',
      );

      expect(bitacoraMock.registrarCambios).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        [],
      );
    });

    it('rechaza edicion sobre proyecto cerrado con 409 PROYECTO_CERRADO (caso 15)', async () => {
      const { servicio, prismaMock } = crearServicioConMocks();
      vi.mocked(prismaMock.proyecto.findUnique).mockResolvedValue({
        ...proyectoBase,
        estado: EstadoProyecto.CERRADO,
      });

      await expect(servicio.actualizar(1, { nombre: 'Nuevo' }, 'JP')).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        codigo: 'PROYECTO_CERRADO',
      });
    });

    it('responde 409 PROYECTO_CERRADO si el update condicional afecta 0 filas por concurrencia (caso 17)', async () => {
      const { servicio, prismaMock } = crearServicioConMocks();
      vi.mocked(prismaMock.proyecto.findUnique).mockResolvedValue(proyectoBase);
      vi.mocked(prismaMock.proyecto.updateMany).mockResolvedValue({ count: 0 });

      await expect(servicio.actualizar(1, { nombre: 'Nuevo' }, 'JP')).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        codigo: 'PROYECTO_CERRADO',
      });
    });

    it('valida fechaFin parcial contra fechaInicio guardada respondiendo 400 (caso 7)', async () => {
      const { servicio, prismaMock } = crearServicioConMocks();
      vi.mocked(prismaMock.proyecto.findUnique).mockResolvedValue(proyectoBase);

      try {
        await servicio.actualizar(1, { fechaFin: '2026-11-01' }, 'JP');
        expect.unreachable();
      } catch (error) {
        expect(error).toBeInstanceOf(ExcepcionApi);
        const exc = error as ExcepcionApi;
        expect(exc.getStatus()).toBe(HttpStatus.BAD_REQUEST);
        expect(exc.codigo).toBe('VALIDACION_FALLIDA');
        expect(exc.detalles).toEqual([
          { campo: 'fechaFin', mensaje: 'La fecha de fin no puede ser anterior a la de inicio.' },
        ]);
      }
    });
  });

  describe('cambiarEstado', () => {
    it('rechaza transicion invalida de PLANIFICADO a CERRADO con 409 (caso 13)', async () => {
      const { servicio, prismaMock } = crearServicioConMocks();
      vi.mocked(prismaMock.proyecto.findUnique).mockResolvedValue(proyectoBase);

      await expect(servicio.cambiarEstado(1, 'CERRADO', 'JP')).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        codigo: 'TRANSICION_INVALIDA',
      });
    });

    it('rechaza iniciar un proyecto ya EN_CURSO con 409 (caso 12)', async () => {
      const { servicio, prismaMock } = crearServicioConMocks();
      vi.mocked(prismaMock.proyecto.findUnique).mockResolvedValue({
        ...proyectoBase,
        estado: EstadoProyecto.EN_CURSO,
      });

      await expect(servicio.cambiarEstado(1, 'EN_CURSO', 'JP')).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        codigo: 'TRANSICION_INVALIDA',
      });
    });

    it('cambia de PLANIFICADO a EN_CURSO y registra ACTUALIZAR en bitacora', async () => {
      const { servicio, prismaMock, bitacoraMock } = crearServicioConMocks();
      vi.mocked(prismaMock.proyecto.findUnique).mockResolvedValue(proyectoBase);
      vi.mocked(prismaMock.proyecto.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(prismaMock.proyecto.findUniqueOrThrow).mockResolvedValue({
        ...proyectoBase,
        estado: EstadoProyecto.EN_CURSO,
      });

      const resultado = await servicio.cambiarEstado(1, 'EN_CURSO', 'JP');
      expect(resultado.estado).toBe('EN_CURSO');
      expect(bitacoraMock.registrarCambios).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'ACTUALIZAR',
        [{ campo: 'estado', anterior: 'PLANIFICADO', nuevo: 'EN_CURSO' }],
      );
      expect(prismaMock.lineaBase.create).toHaveBeenCalled();
    });

    it('cambia de EN_CURSO a CERRADO y registra CERRAR en bitacora', async () => {
      const { servicio, prismaMock, bitacoraMock } = crearServicioConMocks();
      vi.mocked(prismaMock.proyecto.findUnique).mockResolvedValue({
        ...proyectoBase,
        estado: EstadoProyecto.EN_CURSO,
      });
      vi.mocked(prismaMock.proyecto.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(prismaMock.proyecto.findUniqueOrThrow).mockResolvedValue({
        ...proyectoBase,
        estado: EstadoProyecto.CERRADO,
      });

      const resultado = await servicio.cambiarEstado(1, 'CERRADO', 'JP');
      expect(resultado.estado).toBe('CERRADO');
      expect(bitacoraMock.registrarCambios).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'CERRAR',
        [{ campo: 'estado', anterior: 'EN_CURSO', nuevo: 'CERRADO' }],
      );
    });
  });

  describe('crear', () => {
    it('crea proyecto con estado PLANIFICADO, calendario anidado y registra en bitacora', async () => {
      const { servicio, prismaMock, bitacoraMock } = crearServicioConMocks();
      vi.mocked(prismaMock.proyecto.create).mockResolvedValue(proyectoBase);

      const res = await servicio.crear(
        {
          nombre: 'AutoFix · Implementación',
          descripcion: null,
          responsable: 'Jefe de Proyecto',
          presupuesto: 45000000,
          fechaInicio: '2026-11-02',
          fechaFin: '2027-03-31',
        },
        'JP',
      );

      expect(res.nombre).toBe(proyectoBase.nombre);
      expect(prismaMock.proyecto.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            estado: EstadoProyecto.PLANIFICADO,
            calendario: expect.objectContaining({
              create: expect.objectContaining({
                feriados: expect.any(Object),
              }),
            }),
          }),
        }),
      );
      expect(bitacoraMock.registrarCreacion).toHaveBeenCalled();
    });
  });

  describe('listar', () => {
    it('agrupa etapas en memoria y calcula avance ponderado para cada proyecto', async () => {
      const { servicio, prismaMock } = crearServicioConMocks();
      vi.mocked(prismaMock.proyecto.findMany).mockResolvedValue([
        proyectoBase,
        { ...proyectoBase, id: 2, nombre: 'Proyecto 2' },
      ]);
      vi.mocked(prismaMock.tarea.findMany).mockResolvedValue([
        {
          proyectoId: 1,
          porcentajeAvance: new Prisma.Decimal('50.00'),
          duracionDias: 10,
        },
        {
          proyectoId: 1,
          porcentajeAvance: new Prisma.Decimal('100.00'),
          duracionDias: 30,
        },
      ] as unknown as {
        proyectoId: number;
        porcentajeAvance: Prisma.Decimal;
        duracionDias: number;
      }[]);

      const lista = await servicio.listar();
      expect(lista).toHaveLength(2);
      expect(lista[0].porcentajeAvance).toBe(87.5);
      expect(lista[1].porcentajeAvance).toBe(0);
    });
  });
});
