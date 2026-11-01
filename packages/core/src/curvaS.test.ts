import { describe, expect, it } from 'vitest';
import { calcularCurvaS, type HojaCurvaS, type PlanCurvaS } from './curvaS';
import { calcularValorGanado } from './valorGanado';

const esHabil = (iso: string) => {
  const dia = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return dia !== 0 && dia !== 6;
};

const plan: PlanCurvaS[] = [
  { tareaId: 11, codigo: '1.1', inicio: '2026-11-02', fin: '2026-11-06', costo: 500 },
  { tareaId: 12, codigo: '1.2', inicio: '2026-11-09', fin: '2026-11-20', costo: 1000 },
  { tareaId: 21, codigo: '2.1', inicio: '2026-11-23', fin: '2026-12-04', costo: 1500 },
];

const hojas: HojaCurvaS[] = [
  {
    tareaId: 11,
    codigo: '1.1',
    inicioPlan: '2026-11-02',
    finPlan: '2026-11-06',
    inicioReal: '2026-11-02',
    finReal: '2026-11-04',
    costoPlan: 500,
    avance: 100,
    costoReal: 450,
  },
  {
    tareaId: 12,
    codigo: '1.2',
    inicioPlan: '2026-11-09',
    finPlan: '2026-11-20',
    inicioReal: '2026-11-05',
    finReal: null,
    costoPlan: 1000,
    avance: 40,
    costoReal: 520,
  },
  {
    tareaId: 21,
    codigo: '2.1',
    inicioPlan: '2026-11-23',
    finPlan: '2026-12-04',
    inicioReal: null,
    finReal: null,
    costoPlan: 1500,
    avance: 0,
    costoReal: 0,
  },
];

const CORTE = '2026-11-16';

describe('curvaS', () => {
  it('la curva S tiene varios puntos y PV termina en BAC', () => {
    const s = calcularCurvaS(hojas, plan, CORTE, esHabil);
    expect(s.length).toBeGreaterThanOrEqual(4);
    expect(s.at(-1)!.pv).toBe(3000);
    expect(s[0].pv).toBeGreaterThanOrEqual(0);
  });

  it('EV y AC en el corte coinciden con calcularValorGanado con linea base', () => {
    const s = calcularCurvaS(hojas, plan, CORTE, esHabil);
    const p = s.find((x) => x.fecha === CORTE)!;
    const vg = calcularValorGanado(
      hojas.map((h) => ({
        tareaId: h.tareaId,
        codigo: `1.${h.tareaId}`,
        inicio: h.inicioPlan,
        fin: h.finPlan,
        costo: plan.find((pl) => pl.tareaId === h.tareaId)?.costo ?? 0,
        avance: h.avance,
        costoReal: h.costoReal,
      })),
      plan.map((pl) => ({
        tareaId: pl.tareaId,
        codigo: `1.${pl.tareaId}`,
        inicio: pl.inicio,
        fin: pl.fin,
        costo: pl.costo,
      })),
      CORTE,
      esHabil,
    );
    expect({ ev: p.ev, ac: p.ac }).toEqual({ ev: vg.ev, ac: vg.ac });
    expect({ ev: p.ev, ac: p.ac }).toEqual({ ev: 900, ac: 970 });
  });

  it('EV y AC en el corte coinciden con calcularValorGanado sin linea base', () => {
    const hojasConCosto: HojaCurvaS[] = hojas.map((h) => ({
      ...h,
      costo: plan.find((pl) => pl.tareaId === h.tareaId)?.costo ?? 0,
      inicio: h.inicioPlan,
      fin: h.finPlan,
    }));
    const s = calcularCurvaS(hojasConCosto, null, CORTE, esHabil);
    const p = s.find((x) => x.fecha === CORTE)!;
    const vg = calcularValorGanado(
      hojasConCosto.map((h) => ({
        tareaId: h.tareaId,
        codigo: `1.${h.tareaId}`,
        inicio: h.inicioPlan,
        fin: h.finPlan,
        costo: h.costo ?? 0,
        avance: h.avance,
        costoReal: h.costoReal,
      })),
      null,
      CORTE,
      esHabil,
    );
    expect({ ev: p.ev, ac: p.ac }).toEqual({ ev: vg.ev, ac: vg.ac });
    expect({ ev: p.ev, ac: p.ac }).toEqual({ ev: 900, ac: 970 });
  });

  it('las tres series son monótonas no decrecientes', () => {
    const s = calcularCurvaS(hojas, plan, CORTE, esHabil);
    for (let i = 1; i < s.length; i += 1) {
      expect(s[i].pv).toBeGreaterThanOrEqual(s[i - 1].pv);
      if (s[i].ev !== null) {
        expect(s[i].ev!).toBeGreaterThanOrEqual(s[i - 1].ev!);
        expect(s[i].ac!).toBeGreaterThanOrEqual(s[i - 1].ac!);
      }
    }
  });

  it('después del corte EV y AC son null', () => {
    const s = calcularCurvaS(hojas, plan, CORTE, esHabil);
    expect(s.filter((x) => x.fecha > CORTE).every((x) => x.ev === null && x.ac === null)).toBe(
      true,
    );
    expect(s.filter((x) => x.fecha <= CORTE).every((x) => x.ev !== null)).toBe(true);
  });

  it('sin fechas la curva es vacía y no divide por cero', () => {
    expect(calcularCurvaS([], [], CORTE, esHabil)).toEqual([]);
    const sinFechas: PlanCurvaS[] = [
      { tareaId: 1, codigo: '1', inicio: null, fin: null, costo: 100 },
    ];
    expect(calcularCurvaS([], sinFechas, CORTE, esHabil)).toEqual([]);
  });

  it('corte anterior al inicio: PV, EV y AC en cero', () => {
    const s = calcularCurvaS(
      hojas.map((x) => ({ ...x, avance: 0, costoReal: 0, inicioReal: null, finReal: null })),
      plan,
      '2026-10-01',
      esHabil,
    );
    expect(s[0].fecha).toBe('2026-10-01');
    expect([s[0].pv, s[0].ev, s[0].ac]).toEqual([0, 0, 0]);
  });

  it('inicioReal posterior al corte no rompe la igualdad en el corte', () => {
    const raras = [{ ...hojas[1], inicioReal: '2026-12-01' }];
    const s = calcularCurvaS(raras, plan, CORTE, esHabil);
    const p = s.find((x) => x.fecha === CORTE)!;
    expect({ ev: p.ev, ac: p.ac }).toEqual({ ev: 400, ac: 520 });
  });

  it('proyecto largo se limita a unos 104 puntos', () => {
    const largo: PlanCurvaS[] = [
      { tareaId: 1, codigo: '1', inicio: '2026-01-05', fin: '2030-12-31', costo: 1 },
    ];
    expect(calcularCurvaS([], largo, '2026-06-01', esHabil).length).toBeLessThanOrEqual(110);
  });
});
