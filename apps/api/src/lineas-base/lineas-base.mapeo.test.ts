import { describe, expect, it } from 'vitest';
import { mapearLineaBaseGantt, type LineaBaseConTareas } from './lineas-base.mapeo';
import { NivelTarea } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

describe('mapearLineaBaseGantt', () => {
  it('mapea correctamente los campos y transforma fechas Date a ISO', () => {
    const entidad: LineaBaseConTareas = {
      id: 1,
      proyectoId: 10,
      version: 1,
      descripcion: 'Linea base inicial',
      solicitudCambioId: null,
      fechaFinProyecto: new Date('2026-12-10T00:00:00.000Z'),
      costoPlanTotal: new Decimal(0),
      creadoEn: new Date('2026-10-31T12:00:00.000Z'),
      tareas: [
        {
          id: 1,
          lineaBaseId: 1,
          tareaId: 3,
          codigo: '1.1.1',
          nombre: 'Entrevistas',
          nivel: NivelTarea.SUBACTIVIDAD,
          duracionDias: 3,
          inicioPlan: new Date('2026-11-02T00:00:00.000Z'),
          finPlan: new Date('2026-11-04T00:00:00.000Z'),
          costoPlan: new Decimal(0),
        },
        {
          id: 2,
          lineaBaseId: 1,
          tareaId: null,
          codigo: '1.1.2',
          nombre: 'Tarea sin fechas',
          nivel: NivelTarea.SUBACTIVIDAD,
          duracionDias: 0,
          inicioPlan: null,
          finPlan: null,
          costoPlan: new Decimal(0),
        },
      ],
    };

    const resultado = mapearLineaBaseGantt(entidad);

    expect(resultado).toEqual({
      id: 1,
      version: 1,
      descripcion: 'Linea base inicial',
      creadoEn: '2026-10-31T12:00:00.000Z',
      fechaFinProyecto: '2026-12-10',
      tareas: [
        {
          tareaId: 3,
          codigo: '1.1.1',
          nombre: 'Entrevistas',
          duracionDias: 3,
          inicioPlan: '2026-11-02',
          finPlan: '2026-11-04',
        },
        {
          tareaId: null,
          codigo: '1.1.2',
          nombre: 'Tarea sin fechas',
          duracionDias: 0,
          inicioPlan: null,
          finPlan: null,
        },
      ],
    });
  });

  it('maneja fechaFinProyecto null', () => {
    const entidad: LineaBaseConTareas = {
      id: 2,
      proyectoId: 10,
      version: 2,
      descripcion: null,
      solicitudCambioId: null,
      fechaFinProyecto: null,
      costoPlanTotal: new Decimal(0),
      creadoEn: new Date('2026-10-31T12:00:00.000Z'),
      tareas: [],
    };

    const resultado = mapearLineaBaseGantt(entidad);
    expect(resultado.fechaFinProyecto).toBeNull();
    expect(resultado.descripcion).toBeNull();
    expect(resultado.tareas).toEqual([]);
  });
});
