import { describe, expect, it } from 'vitest';
import {
  calcularValorGanado,
  fraccionPlanificada,
  type FilaLineaBase,
  type HojaActual,
} from './valorGanado';
import { analizarFormula, evaluarFormula } from './formulas';
import { calcularSemaforo, validarUmbrales } from './semaforo';
import {
  calcularVariablesKpi,
  type AsignacionProfesionalKpi,
  type DatosCalculoVariablesKpi,
  type FilaLineaBaseKpi,
  type HitoCalculoKpi,
  type HojaCalculoKpi,
} from './variablesKpi';
import { crearCalendarioLaboral } from './calendario';
import type { CargaDiaria } from './carga';
import { esquemaActualizarKpi } from './kpi';

describe('Valor ganado (VG1 a VG11)', () => {
  const feriados = new Set<string>();
  const esHabil = (iso: string) => {
    const d = new Date(`${iso}T00:00:00Z`).getUTCDay();
    return d >= 1 && d <= 5 && !feriados.has(iso);
  };

  const hojas: HojaActual[] = [
    {
      tareaId: 1,
      codigo: '1.1',
      inicio: '2026-11-02',
      fin: '2026-11-06',
      costo: 1000,
      avance: 50,
      costoReal: 700,
    },
    {
      tareaId: 2,
      codigo: '1.2',
      inicio: '2026-11-09',
      fin: '2026-11-13',
      costo: 500,
      avance: 0,
      costoReal: 0,
    },
  ];

  const base: FilaLineaBase[] = [
    { tareaId: 10, codigo: '1', inicio: '2026-11-02', fin: '2026-11-13', costo: 1800 },
    { tareaId: 1, codigo: '1.1', inicio: '2026-11-02', fin: '2026-11-06', costo: 1000 },
    { tareaId: 2, codigo: '1.2', inicio: '2026-11-09', fin: '2026-11-13', costo: 500 },
    { tareaId: null, codigo: '1.3', inicio: '2026-11-02', fin: '2026-11-03', costo: 300 },
  ];

  const conNueva: HojaActual[] = [
    ...hojas,
    {
      tareaId: 3,
      codigo: '1.4',
      inicio: '2026-11-02',
      fin: '2026-11-03',
      costo: 999,
      avance: 100,
      costoReal: 50,
    },
  ];

  it('VG1 PV lineal por dia habil a mitad de tarea', () => {
    const r = calcularValorGanado(hojas, null, '2026-11-04', esHabil);
    expect(r).toEqual({ pv: 600, ev: 500, ac: 700, bac: 1500, origen: 'PLAN_ACTUAL' });
  });

  it('VG2 corte antes del inicio: PV 0', () => {
    expect(calcularValorGanado(hojas, null, '2026-10-31', esHabil).pv).toBe(0);
  });

  it('VG3 corte en fin de semana cuenta como dia completo previo', () => {
    expect(calcularValorGanado(hojas, null, '2026-11-07', esHabil).pv).toBe(1000);
  });

  it('VG4 corte despues del fin: PV = BAC', () => {
    expect(calcularValorGanado(hojas, null, '2026-12-01', esHabil).pv).toBe(1500);
  });

  it('VG5 feriado excluido del denominador y del numerador', () => {
    feriados.add('2026-11-03');
    expect(fraccionPlanificada('2026-11-02', '2026-11-06', '2026-11-04', esHabil)).toBe(0.5);
    feriados.clear();
  });

  it('VG6 tarea sin dias habiles (solo fin de semana) planificada completa al iniciar', () => {
    expect(fraccionPlanificada('2026-11-07', '2026-11-08', '2026-11-07', esHabil)).toBe(1);
    expect(fraccionPlanificada('2026-11-07', '2026-11-08', '2026-11-06', esHabil)).toBe(0);
  });

  it('VG7 hoja sin fechas: PV 0', () => {
    expect(fraccionPlanificada(null, null, '2026-11-04', esHabil)).toBe(0);
  });

  it('VG8 linea base: solo hojas por prefijo de codigo, sin doble conteo del padre', () => {
    const r = calcularValorGanado(conNueva, base, '2026-11-04', esHabil);
    expect(r.bac).toBe(1800);
    expect(r.pv).toBe(900);
    expect(r.origen).toBe('LINEA_BASE');
  });

  it('VG9 tarea fuera de la linea base: EV 0, AC si cuenta', () => {
    const r = calcularValorGanado(conNueva, base, '2026-11-04', esHabil);
    expect(r.ev).toBe(500);
    expect(r.ac).toBe(750);
  });

  it('VG10 alargar una tarea no cambia PV ni EV contra la linea base', () => {
    const larga = hojas.map((h) =>
      h.tareaId === 1 ? { ...h, fin: '2026-11-13', costo: 2000 } : h,
    );
    const a = calcularValorGanado(hojas, base.slice(0, 3), '2026-11-04', esHabil);
    const b = calcularValorGanado(larga, base.slice(0, 3), '2026-11-04', esHabil);
    expect(a).toEqual(b);
  });

  it('VG11 alargar sin linea base sube el SPI (PV baja): por eso SPI exige linea base', () => {
    const larga = hojas.map((h) => (h.tareaId === 1 ? { ...h, fin: '2026-11-13' } : h));
    const r = calcularValorGanado(larga, null, '2026-11-04', esHabil);
    expect(r.pv).toBe(300);
  });
});

