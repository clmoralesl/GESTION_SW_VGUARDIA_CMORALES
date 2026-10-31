import { describe, expect, it } from 'vitest';
import {
  crearCalendarioLaboral,
  DIAS_LABORABLES_POR_DEFECTO,
  feriadosChileDesde,
  type DependenciaTarea,
  type HitoConEstado,
  type TareaArbol,
} from '@autofix/core';
import { construirModeloGantt } from './modelo-gantt';

describe('construirModeloGantt', () => {
  const feriados = feriadosChileDesde('2026-01-01').map((f) => f.fecha);
  const calendario = crearCalendarioLaboral({
    diasLaborables: DIAS_LABORABLES_POR_DEFECTO,
    feriados,
  });

  const crearTarea = (
    id: number,
    codigo: string,
    padreId: number | null,
    duracionDias: number,
    inicioPlan: string,
    finPlan: string,
    tieneHijas: boolean,
    esCritica: boolean,
  ): TareaArbol => ({
    id,
    codigo,
    padreId,
    nombre: `Tarea ${codigo}`,
    descripcion: null,
    responsable: 'Responsable',
    duracionDias,
    porcentajeAvance: 0,
    inicioPlan,
    finPlan,
    inicioTardio: inicioPlan,
    finTardio: finPlan,
    holguraDias: esCritica ? 0 : 5,
    esCritica,
    fechaFija: null,
    inicioReal: null,
    finReal: null,
    nivel: padreId === null ? 'ETAPA' : tieneHijas ? 'ACTIVIDAD' : 'SUBACTIVIDAD',
    orden: id,
    tieneHijas,
  });

  const tareasSeed: TareaArbol[] = [
    crearTarea(1, '1', null, 12, '2026-11-02', '2026-11-17', true, true),
    crearTarea(2, '1.1', 1, 7, '2026-11-02', '2026-11-10', true, true),
    crearTarea(3, '1.1.1', 2, 3, '2026-11-02', '2026-11-04', false, true),
    crearTarea(4, '1.1.2', 2, 4, '2026-11-05', '2026-11-10', false, true),
    crearTarea(5, '1.2', 1, 7, '2026-11-09', '2026-11-17', true, true),
    crearTarea(6, '1.2.1', 5, 5, '2026-11-09', '2026-11-13', false, true),
    crearTarea(7, '1.2.2', 5, 4, '2026-11-12', '2026-11-17', false, false),
    crearTarea(8, '2', null, 18, '2026-11-16', '2026-12-10', true, true),
    crearTarea(9, '2.1', 8, 14, '2026-11-16', '2026-12-03', true, true),
    crearTarea(10, '2.1.1', 9, 6, '2026-11-16', '2026-11-23', false, true),
    crearTarea(11, '2.1.2', 9, 8, '2026-11-24', '2026-12-03', false, true),
    crearTarea(12, '2.2', 8, 13, '2026-11-23', '2026-12-10', true, true),
    crearTarea(13, '2.2.1', 12, 5, '2026-12-03', '2026-12-10', false, true),
    crearTarea(14, '2.2.2', 12, 2, '2026-11-23', '2026-11-24', false, false),
  ];

  const dependenciasSeed: DependenciaTarea[] = [
    { id: 1, predecesoraId: 3, sucesoraId: 4, tipo: 'FS', desfaseDias: 0 },
    { id: 2, predecesoraId: 4, sucesoraId: 6, tipo: 'SS', desfaseDias: 2 },
    { id: 3, predecesoraId: 6, sucesoraId: 7, tipo: 'SS', desfaseDias: 3 },
    { id: 4, predecesoraId: 4, sucesoraId: 7, tipo: 'FF', desfaseDias: 5 },
    { id: 5, predecesoraId: 6, sucesoraId: 10, tipo: 'FS', desfaseDias: 0 },
    { id: 6, predecesoraId: 10, sucesoraId: 11, tipo: 'FS', desfaseDias: 0 },
    { id: 7, predecesoraId: 11, sucesoraId: 13, tipo: 'SS', desfaseDias: 7 },
    { id: 8, predecesoraId: 6, sucesoraId: 14, tipo: 'SF', desfaseDias: 0 },
  ];

  const hitosSeed: HitoConEstado[] = [
    {
      id: 1,
      proyectoId: 1,
      nombre: 'Acta de inicio aprobada',
      fechaObjetivo: '2026-10-30',
      fechaCumplimiento: '2026-10-29',
      criterio: null,
      responsable: null,
      tarea: null,
      estado: 'CUMPLIDO',
      aTiempo: true,
      diasHabilesRestantes: 0,
    },
    {
      id: 2,
      proyectoId: 1,
      nombre: 'Procesos del taller levantados',
      fechaObjetivo: '2026-11-06',
      fechaCumplimiento: null,
      criterio: null,
      responsable: null,
      tarea: {
        id: 2,
        codigo: '1.1',
        nombre: 'Levantamiento de procesos del taller',
        finPlan: '2026-11-10',
        porcentajeAvance: 60,
      },
      estado: 'ATRASADO',
      aTiempo: false,
      diasHabilesRestantes: -2,
    },
  ];

  it('construye 14 filas y 8 flechas cuando no hay tareas colapsadas', () => {
    const modelo = construirModeloGantt({
      tareas: tareasSeed,
      colapsadas: new Set(),
      dependencias: dependenciasSeed,
      hitos: hitosSeed,
      lineaBase: null,
      calendario,
      hoy: '2026-10-31',
      zoom: 'DIA',
      rutaCriticaActiva: false,
    });

    expect(modelo.filas.length).toBe(14);
    expect(modelo.flechas.length).toBe(8);

    const hito11 = modelo.hitos.find((h) => h.id === 2);
    expect(hito11?.filaIndex).toBe(1);
  });

  it('colapsar 1 deja 8 filas y el hito de 1.1 sube a la fila de 1', () => {
    const modelo = construirModeloGantt({
      tareas: tareasSeed,
      colapsadas: new Set([1]),
      dependencias: dependenciasSeed,
      hitos: hitosSeed,
      lineaBase: null,
      calendario,
      hoy: '2026-10-31',
      zoom: 'DIA',
      rutaCriticaActiva: false,
    });

    expect(modelo.filas.length).toBe(8);
    expect(modelo.filas.map((f) => f.tarea.codigo)).toEqual([
      '1',
      '2',
      '2.1',
      '2.1.1',
      '2.1.2',
      '2.2',
      '2.2.1',
      '2.2.2',
    ]);

    expect(modelo.flechas.length).toBe(2);

    const hito11 = modelo.hitos.find((h) => h.id === 2);
    expect(hito11?.filaIndex).toBe(0);
  });

  it('asigna filaIndex null a hitos sin tarea', () => {
    const modelo = construirModeloGantt({
      tareas: tareasSeed,
      colapsadas: new Set(),
      dependencias: dependenciasSeed,
      hitos: hitosSeed,
      lineaBase: null,
      calendario,
      hoy: '2026-10-31',
      zoom: 'DIA',
      rutaCriticaActiva: false,
    });

    const hitoSinTarea = modelo.hitos.find((h) => h.id === 1);
    expect(hitoSinTarea?.filaIndex).toBeNull();
  });
});
