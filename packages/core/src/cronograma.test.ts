import { describe, expect, it } from 'vitest';
import {
  CALENDARIO_POR_DEFECTO,
  crearCalendarioLaboral,
  DIAS_LABORABLES_POR_DEFECTO,
} from './calendario';
import {
  calcularCronograma,
  CicloDetectadoError,
  compararCodigos,
  DependenciaInvalidaError,
  preverInicioTarea,
  type DependenciaCronograma,
  type TareaCronograma,
} from './cronograma';
import { feriadosChileDesde } from './feriados-chile';
import { sumarDiasCorridos } from './fechas';

describe('cronograma (CPM)', () => {
  const feriados = feriadosChileDesde('2026-01-01').map((f) => f.fecha);
  const calendario = crearCalendarioLaboral({
    diasLaborables: DIAS_LABORABLES_POR_DEFECTO,
    feriados,
  });
  const inicioProyecto = '2026-11-02';

  const tarea = (
    id: number,
    codigo: string,
    duracionDias: number,
    opciones: Partial<Omit<TareaCronograma, 'id' | 'codigo' | 'duracionDias'>> = {},
  ): TareaCronograma => ({
    id,
    codigo,
    padreId: opciones.padreId ?? null,
    duracionDias,
    fechaFija: opciones.fechaFija ?? null,
    inicioReal: opciones.inicioReal ?? null,
    finReal: opciones.finReal ?? null,
  });

  const ejecutarPar = (tipo: 'FS' | 'SS' | 'FF' | 'SF', desfaseDias: number) => {
    const tareas: TareaCronograma[] = [
      {
        id: 1,
        codigo: '1.1',
        padreId: null,
        duracionDias: 3,
        fechaFija: '2026-11-09',
        inicioReal: null,
        finReal: null,
      },
      {
        id: 2,
        codigo: '1.2',
        padreId: null,
        duracionDias: 2,
        fechaFija: null,
        inicioReal: null,
        finReal: null,
      },
    ];
    const dependencias: DependenciaCronograma[] = [
      { predecesoraId: 1, sucesoraId: 2, tipo, desfaseDias },
    ];
    const res = calcularCronograma(tareas, dependencias, calendario, inicioProyecto);
    return res.tareas.find((t) => t.id === 2)!;
  };

  it('calcula correctamente FS con desfase 0', () => {
    const b = ejecutarPar('FS', 0);
    expect(b.inicioTemprano).toBe('2026-11-12');
    expect(b.finTemprano).toBe('2026-11-13');
  });

  it('calcula correctamente FS con desfase +2', () => {
    const b = ejecutarPar('FS', 2);
    expect(b.inicioTemprano).toBe('2026-11-16');
    expect(b.finTemprano).toBe('2026-11-17');
  });

  it('calcula correctamente SS con desfase 0', () => {
    const b = ejecutarPar('SS', 0);
    expect(b.inicioTemprano).toBe('2026-11-09');
    expect(b.finTemprano).toBe('2026-11-10');
  });

  it('calcula correctamente SS con desfase +2', () => {
    const b = ejecutarPar('SS', 2);
    expect(b.inicioTemprano).toBe('2026-11-11');
    expect(b.finTemprano).toBe('2026-11-12');
  });

  it('calcula correctamente FF con desfase 0', () => {
    const b = ejecutarPar('FF', 0);
    expect(b.inicioTemprano).toBe('2026-11-10');
    expect(b.finTemprano).toBe('2026-11-11');
  });

  it('calcula correctamente FF con desfase +2', () => {
    const b = ejecutarPar('FF', 2);
    expect(b.inicioTemprano).toBe('2026-11-12');
    expect(b.finTemprano).toBe('2026-11-13');
  });

  it('calcula correctamente SF con desfase 0', () => {
    const b = ejecutarPar('SF', 0);
    expect(b.inicioTemprano).toBe('2026-11-05');
    expect(b.finTemprano).toBe('2026-11-06');
  });

  it('calcula correctamente SF con desfase +2', () => {
    const b = ejecutarPar('SF', 2);
    expect(b.inicioTemprano).toBe('2026-11-09');
    expect(b.finTemprano).toBe('2026-11-10');
  });

  it('calcula correctamente adelantos negativos en los cuatro tipos', () => {
    const bFs = ejecutarPar('FS', -2);
    expect(bFs.inicioTemprano).toBe('2026-11-10');
    expect(bFs.finTemprano).toBe('2026-11-11');

    const bSs = ejecutarPar('SS', -2);
    expect(bSs.inicioTemprano).toBe('2026-11-05');
    expect(bSs.finTemprano).toBe('2026-11-06');

    const bFf = ejecutarPar('FF', -2);
    expect(bFf.inicioTemprano).toBe('2026-11-06');
    expect(bFf.finTemprano).toBe('2026-11-09');

    const bSf = ejecutarPar('SF', -2);
    expect(bSf.inicioTemprano).toBe('2026-11-03');
    expect(bSf.finTemprano).toBe('2026-11-04');
  });

  it('toma la restriccion mas tardia cuando una tarea tiene varias predecesoras', () => {
    const tareas: TareaCronograma[] = [
      {
        id: 1,
        codigo: '1.1',
        padreId: null,
        duracionDias: 3,
        fechaFija: null,
        inicioReal: null,
        finReal: null,
      },
      {
        id: 2,
        codigo: '1.2',
        padreId: null,
        duracionDias: 5,
        fechaFija: null,
        inicioReal: null,
        finReal: null,
      },
      {
        id: 3,
        codigo: '1.3',
        padreId: null,
        duracionDias: 2,
        fechaFija: null,
        inicioReal: null,
        finReal: null,
      },
    ];
    const dependencias: DependenciaCronograma[] = [
      { predecesoraId: 1, sucesoraId: 3, tipo: 'FS', desfaseDias: 0 },
      { predecesoraId: 2, sucesoraId: 3, tipo: 'FS', desfaseDias: 0 },
    ];
    const res = calcularCronograma(tareas, dependencias, calendario, inicioProyecto);

    const c = res.tareas.find((t) => t.id === 3)!;
    expect(c.inicioTemprano).toBe('2026-11-09');
    expect(c.finTemprano).toBe('2026-11-10');

    const a = res.tareas.find((t) => t.id === 1)!;
    expect(a.holgura).toBe(2);
    expect(a.esCritica).toBe(false);

    const b = res.tareas.find((t) => t.id === 2)!;
    expect(b.holgura).toBe(0);
    expect(b.esCritica).toBe(true);
  });

  it('calcula cadena de 5 tareas en cascada (FS) y todas resultan criticas', () => {
    const tareas: TareaCronograma[] = [
      {
        id: 1,
        codigo: '1',
        padreId: null,
        duracionDias: 2,
        fechaFija: null,
        inicioReal: null,
        finReal: null,
      },
      {
        id: 2,
        codigo: '2',
        padreId: null,
        duracionDias: 3,
        fechaFija: null,
        inicioReal: null,
        finReal: null,
      },
      {
        id: 3,
        codigo: '3',
        padreId: null,
        duracionDias: 1,
        fechaFija: null,
        inicioReal: null,
        finReal: null,
      },
      {
        id: 4,
        codigo: '4',
        padreId: null,
        duracionDias: 4,
        fechaFija: null,
        inicioReal: null,
        finReal: null,
      },
      {
        id: 5,
        codigo: '5',
        padreId: null,
        duracionDias: 2,
        fechaFija: null,
        inicioReal: null,
        finReal: null,
      },
    ];
    const dependencias: DependenciaCronograma[] = [
      { predecesoraId: 1, sucesoraId: 2, tipo: 'FS', desfaseDias: 0 },
      { predecesoraId: 2, sucesoraId: 3, tipo: 'FS', desfaseDias: 0 },
      { predecesoraId: 3, sucesoraId: 4, tipo: 'FS', desfaseDias: 0 },
      { predecesoraId: 4, sucesoraId: 5, tipo: 'FS', desfaseDias: 0 },
    ];
    const res = calcularCronograma(tareas, dependencias, calendario, inicioProyecto);

    expect(res.tareas[0]!.inicioTemprano).toBe('2026-11-02');
    expect(res.tareas[0]!.finTemprano).toBe('2026-11-03');

    expect(res.tareas[1]!.inicioTemprano).toBe('2026-11-04');
    expect(res.tareas[1]!.finTemprano).toBe('2026-11-06');

    expect(res.tareas[2]!.inicioTemprano).toBe('2026-11-09');
    expect(res.tareas[2]!.finTemprano).toBe('2026-11-09');

    expect(res.tareas[3]!.inicioTemprano).toBe('2026-11-10');
    expect(res.tareas[3]!.finTemprano).toBe('2026-11-13');

    expect(res.tareas[4]!.inicioTemprano).toBe('2026-11-16');
    expect(res.tareas[4]!.finTemprano).toBe('2026-11-17');

    for (const t of res.tareas) {
      expect(t.holgura).toBe(0);
      expect(t.esCritica).toBe(true);
    }
  });

  it('salta fin de semana dentro de la cadena correctamente', () => {
    const tareas: TareaCronograma[] = [
      {
        id: 1,
        codigo: '1.1',
        padreId: null,
        duracionDias: 3,
        fechaFija: '2026-11-05',
        inicioReal: null,
        finReal: null,
      },
      {
        id: 2,
        codigo: '1.2',
        padreId: null,
        duracionDias: 2,
        fechaFija: null,
        inicioReal: null,
        finReal: null,
      },
    ];
    const dependencias: DependenciaCronograma[] = [
      { predecesoraId: 1, sucesoraId: 2, tipo: 'FS', desfaseDias: 0 },
    ];
    const res = calcularCronograma(tareas, dependencias, calendario, inicioProyecto);

    const a = res.tareas.find((t) => t.id === 1)!;
    expect(a.inicioTemprano).toBe('2026-11-05');
    expect(a.finTemprano).toBe('2026-11-09');

    const b = res.tareas.find((t) => t.id === 2)!;
    expect(b.inicioTemprano).toBe('2026-11-10');
    expect(b.finTemprano).toBe('2026-11-11');
  });

  it('detecta ciclo directo y devuelve ciclo rotado al menor codigo', () => {
    const tareas: TareaCronograma[] = [
      {
        id: 2,
        codigo: '1.2',
        padreId: null,
        duracionDias: 2,
        fechaFija: null,
        inicioReal: null,
        finReal: null,
      },
      {
        id: 1,
        codigo: '1.1',
        padreId: null,
        duracionDias: 2,
        fechaFija: null,
        inicioReal: null,
        finReal: null,
      },
    ];
    const dependencias: DependenciaCronograma[] = [
      { predecesoraId: 1, sucesoraId: 2, tipo: 'FS', desfaseDias: 0 },
      { predecesoraId: 2, sucesoraId: 1, tipo: 'FS', desfaseDias: 0 },
    ];

    expect(() => calcularCronograma(tareas, dependencias, calendario, inicioProyecto)).toThrowError(
      CicloDetectadoError,
    );

    try {
      calcularCronograma(tareas, dependencias, calendario, inicioProyecto);
    } catch (e) {
      expect(e).toBeInstanceOf(CicloDetectadoError);
      expect((e as CicloDetectadoError).ciclo).toEqual(['1.1', '1.2', '1.1']);
    }
  });

  it('detecta ciclo indirecto con tareas desordenadas y tarea aguas arriba', () => {
    const tareas: TareaCronograma[] = [
      {
        id: 99,
        codigo: '0.1',
        padreId: null,
        duracionDias: 1,
        fechaFija: null,
        inicioReal: null,
        finReal: null,
      },
      {
        id: 3,
        codigo: '2.1',
        padreId: null,
        duracionDias: 2,
        fechaFija: null,
        inicioReal: null,
        finReal: null,
      },
      {
        id: 1,
        codigo: '1.1',
        padreId: null,
        duracionDias: 2,
        fechaFija: null,
        inicioReal: null,
        finReal: null,
      },
      {
        id: 2,
        codigo: '1.2',
        padreId: null,
        duracionDias: 2,
        fechaFija: null,
        inicioReal: null,
        finReal: null,
      },
    ];
    const dependencias: DependenciaCronograma[] = [
      { predecesoraId: 99, sucesoraId: 1, tipo: 'FS', desfaseDias: 0 },
      { predecesoraId: 1, sucesoraId: 2, tipo: 'FS', desfaseDias: 0 },
      { predecesoraId: 2, sucesoraId: 3, tipo: 'FS', desfaseDias: 0 },
      { predecesoraId: 3, sucesoraId: 1, tipo: 'FS', desfaseDias: 0 },
    ];

    try {
      calcularCronograma(tareas, dependencias, calendario, inicioProyecto);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(CicloDetectadoError);
      expect((e as CicloDetectadoError).ciclo).toEqual(['1.1', '1.2', '2.1', '1.1']);
    }
  });

  it('respeta fecha real fija y genera holgura negativa en predecesora si se contradice', () => {
    const tareas: TareaCronograma[] = [
      {
        id: 1,
        codigo: '1.1',
        padreId: null,
        duracionDias: 3,
        fechaFija: null,
        inicioReal: null,
        finReal: null,
      },
      {
        id: 2,
        codigo: '1.2',
        padreId: null,
        duracionDias: 2,
        fechaFija: null,
        inicioReal: '2026-11-03',
        finReal: null,
      },
    ];
    const dependencias: DependenciaCronograma[] = [
      { predecesoraId: 1, sucesoraId: 2, tipo: 'FS', desfaseDias: 0 },
    ];
    const res = calcularCronograma(tareas, dependencias, calendario, inicioProyecto);

    const b = res.tareas.find((t) => t.id === 2)!;
    expect(b.inicioTemprano).toBe('2026-11-03');

    const a = res.tareas.find((t) => t.id === 1)!;
    expect(a.holgura).toBe(-2);
    expect(a.esCritica).toBe(true);
  });

  it('calcula la ruta critica del seed exactamente segun el ejemplo manual', () => {
    const tareas: TareaCronograma[] = [
      {
        id: 1,
        codigo: '1',
        padreId: null,
        duracionDias: 0,
        fechaFija: null,
        inicioReal: null,
        finReal: null,
      },
      {
        id: 2,
        codigo: '1.1',
        padreId: 1,
        duracionDias: 0,
        fechaFija: null,
        inicioReal: null,
        finReal: null,
      },
      {
        id: 3,
        codigo: '1.1.1',
        padreId: 2,
        duracionDias: 3,
        fechaFija: null,
        inicioReal: null,
        finReal: null,
      },
      {
        id: 4,
        codigo: '1.1.2',
        padreId: 2,
        duracionDias: 4,
        fechaFija: null,
        inicioReal: null,
        finReal: null,
      },
      {
        id: 5,
        codigo: '1.2',
        padreId: 1,
        duracionDias: 0,
        fechaFija: null,
        inicioReal: null,
        finReal: null,
      },
      {
        id: 6,
        codigo: '1.2.1',
        padreId: 5,
        duracionDias: 5,
        fechaFija: null,
        inicioReal: null,
        finReal: null,
      },
      {
        id: 7,
        codigo: '1.2.2',
        padreId: 5,
        duracionDias: 4,
        fechaFija: null,
        inicioReal: null,
        finReal: null,
      },
      {
        id: 8,
        codigo: '2',
        padreId: null,
        duracionDias: 0,
        fechaFija: null,
        inicioReal: null,
        finReal: null,
      },
      {
        id: 9,
        codigo: '2.1',
        padreId: 8,
        duracionDias: 0,
        fechaFija: null,
        inicioReal: null,
        finReal: null,
      },
      {
        id: 10,
        codigo: '2.1.1',
        padreId: 9,
        duracionDias: 6,
        fechaFija: null,
        inicioReal: null,
        finReal: null,
      },
      {
        id: 11,
        codigo: '2.1.2',
        padreId: 9,
        duracionDias: 8,
        fechaFija: null,
        inicioReal: null,
        finReal: null,
      },
      {
        id: 12,
        codigo: '2.2',
        padreId: 8,
        duracionDias: 0,
        fechaFija: null,
        inicioReal: null,
        finReal: null,
      },
      {
        id: 13,
        codigo: '2.2.1',
        padreId: 12,
        duracionDias: 5,
        fechaFija: null,
        inicioReal: null,
        finReal: null,
      },
    ];

    const dependencias: DependenciaCronograma[] = [
      { predecesoraId: 3, sucesoraId: 4, tipo: 'FS', desfaseDias: 0 },
      { predecesoraId: 4, sucesoraId: 6, tipo: 'SS', desfaseDias: 2 },
      { predecesoraId: 6, sucesoraId: 7, tipo: 'SS', desfaseDias: 3 },
      { predecesoraId: 4, sucesoraId: 7, tipo: 'FF', desfaseDias: 5 },
      { predecesoraId: 6, sucesoraId: 10, tipo: 'FS', desfaseDias: 0 },
      { predecesoraId: 10, sucesoraId: 11, tipo: 'FS', desfaseDias: 0 },
      { predecesoraId: 11, sucesoraId: 13, tipo: 'SS', desfaseDias: 7 },
    ];

    const res = calcularCronograma(tareas, dependencias, calendario, inicioProyecto);

    expect(res.finProyecto).toBe('2026-12-10');

    const porCod = Object.fromEntries(res.tareas.map((t) => [t.codigo, t]));

    expect(porCod['1.1.1']!.inicioTemprano).toBe('2026-11-02');
    expect(porCod['1.1.1']!.finTemprano).toBe('2026-11-04');
    expect(porCod['1.1.1']!.inicioTardio).toBe('2026-11-02');
    expect(porCod['1.1.1']!.finTardio).toBe('2026-11-04');
    expect(porCod['1.1.1']!.holgura).toBe(0);
    expect(porCod['1.1.1']!.esCritica).toBe(true);

    expect(porCod['1.1.2']!.inicioTemprano).toBe('2026-11-05');
    expect(porCod['1.1.2']!.finTemprano).toBe('2026-11-10');
    expect(porCod['1.1.2']!.inicioTardio).toBe('2026-11-05');
    expect(porCod['1.1.2']!.finTardio).toBe('2026-11-10');
    expect(porCod['1.1.2']!.holgura).toBe(0);
    expect(porCod['1.1.2']!.esCritica).toBe(true);

    expect(porCod['1.2.1']!.inicioTemprano).toBe('2026-11-09');
    expect(porCod['1.2.1']!.finTemprano).toBe('2026-11-13');
    expect(porCod['1.2.1']!.inicioTardio).toBe('2026-11-09');
    expect(porCod['1.2.1']!.finTardio).toBe('2026-11-13');
    expect(porCod['1.2.1']!.holgura).toBe(0);
    expect(porCod['1.2.1']!.esCritica).toBe(true);

    expect(porCod['1.2.2']!.inicioTemprano).toBe('2026-11-12');
    expect(porCod['1.2.2']!.finTemprano).toBe('2026-11-17');
    expect(porCod['1.2.2']!.inicioTardio).toBe('2026-12-04');
    expect(porCod['1.2.2']!.finTardio).toBe('2026-12-10');
    expect(porCod['1.2.2']!.holgura).toBe(16);
    expect(porCod['1.2.2']!.esCritica).toBe(false);

    expect(porCod['2.1.1']!.inicioTemprano).toBe('2026-11-16');
    expect(porCod['2.1.1']!.finTemprano).toBe('2026-11-23');
    expect(porCod['2.1.1']!.inicioTardio).toBe('2026-11-16');
    expect(porCod['2.1.1']!.finTardio).toBe('2026-11-23');
    expect(porCod['2.1.1']!.holgura).toBe(0);
    expect(porCod['2.1.1']!.esCritica).toBe(true);

    expect(porCod['2.1.2']!.inicioTemprano).toBe('2026-11-24');
    expect(porCod['2.1.2']!.finTemprano).toBe('2026-12-03');
    expect(porCod['2.1.2']!.inicioTardio).toBe('2026-11-24');
    expect(porCod['2.1.2']!.finTardio).toBe('2026-12-03');
    expect(porCod['2.1.2']!.holgura).toBe(0);
    expect(porCod['2.1.2']!.esCritica).toBe(true);

    expect(porCod['2.2.1']!.inicioTemprano).toBe('2026-12-03');
    expect(porCod['2.2.1']!.finTemprano).toBe('2026-12-10');
    expect(porCod['2.2.1']!.inicioTardio).toBe('2026-12-03');
    expect(porCod['2.2.1']!.finTardio).toBe('2026-12-10');
    expect(porCod['2.2.1']!.holgura).toBe(0);
    expect(porCod['2.2.1']!.esCritica).toBe(true);

    expect(porCod['1.2']!.inicioTemprano).toBe('2026-11-09');
    expect(porCod['1.2']!.finTardio).toBe('2026-12-10');
    expect(porCod['1.2']!.holgura).toBe(0);
    expect(porCod['1.2']!.esCritica).toBe(true);
  });

  it('no consume dias en hito de duracion 0 dentro de cadena FS', () => {
    const tareas: TareaCronograma[] = [
      {
        id: 1,
        codigo: '1',
        padreId: null,
        duracionDias: 3,
        fechaFija: null,
        inicioReal: null,
        finReal: null,
      },
      {
        id: 2,
        codigo: '2',
        padreId: null,
        duracionDias: 0,
        fechaFija: null,
        inicioReal: null,
        finReal: null,
      },
      {
        id: 3,
        codigo: '3',
        padreId: null,
        duracionDias: 2,
        fechaFija: null,
        inicioReal: null,
        finReal: null,
      },
    ];
    const dependencias: DependenciaCronograma[] = [
      { predecesoraId: 1, sucesoraId: 2, tipo: 'FS', desfaseDias: 0 },
      { predecesoraId: 2, sucesoraId: 3, tipo: 'FS', desfaseDias: 0 },
    ];
    const res = calcularCronograma(tareas, dependencias, calendario, inicioProyecto);

    const a = res.tareas.find((t) => t.id === 1)!;
    expect(a.finTemprano).toBe('2026-11-04');

    const h = res.tareas.find((t) => t.id === 2)!;
    expect(h.inicioTemprano).toBe('2026-11-04');
    expect(h.finTemprano).toBe('2026-11-04');

    const b = res.tareas.find((t) => t.id === 3)!;
    expect(b.inicioTemprano).toBe('2026-11-05');
    expect(b.finTemprano).toBe('2026-11-06');
  });

  it('lanza DependenciaInvalidaError ante dependencias no permitidas', () => {
    const tareas: TareaCronograma[] = [
      {
        id: 1,
        codigo: '1',
        padreId: null,
        duracionDias: 0,
        fechaFija: null,
        inicioReal: null,
        finReal: null,
      },
      {
        id: 2,
        codigo: '1.1',
        padreId: 1,
        duracionDias: 2,
        fechaFija: null,
        inicioReal: null,
        finReal: null,
      },
      {
        id: 3,
        codigo: '1.2',
        padreId: 1,
        duracionDias: 2,
        fechaFija: null,
        inicioReal: null,
        finReal: null,
      },
    ];

    expect(() =>
      calcularCronograma(
        tareas,
        [{ predecesoraId: 2, sucesoraId: 2, tipo: 'FS', desfaseDias: 0 }],
        calendario,
        inicioProyecto,
      ),
    ).toThrowError(DependenciaInvalidaError);

    expect(() =>
      calcularCronograma(
        tareas,
        [{ predecesoraId: 2, sucesoraId: 999, tipo: 'FS', desfaseDias: 0 }],
        calendario,
        inicioProyecto,
      ),
    ).toThrowError(DependenciaInvalidaError);

    expect(() =>
      calcularCronograma(
        tareas,
        [{ predecesoraId: 1, sucesoraId: 2, tipo: 'FS', desfaseDias: 0 }],
        calendario,
        inicioProyecto,
      ),
    ).toThrowError(DependenciaInvalidaError);

    expect(() =>
      calcularCronograma(
        tareas,
        [
          { predecesoraId: 2, sucesoraId: 3, tipo: 'FS', desfaseDias: 0 },
          { predecesoraId: 2, sucesoraId: 3, tipo: 'SS', desfaseDias: 0 },
        ],
        calendario,
        inicioProyecto,
      ),
    ).toThrowError(DependenciaInvalidaError);

    expect(() =>
      calcularCronograma(
        tareas,
        [{ predecesoraId: 2, sucesoraId: 3, tipo: 'FS', desfaseDias: 1.5 }],
        calendario,
        inicioProyecto,
      ),
    ).toThrowError(DependenciaInvalidaError);
  });

  it('lanza RangeError ante duraciones no validas', () => {
    const tareas: TareaCronograma[] = [
      {
        id: 1,
        codigo: '1.1',
        padreId: null,
        duracionDias: -1,
        fechaFija: null,
        inicioReal: null,
        finReal: null,
      },
    ];
    expect(() => calcularCronograma(tareas, [], calendario, inicioProyecto)).toThrowError(
      RangeError,
    );

    const tareasDecimal: TareaCronograma[] = [
      {
        id: 1,
        codigo: '1.1',
        padreId: null,
        duracionDias: 2.5,
        fechaFija: null,
        inicioReal: null,
        finReal: null,
      },
    ];
    expect(() => calcularCronograma(tareasDecimal, [], calendario, inicioProyecto)).toThrowError(
      RangeError,
    );
  });

  it('retorna el mismo resultado con orden barajado de entrada', () => {
    const tareasOriginales: TareaCronograma[] = [
      {
        id: 1,
        codigo: '1.1',
        padreId: null,
        duracionDias: 3,
        fechaFija: null,
        inicioReal: null,
        finReal: null,
      },
      {
        id: 2,
        codigo: '1.2',
        padreId: null,
        duracionDias: 2,
        fechaFija: null,
        inicioReal: null,
        finReal: null,
      },
      {
        id: 3,
        codigo: '1.3',
        padreId: null,
        duracionDias: 4,
        fechaFija: null,
        inicioReal: null,
        finReal: null,
      },
    ];
    const depsOriginales: DependenciaCronograma[] = [
      { predecesoraId: 1, sucesoraId: 2, tipo: 'FS', desfaseDias: 1 },
      { predecesoraId: 2, sucesoraId: 3, tipo: 'SS', desfaseDias: 2 },
    ];

    const r1 = calcularCronograma(tareasOriginales, depsOriginales, calendario, inicioProyecto);

    const tareasBarajadas = [tareasOriginales[2]!, tareasOriginales[0]!, tareasOriginales[1]!];
    const depsBarajadas = [depsOriginales[1]!, depsOriginales[0]!];
    const r2 = calcularCronograma(tareasBarajadas, depsBarajadas, calendario, inicioProyecto);

    for (const t1 of r1.tareas) {
      const t2 = r2.tareas.find((t) => t.id === t1.id)!;
      expect(t1).toEqual(t2);
    }
  });

  it('procesa correctamente proyecto sin tareas', () => {
    const res = calcularCronograma([], [], calendario, inicioProyecto);
    expect(res).toEqual({ finProyecto: null, tareas: [] });
  });

  it('compara codigos jerarquicos con orden natural', () => {
    expect(compararCodigos('1.2', '1.10')).toBeLessThan(0);
    expect(compararCodigos('1.10', '1.2')).toBeGreaterThan(0);
    expect(compararCodigos('1.1.1', '1.1.1')).toBe(0);
    expect(compararCodigos('2', '1.9.9')).toBeGreaterThan(0);
  });

  it('ejecuta 500 tareas y 800 dependencias en menos de 200 ms (rendimiento)', () => {
    const totalTareas = 500;
    const totalDeps = 800;

    let semilla = 123456789;
    const aleatorio = () => {
      semilla = (semilla * 1103515245 + 12345) % 2147483648;
      return semilla / 2147483648;
    };

    const tareas: TareaCronograma[] = Array.from({ length: totalTareas }, (_, i) => ({
      id: i + 1,
      codigo: `T.${i + 1}`,
      padreId: null,
      duracionDias: 1 + Math.floor(aleatorio() * 10),
      fechaFija: null,
      inicioReal: null,
      finReal: null,
    }));

    const pares = new Set<string>();
    const dependencias: DependenciaCronograma[] = [];
    const tipos = ['FS', 'SS', 'FF', 'SF'] as const;

    while (dependencias.length < totalDeps) {
      const u = 1 + Math.floor(aleatorio() * (totalTareas - 1));
      const v = u + 1 + Math.floor(aleatorio() * (totalTareas - u));
      const clave = `${u}-${v}`;
      if (!pares.has(clave)) {
        pares.add(clave);
        dependencias.push({
          predecesoraId: u,
          sucesoraId: v,
          tipo: tipos[Math.floor(aleatorio() * tipos.length)]!,
          desfaseDias: Math.floor(aleatorio() * 3),
        });
      }
    }

    calcularCronograma(tareas, dependencias, calendario, inicioProyecto);

    const inicio = performance.now();
    const resultado = calcularCronograma(tareas, dependencias, calendario, inicioProyecto);
    const duracion = performance.now() - inicio;

    expect(resultado.tareas).toHaveLength(totalTareas);
    expect(resultado.finProyecto).not.toBeNull();
    expect(duracion).toBeLessThan(200);
  });

  it('normaliza el limite tardio cuando el proyecto termina en un dia no habil', () => {
    const r = calcularCronograma(
      [
        tarea(1, 'A', 2, { inicioReal: '2026-11-06', finReal: '2026-11-07' }),
        tarea(2, 'B', 1),
        tarea(3, 'C', 2),
      ],
      [],
      CALENDARIO_POR_DEFECTO,
      '2026-11-02',
    );
    const [a, b, c] = r.tareas;
    expect(r.finProyecto).toBe('2026-11-07');
    expect([b?.inicioTardio, b?.finTardio, b?.holgura]).toEqual(['2026-11-06', '2026-11-06', 4]);
    expect([c?.inicioTardio, c?.finTardio, c?.holgura]).toEqual(['2026-11-05', '2026-11-06', 3]);
    expect([a?.holgura, a?.esCritica]).toEqual([0, true]);
  });

  it('mide la holgura al fin cuando el inicio real cae en un dia no habil', () => {
    const r = calcularCronograma(
      [
        tarea(1, 'A', 1, { inicioReal: '2026-11-07' }),
        tarea(2, 'B', 2, { fechaFija: '2026-11-03' }),
      ],
      [{ predecesoraId: 1, sucesoraId: 2, tipo: 'FS', desfaseDias: 0 }],
      CALENDARIO_POR_DEFECTO,
      '2026-11-02',
    );
    expect(r.tareas.map((t) => [t.holgura, t.esCritica])).toEqual([
      [0, true],
      [0, true],
    ]);
  });
});