describe('Fórmulas y seguridad (F1 a F11)', () => {
  const VARS = new Set(['PV', 'EV', 'AC', 'BAC', 'HITOS_A_TIEMPO', 'HITOS_CUMPLIDOS']);
  const valores = {
    PV: 600,
    EV: 500,
    AC: 700,
    BAC: 1500,
    HITOS_A_TIEMPO: 0,
    HITOS_CUMPLIDOS: 0,
  };

  const valorDe = (f: string, v: Record<string, number | null> = valores) => {
    const r = evaluarFormula(f, VARS, v);
    expect(r.valida).toBe(true);
    return (r as { valor: number | null }).valor;
  };

  const codigoDe = (f: string) => {
    const r = analizarFormula(f, VARS);
    expect(r.valida).toBe(false);
    return (r as { errores: { codigo: string }[] }).errores.map((e) => e.codigo);
  };

  it('F1 SPI y CPI', () => {
    expect(valorDe('round(EV / PV, 4)')).toBe(0.8333);
    expect(valorDe('round(EV / AC, 4)')).toBe(0.7143);
  });

  it('F2 CV% con precedencia y parentesis', () => {
    expect(valorDe('(EV - AC) / EV * 100')).toBe(-40);
  });

  it('F3 division por cero devuelve null', () => {
    expect(valorDe('HITOS_A_TIEMPO / HITOS_CUMPLIDOS * 100')).toBeNull();
    expect(valorDe('EV / (PV - PV)')).toBeNull();
    expect(valorDe('0 / 0')).toBeNull();
  });

  it('F4 variable null se propaga', () => {
    expect(valorDe('EV / PV', { ...valores, PV: null })).toBeNull();
  });

  it('F5 condicional perezoso evita el null', () => {
    expect(valorDe('HITOS_CUMPLIDOS > 0 ? HITOS_A_TIEMPO / HITOS_CUMPLIDOS : 1')).toBe(1);
  });

  it('F6 min, max, abs, round permitidos', () => {
    expect(valorDe('max(0, min(abs(-3), 2)) + round(1.256, 2)')).toBe(3.26);
  });

  it('F7 variable inexistente: VARIABLE_DESCONOCIDA (422)', () => {
    expect(codigoDe('EV / XX')).toEqual(['VARIABLE_DESCONOCIDA']);
    expect(codigoDe('pi * EV')).toEqual(['VARIABLE_DESCONOCIDA']);
    expect(codigoDe('5 cm')).toEqual(['ELEMENTO_NO_PERMITIDO']);
  });

  it('F8 funcion no permitida: FUNCION_NO_PERMITIDA (422)', () => {
    for (const f of [
      'cos(EV)',
      'sqrt(EV)',
      'import({})',
      'evaluate("1")',
      'createUnit("x")',
      'parse("1")',
      'constructor(1)',
      'toString(1)',
      'round(EV, 1, 2)',
    ]) {
      expect(codigoDe(f)).toContain('FUNCION_NO_PERMITIDA');
    }
  });

  it('F9 pruebas negativas de seguridad: ELEMENTO_NO_PERMITIDO', () => {
    for (const f of [
      'EV.constructor',
      'EV["constructor"]',
      'f(x) = x',
      'a = 1',
      '[1, 2]',
      '{a: 1}',
      '"texto"',
      '1:3',
      'EV; PV',
      'EV ^ 2',
      'EV mod 2',
      '5!',
      "EV'",
      '2 EV',
      'EV and PV',
      'true',
      'EV to cm',
      '(EV)(1)',
    ]) {
      const r = analizarFormula(f, VARS);
      expect(r.valida).toBe(false);
    }
  });

  it('F10 sintaxis, vacia, largo y profundidad', () => {
    expect(codigoDe('EV / ')).toEqual(['SINTAXIS_INVALIDA']);
    expect(codigoDe('   ')).toEqual(['FORMULA_VACIA']);
    expect(codigoDe('EV+'.repeat(200) + 'EV')).toEqual(['FORMULA_DEMASIADO_LARGA']);
    expect(codigoDe('('.repeat(30) + 'EV' + ')'.repeat(30))).toEqual([
      'FORMULA_DEMASIADO_COMPLEJA',
    ]);
  });

  it('F11 desborde a infinito devuelve null', () => {
    expect(valorDe('1e308 * 10')).toBeNull();
  });
});

