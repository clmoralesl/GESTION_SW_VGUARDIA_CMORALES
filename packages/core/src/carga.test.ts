import { describe, expect, it } from 'vitest';
import {
  calcularCargaDiaria,
  cargaSemanal,
  claveSobreasignacion,
  detectarSobreasignaciones,
  picoCarga,
  type TareaCarga,
} from './carga';

const lv = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return d >= 1 && d <= 5;
};

const t = (id: number, ini: string, fin: string, extra: Partial<TareaCarga> = {}): TareaCarga => ({
  id,
  codigo: `1.${id}`,
  proyectoId: 1,
  inicioPlan: ini,
  finPlan: fin,
  porcentajeAvance: 0,
  esHabil: lv,
  ...extra,
});

describe('carga y sobreasignacion', () => {
  it('2 tareas en paralelo al 60 % generan alerta', () => {
    const c = detectarSobreasignaciones(
      [
        { profesionalId: 9, tareaId: 1, dedicacion: 60 },
        { profesionalId: 9, tareaId: 2, dedicacion: 60 },
      ],
      [t(1, '2026-11-02', '2026-11-06'), t(2, '2026-11-04', '2026-11-10')],
    );
    expect(c).toEqual([
      {
        profesionalId: 9,
        desde: '2026-11-04',
        hasta: '2026-11-06',
        dedicacionMaxima: 120,
        tareaIds: [1, 2],
        proyectoIds: [1],
      },
    ]);
    expect(claveSobreasignacion(c[0])).toBe('SOBREASIGNACION:9:2026-11-04:2026-11-06');
  });

  it('2 tareas secuenciales al 100 % no generan alerta', () => {
    const c = detectarSobreasignaciones(
      [
        { profesionalId: 9, tareaId: 1, dedicacion: 100 },
        { profesionalId: 9, tareaId: 2, dedicacion: 100 },
      ],
      [t(1, '2026-11-02', '2026-11-06'), t(2, '2026-11-09', '2026-11-13')],
    );
    expect(c).toEqual([]);
  });

  it('justo 100 % no es sobreasignacion; 100.01 si', () => {
    const ts = [t(1, '2026-11-02', '2026-11-02'), t(2, '2026-11-02', '2026-11-02')];
    const con = (d: number) =>
      detectarSobreasignaciones(
        [
          { profesionalId: 1, tareaId: 1, dedicacion: 50 },
          { profesionalId: 1, tareaId: 2, dedicacion: d },
        ],
        ts,
      ).length;
    expect(con(50)).toBe(0);
    expect(con(50.01)).toBe(1);
  });

  it('solape solo en fin de semana o tarea terminada no cuenta', () => {
    const asig = [
      { profesionalId: 1, tareaId: 1, dedicacion: 80 },
      { profesionalId: 1, tareaId: 2, dedicacion: 80 },
    ];
    expect(
      detectarSobreasignaciones(asig, [
        t(1, '2026-11-02', '2026-11-07'),
        t(2, '2026-11-07', '2026-11-08'),
      ]),
    ).toHaveLength(0);
    expect(
      detectarSobreasignaciones(asig, [
        t(1, '2026-11-02', '2026-11-06'),
        t(2, '2026-11-02', '2026-11-06', { porcentajeAvance: 100 }),
      ]),
    ).toHaveLength(0);
  });

  it('entre proyectos con calendarios distintos: rango partido por dia libre', () => {
    const sinMiercoles = (iso: string) => lv(iso) && iso !== '2026-11-04';
    const c = detectarSobreasignaciones(
      [
        { profesionalId: 3, tareaId: 1, dedicacion: 70 },
        { profesionalId: 3, tareaId: 2, dedicacion: 70 },
      ],
      [
        t(1, '2026-11-02', '2026-11-06'),
        t(2, '2026-11-02', '2026-11-06', { proyectoId: 2, esHabil: sinMiercoles }),
      ],
    );
    expect(c.map((x) => [x.desde, x.hasta, x.proyectoIds])).toEqual([
      ['2026-11-02', '2026-11-03', [1, 2]],
      ['2026-11-05', '2026-11-06', [1, 2]],
    ]);
  });

  it('carga semanal: % de ocupacion', () => {
    const carga = calcularCargaDiaria(
      [
        { profesionalId: 9, tareaId: 1, dedicacion: 60 },
        { profesionalId: 9, tareaId: 2, dedicacion: 60 },
      ],
      [t(1, '2026-11-02', '2026-11-06'), t(2, '2026-11-04', '2026-11-10')],
    );
    expect(cargaSemanal(carga, 9, '2026-11-02', '2026-11-15', lv)).toEqual([
      { semana: '2026-11-02', porcentaje: 96, sobreasignada: true },
      { semana: '2026-11-09', porcentaje: 24, sobreasignada: false },
    ]);
  });

  it('picoCarga: un dia al 120 % en semana con promedio menor a 100 % da sobreasignado true', () => {
    const carga = calcularCargaDiaria(
      [
        { profesionalId: 4, tareaId: 1, dedicacion: 60 },
        { profesionalId: 4, tareaId: 2, dedicacion: 60 },
      ],
      [t(1, '2026-11-12', '2026-11-12'), t(2, '2026-11-12', '2026-11-12')],
    );
    const resultado = picoCarga(carga, 4, '2026-11-09', '2026-11-15');
    expect(resultado).toEqual({
      ocupacionMaxima: 120,
      diaPico: '2026-11-12',
      sobreasignado: true,
    });
  });

  it('rendimiento: 60 tareas x 5 profesionales x 1 ano', () => {
    const ts = Array.from({ length: 60 }, (_, i) => t(i + 1, '2026-01-01', '2026-12-31'));
    const asig = ts.flatMap((x) =>
      [1, 2, 3, 4, 5].map((p) => ({ profesionalId: p, tareaId: x.id, dedicacion: 10 })),
    );
    const ini = performance.now();
    detectarSobreasignaciones(asig, ts);
    const ms = performance.now() - ini;
    expect(ms).toBeLessThan(100);
  });
});