describe('base del paso hacia adelante', () => {
  const tareaConFechaFija = (fechaFija: string | null) => ({
    id: 1,
    codigo: '1',
    padreId: null,
    duracionDias: 2,
    fechaFija,
    inicioReal: null,
    finReal: null,
  });

  it('una fecha fija anterior al inicio del proyecto no adelanta la tarea', () => {
    const r = calcularCronograma(
      [tareaConFechaFija('2026-10-26')],
      [],
      CALENDARIO_POR_DEFECTO,
      '2026-11-02',
    );
    expect(r.tareas[0]?.inicioTemprano).toBe('2026-11-02');
  });
  it('una fecha fija posterior se respeta y se normaliza al siguiente día hábil', () => {
    const r = calcularCronograma(
      [tareaConFechaFija('2026-11-07')],
      [],
      CALENDARIO_POR_DEFECTO,
      '2026-11-02',
    );
    expect(r.tareas[0]?.inicioTemprano).toBe('2026-11-09');
  });
  it('un inicio de proyecto en sábado se normaliza', () => {
    const r = calcularCronograma(
      [tareaConFechaFija(null)],
      [],
      CALENDARIO_POR_DEFECTO,
      '2026-10-31',
    );
    expect(r.tareas[0]?.inicioTemprano).toBe('2026-11-02');
  });
});