describe('Semáforo y umbrales (S1 a S5)', () => {
  it('S1 MAYOR_MEJOR: verde desde 0,95, amarillo desde 0,85', () => {
    const u = { verde: 0.95, amarillo: 0.85 };
    expect(calcularSemaforo(0.95, 'MAYOR_MEJOR', u)).toBe('VERDE');
    expect(calcularSemaforo(0.9499999, 'MAYOR_MEJOR', u)).toBe('VERDE');
    expect(calcularSemaforo(0.9499, 'MAYOR_MEJOR', u)).toBe('AMARILLO');
    expect(calcularSemaforo(0.85, 'MAYOR_MEJOR', u)).toBe('AMARILLO');
    expect(calcularSemaforo(0.8499, 'MAYOR_MEJOR', u)).toBe('ROJO');
  });

  it('S2 MENOR_MEJOR: verde hasta 5, amarillo hasta 15', () => {
    const u = { verde: 5, amarillo: 15 };
    expect(calcularSemaforo(5, 'MENOR_MEJOR', u)).toBe('VERDE');
    expect(calcularSemaforo(5.0001, 'MENOR_MEJOR', u)).toBe('AMARILLO');
    expect(calcularSemaforo(15, 'MENOR_MEJOR', u)).toBe('AMARILLO');
    expect(calcularSemaforo(15.01, 'MENOR_MEJOR', u)).toBe('ROJO');
    expect(calcularSemaforo(-3, 'MENOR_MEJOR', u)).toBe('VERDE');
  });

  it('S3 null o sin umbrales: sin semaforo', () => {
    expect(calcularSemaforo(null, 'MAYOR_MEJOR', { verde: 1, amarillo: 0 })).toBeNull();
    expect(calcularSemaforo(3, 'MAYOR_MEJOR', { verde: null, amarillo: null })).toBeNull();
  });

  it('S4 solo verde: verde o rojo', () => {
    expect(calcularSemaforo(0, 'MENOR_MEJOR', { verde: 0, amarillo: null })).toBe('VERDE');
    expect(calcularSemaforo(0.01, 'MENOR_MEJOR', { verde: 0, amarillo: null })).toBe('ROJO');
  });

  it('S5 validacion del orden de umbrales', () => {
    expect(validarUmbrales('MAYOR_MEJOR', { verde: 0.95, amarillo: 0.85 })).toBeNull();
    expect(validarUmbrales('MAYOR_MEJOR', { verde: 0.85, amarillo: 0.95 })).not.toBeNull();
    expect(validarUmbrales('MENOR_MEJOR', { verde: 5, amarillo: 15 })).toBeNull();
    expect(validarUmbrales('MENOR_MEJOR', { verde: 15, amarillo: 5 })).not.toBeNull();
    expect(validarUmbrales('MAYOR_MEJOR', { verde: null, amarillo: 1 })).not.toBeNull();
    expect(validarUmbrales('MAYOR_MEJOR', { verde: 1, amarillo: 1 })).toBeNull();
  });
});

describe('Cálculo integrado de variables KPI', () => {
  const cal = crearCalendarioLaboral({ diasLaborables: [1, 2, 3, 4, 5] });

  const hojasActuales: HojaCalculoKpi[] = [
    {
      id: 1,
      codigo: '1.1',
      inicioPlan: '2026-11-02',
      finPlan: '2026-11-06',
      duracionDias: 5,
      porcentajeAvance: 100,
      costoPlan: 1000,
      costoReal: 1000,
    },
    {
      id: 2,
      codigo: '1.2',
      inicioPlan: '2026-11-09',
      finPlan: '2026-11-13',
      duracionDias: 5,
      porcentajeAvance: 20,
      costoPlan: 2000,
      costoReal: 500,
    },
  ];

  const lineaBase: FilaLineaBaseKpi[] = [
    {
      tareaId: 1,
      codigo: '1.1',
      inicioPlan: '2026-11-02',
      finPlan: '2026-11-06',
      duracionDias: 5,
      costoPlan: 1000,
    },
    {
      tareaId: 2,
      codigo: '1.2',
      inicioPlan: '2026-11-09',
      finPlan: '2026-11-13',
      duracionDias: 5,
      costoPlan: 2000,
    },
  ];

  const hitos: HitoCalculoKpi[] = [
    {
      id: 1,
      fechaObjetivo: '2026-11-06',
      fechaCumplimiento: '2026-11-05',
      tarea: null,
    },
    {
      id: 2,
      fechaObjetivo: '2026-11-13',
      fechaCumplimiento: null,
      tarea: null,
    },
  ];

  const asignaciones: AsignacionProfesionalKpi[] = [
    {
      profesionalId: 10,
      tareaId: 1,
      dedicacion: 100,
      horasPlan: 40,
      duracionDias: 5,
      horasDiarias: 8,
    },
  ];

  const cargaGlobal: CargaDiaria = new Map([
    [
      10,
      new Map([
        [
          20760,
          {
            centesimas: 12000,
            tareaIds: new Set([1]),
          },
        ],
      ]),
    ],
  ]);

  it('calcula las 15 variables de proyecto con valores numéricos y unidades correctas', () => {
    const datos: DatosCalculoVariablesKpi = {
      corte: '2026-11-06',
      calendario: cal,
      hojasActuales,
      avanceRealProyecto: 60,
      lineaBase,
      hitos,
      asignacionesProyecto: asignaciones,
      cargaDiariaGlobal: cargaGlobal,
    };

    const resultado = calcularVariablesKpi(datos);
    expect(resultado.corte).toBe('2026-11-06');
    expect(resultado.origen).toBe('LINEA_BASE');
    expect(resultado.valores.PV).toBe(1000);
    expect(resultado.valores.EV).toBe(1400);
    expect(resultado.valores.AC).toBe(1500);
    expect(resultado.valores.BAC).toBe(3000);
    expect(resultado.valores.AVANCE_REAL).toBe(60);
    expect(resultado.valores.TAREAS_TOTAL).toBe(2);
    expect(resultado.valores.HITOS_TOTAL).toBe(2);
    expect(resultado.valores.HITOS_CUMPLIDOS).toBe(1);
    expect(resultado.valores.HITOS_A_TIEMPO).toBe(1);
    expect(resultado.valores.HORAS_ASIGNADAS).toBe(40);
    expect(resultado.valores.HORAS_SOBREASIGNADAS).toBe(8);
    expect(resultado.variables).toHaveLength(15);
  });

  it('A1: esquemaActualizarKpi no inventa umbrales y rechaza el cuerpo vacio', () => {
    const parcial = esquemaActualizarKpi.safeParse({ nombre: 'Nuevo' });
    expect(parcial.success).toBe(true);
    expect(parcial.success && 'umbrales' in parcial.data).toBe(false);
    expect(esquemaActualizarKpi.safeParse({}).success).toBe(false);
    const borrar = esquemaActualizarKpi.safeParse({ umbrales: null });
    expect(borrar.success && borrar.data.umbrales).toBeNull();
  });
});