describe('preverInicioTarea', () => {
  const feriados = feriadosChileDesde('2026-01-01').map((f) => f.fecha);
  const calChile = crearCalendarioLaboral({
    diasLaborables: DIAS_LABORABLES_POR_DEFECTO,
    feriados,
  });
  const inicioProyecto = '2026-11-02';

  const t112: TareaCronograma = {
    id: 4,
    codigo: '1.1.2',
    padreId: 2,
    duracionDias: 4,
    fechaFija: null,
    inicioReal: '2026-11-05',
    finReal: null,
  };
  const t121: TareaCronograma = {
    id: 6,
    codigo: '1.2.1',
    padreId: 5,
    duracionDias: 5,
    fechaFija: null,
    inicioReal: null,
    finReal: null,
  };
  const t122: TareaCronograma = {
    id: 7,
    codigo: '1.2.2',
    padreId: 5,
    duracionDias: 4,
    fechaFija: null,
    inicioReal: null,
    finReal: null,
  };
  const t222: TareaCronograma = {
    id: 14,
    codigo: '2.2.2',
    padreId: 12,
    duracionDias: 2,
    fechaFija: '2026-11-23',
    inicioReal: null,
    finReal: null,
  };

  const fechasPredecesoras = new Map<number, { inicioPlan: string; finPlan: string }>([
    [3, { inicioPlan: '2026-11-02', finPlan: '2026-11-04' }],
    [4, { inicioPlan: '2026-11-05', finPlan: '2026-11-10' }],
    [6, { inicioPlan: '2026-11-09', finPlan: '2026-11-13' }],
    [7, { inicioPlan: '2026-11-12', finPlan: '2026-11-17' }],
    [10, { inicioPlan: '2026-11-16', finPlan: '2026-11-23' }],
    [11, { inicioPlan: '2026-11-24', finPlan: '2026-12-03' }],
    [13, { inicioPlan: '2026-12-03', finPlan: '2026-12-10' }],
    [14, { inicioPlan: '2026-11-23', finPlan: '2026-11-24' }],
  ]);

  const d4_6: DependenciaCronograma = {
    predecesoraId: 4,
    sucesoraId: 6,
    tipo: 'SS',
    desfaseDias: 2,
  };
  const d6_7: DependenciaCronograma = {
    predecesoraId: 6,
    sucesoraId: 7,
    tipo: 'SS',
    desfaseDias: 3,
  };
  const d4_7: DependenciaCronograma = {
    predecesoraId: 4,
    sucesoraId: 7,
    tipo: 'FF',
    desfaseDias: 5,
  };
  const d6_14_sf: DependenciaCronograma = {
    predecesoraId: 6,
    sucesoraId: 14,
    tipo: 'SF',
    desfaseDias: 0,
  };

  it('1.2.1 con fechaFija null preve inicio 2026-11-09 por SS+2 con 1.1.2', () => {
    const res = preverInicioTarea(
      { ...t121, fechaFija: null },
      [d4_6],
      fechasPredecesoras,
      calChile,
      inicioProyecto,
    );
    expect(res).toEqual({
      inicioPlan: '2026-11-09',
      finPlan: '2026-11-13',
      limitante: { tipo: 'DEPENDENCIA', dependencia: d4_6 },
    });
  });

  it('1.2.1 con fechaFija 2026-11-11 preve inicio 2026-11-11 por FECHA_FIJA', () => {
    const res = preverInicioTarea(
      { ...t121, fechaFija: '2026-11-11' },
      [d4_6],
      fechasPredecesoras,
      calChile,
      inicioProyecto,
    );
    expect(res).toEqual({
      inicioPlan: '2026-11-11',
      finPlan: '2026-11-17',
      limitante: { tipo: 'FECHA_FIJA' },
    });
  });

  it('1.2.2 con duracion 7 preve inicio 2026-11-12 y fin 2026-11-20 por SS+3 con 1.2.1', () => {
    const res = preverInicioTarea(
      { ...t122, duracionDias: 7 },
      [d6_7, d4_7],
      fechasPredecesoras,
      calChile,
      inicioProyecto,
    );
    expect(res).toEqual({
      inicioPlan: '2026-11-12',
      finPlan: '2026-11-20',
      limitante: { tipo: 'DEPENDENCIA', dependencia: d6_7 },
    });
  });

  it('1.2.2 con duracion 3 preve inicio 2026-11-13 y fin 2026-11-17 por FF+5 con 1.1.2', () => {
    const res = preverInicioTarea(
      { ...t122, duracionDias: 3 },
      [d6_7, d4_7],
      fechasPredecesoras,
      calChile,
      inicioProyecto,
    );
    expect(res).toEqual({
      inicioPlan: '2026-11-13',
      finPlan: '2026-11-17',
      limitante: { tipo: 'DEPENDENCIA', dependencia: d4_7 },
    });
  });

  it('1.2.2 con duracion 1 preve inicio 2026-11-17 y fin 2026-11-17 por FF+5 con 1.1.2', () => {
    const res = preverInicioTarea(
      { ...t122, duracionDias: 1 },
      [d6_7, d4_7],
      fechasPredecesoras,
      calChile,
      inicioProyecto,
    );
    expect(res).toEqual({
      inicioPlan: '2026-11-17',
      finPlan: '2026-11-17',
      limitante: { tipo: 'DEPENDENCIA', dependencia: d4_7 },
    });
  });

  it('2.2.2 sin SF con fechaFija null preve inicio 2026-11-02 por PROYECTO', () => {
    const res = preverInicioTarea(
      { ...t222, fechaFija: null },
      [],
      fechasPredecesoras,
      calChile,
      inicioProyecto,
    );
    expect(res).toEqual({
      inicioPlan: '2026-11-02',
      finPlan: '2026-11-03',
      limitante: { tipo: 'PROYECTO' },
    });
  });

  it('2.2.2 con SF+0 de 1.2.1 con fechaFija null preve inicio 2026-11-05 por SF+0', () => {
    const res = preverInicioTarea(
      { ...t222, fechaFija: null },
      [d6_14_sf],
      fechasPredecesoras,
      calChile,
      inicioProyecto,
    );
    expect(res).toEqual({
      inicioPlan: '2026-11-05',
      finPlan: '2026-11-06',
      limitante: { tipo: 'DEPENDENCIA', dependencia: d6_14_sf },
    });
  });

  it('1.1.2 con duracion 6 preve inicio 2026-11-05 y fin 2026-11-12 por FECHA_REAL', () => {
    const res = preverInicioTarea(
      { ...t112, duracionDias: 6 },
      [],
      fechasPredecesoras,
      calChile,
      inicioProyecto,
    );
    expect(res).toEqual({
      inicioPlan: '2026-11-05',
      finPlan: '2026-11-12',
      limitante: { tipo: 'FECHA_REAL' },
    });
  });

  it('coincide con calcularCronograma para cada hoja sin inicioReal y cada fecha entre -10 y +15 dias', () => {
    const tareasBase: TareaCronograma[] = [
      {
        id: 1,
        codigo: '1',
        padreId: null,
        duracionDias: 1,
        fechaFija: null,
        inicioReal: null,
        finReal: null,
      },
      {
        id: 2,
        codigo: '1.1',
        padreId: 1,
        duracionDias: 1,
        fechaFija: null,
        inicioReal: null,
        finReal: null,
      },
      {
        id: 3,
        codigo: '1.1.1',
        padreId: 2,
        duracionDias: 3,
        fechaFija: null,
        inicioReal: '2026-11-02',
        finReal: '2026-11-04',
      },
      {
        id: 4,
        codigo: '1.1.2',
        padreId: 2,
        duracionDias: 4,
        fechaFija: null,
        inicioReal: '2026-11-05',
        finReal: null,
      },
      {
        id: 5,
        codigo: '1.2',
        padreId: 1,
        duracionDias: 1,
        fechaFija: null,
        inicioReal: null,
        finReal: null,
      },
      {
        id: 6,
        codigo: '1.2.1',
        padreId: 5,
        duracionDias: 5,
        fechaFija: null,
        inicioReal: null,
        finReal: null,
      },
      {
        id: 7,
        codigo: '1.2.2',
        padreId: 5,
        duracionDias: 4,
        fechaFija: null,
        inicioReal: null,
        finReal: null,
      },
      {
        id: 8,
        codigo: '2',
        padreId: null,
        duracionDias: 1,
        fechaFija: null,
        inicioReal: null,
        finReal: null,
      },
      {
        id: 9,
        codigo: '2.1',
        padreId: 8,
        duracionDias: 1,
        fechaFija: null,
        inicioReal: null,
        finReal: null,
      },
      {
        id: 10,
        codigo: '2.1.1',
        padreId: 9,
        duracionDias: 6,
        fechaFija: null,
        inicioReal: null,
        finReal: null,
      },
      {
        id: 11,
        codigo: '2.1.2',
        padreId: 9,
        duracionDias: 8,
        fechaFija: null,
        inicioReal: null,
        finReal: null,
      },
      {
        id: 12,
        codigo: '2.2',
        padreId: 8,
        duracionDias: 1,
        fechaFija: null,
        inicioReal: null,
        finReal: null,
      },
      {
        id: 13,
        codigo: '2.2.1',
        padreId: 12,
        duracionDias: 5,
        fechaFija: null,
        inicioReal: null,
        finReal: null,
      },
      {
        id: 14,
        codigo: '2.2.2',
        padreId: 12,
        duracionDias: 2,
        fechaFija: '2026-11-23',
        inicioReal: null,
        finReal: null,
      },
    ];
    const depsBase: DependenciaCronograma[] = [
      { predecesoraId: 3, sucesoraId: 4, tipo: 'FS', desfaseDias: 0 },
      { predecesoraId: 4, sucesoraId: 6, tipo: 'SS', desfaseDias: 2 },
      { predecesoraId: 6, sucesoraId: 7, tipo: 'SS', desfaseDias: 3 },
      { predecesoraId: 4, sucesoraId: 7, tipo: 'FF', desfaseDias: 5 },
      { predecesoraId: 6, sucesoraId: 10, tipo: 'FS', desfaseDias: 0 },
      { predecesoraId: 10, sucesoraId: 11, tipo: 'FS', desfaseDias: 0 },
      { predecesoraId: 11, sucesoraId: 13, tipo: 'SS', desfaseDias: 7 },
      { predecesoraId: 6, sucesoraId: 14, tipo: 'SF', desfaseDias: 0 },
    ];

    const cpmBase = calcularCronograma(tareasBase, depsBase, calChile, inicioProyecto);
    const mapaBase = new Map(
      cpmBase.tareas.map((t) => [t.id, { inicioPlan: t.inicioTemprano, finPlan: t.finTemprano }]),
    );

    const hojasSinReal = tareasBase.filter(
      (t) => !tareasBase.some((h) => h.padreId === t.id) && t.inicioReal === null,
    );

    for (const hoja of hojasSinReal) {
      const entrantes = depsBase.filter((d) => d.sucesoraId === hoja.id);
      for (let offset = -10; offset <= 15; offset += 1) {
        const fechaCandidata = sumarDiasCorridos(inicioProyecto, offset);
        const tareaMod = { ...hoja, fechaFija: fechaCandidata };
        const prevision = preverInicioTarea(
          tareaMod,
          entrantes,
          mapaBase,
          calChile,
          inicioProyecto,
        );

        const tareasMod = tareasBase.map((t) => (t.id === hoja.id ? tareaMod : t));
        const cpmMod = calcularCronograma(tareasMod, depsBase, calChile, inicioProyecto);
        const resultadoHoja = cpmMod.tareas.find((t) => t.id === hoja.id)!;

        expect(prevision.inicioPlan).toBe(resultadoHoja.inicioTemprano);
        expect(prevision.finPlan).toBe(resultadoHoja.finTemprano);
      }
    }
  });
});
