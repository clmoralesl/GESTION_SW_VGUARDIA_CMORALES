import { avancePonderado } from './avance';
import { estaAtrasada } from './atraso';
import {
  aDiaEpoca,
  aFechaIso,
  esHabil as esHabilCalendario,
  type CalendarioLaboral,
} from './calendario';
import type { CargaDiaria } from './carga';
import { calcularHorasPlan } from './costos';
import { evaluarHito } from './hitos';
import { redondear } from './numeros';
import {
  calcularValorGanado,
  fraccionPlanificada,
  hojasDeLineaBase,
  type FilaLineaBase,
  type HojaActual,
} from './valorGanado';

export interface VariableKpiDefinicion {
  codigo: string;
  nombre: string;
  descripcion: string;
  ambito: 'PROYECTO';
  unidad: 'CLP' | 'PORCENTAJE' | 'NUMERO' | 'DIAS' | 'INDICE';
}

export const VARIABLES_KPI: readonly VariableKpiDefinicion[] = [
  {
    codigo: 'PV',
    nombre: 'Valor planificado',
    descripcion: 'Valor planificado del trabajo presupuestado a la fecha de corte.',
    ambito: 'PROYECTO',
    unidad: 'CLP',
  },
  {
    codigo: 'EV',
    nombre: 'Valor ganado',
    descripcion: 'Valor ganado del trabajo realmente ejecutado a la fecha de corte.',
    ambito: 'PROYECTO',
    unidad: 'CLP',
  },
  {
    codigo: 'AC',
    nombre: 'Costo real',
    descripcion: 'Costo real acumulado en las tareas a la fecha de corte.',
    ambito: 'PROYECTO',
    unidad: 'CLP',
  },
  {
    codigo: 'BAC',
    nombre: 'Presupuesto total',
    descripcion: 'Presupuesto total planificado al término del proyecto.',
    ambito: 'PROYECTO',
    unidad: 'CLP',
  },
  {
    codigo: 'AVANCE_REAL',
    nombre: 'Porcentaje de avance real',
    descripcion: 'Porcentaje de avance consolidado del proyecto.',
    ambito: 'PROYECTO',
    unidad: 'PORCENTAJE',
  },
  {
    codigo: 'AVANCE_PLAN',
    nombre: 'Porcentaje de avance planificado',
    descripcion: 'Porcentaje de avance planificado según el calendario y la línea base.',
    ambito: 'PROYECTO',
    unidad: 'PORCENTAJE',
  },
  {
    codigo: 'TAREAS_TOTAL',
    nombre: 'Total de tareas',
    descripcion: 'Cantidad total de tareas hoja del proyecto.',
    ambito: 'PROYECTO',
    unidad: 'NUMERO',
  },
  {
    codigo: 'TAREAS_ATRASADAS',
    nombre: 'Tareas atrasadas',
    descripcion: 'Cantidad de tareas hoja atrasadas respecto a la fecha de corte.',
    ambito: 'PROYECTO',
    unidad: 'NUMERO',
  },
  {
    codigo: 'DUR_PLAN_BASE',
    nombre: 'Duración planificada de la base',
    descripcion: 'Días hábiles inclusive entre el inicio y el fin de la línea base.',
    ambito: 'PROYECTO',
    unidad: 'DIAS',
  },
  {
    codigo: 'DUR_ACTUAL',
    nombre: 'Duración planificada actual',
    descripcion: 'Días hábiles inclusive entre el inicio y el fin del cronograma actual.',
    ambito: 'PROYECTO',
    unidad: 'DIAS',
  },
  {
    codigo: 'HITOS_TOTAL',
    nombre: 'Total de hitos',
    descripcion: 'Cantidad total de hitos definidos en el proyecto.',
    ambito: 'PROYECTO',
    unidad: 'NUMERO',
  },
  {
    codigo: 'HITOS_CUMPLIDOS',
    nombre: 'Hitos cumplidos',
    descripcion: 'Cantidad de hitos con fecha real de cumplimiento.',
    ambito: 'PROYECTO',
    unidad: 'NUMERO',
  },
  {
    codigo: 'HITOS_A_TIEMPO',
    nombre: 'Hitos a tiempo',
    descripcion: 'Cantidad de hitos cumplidos en o antes de su fecha objetivo.',
    ambito: 'PROYECTO',
    unidad: 'NUMERO',
  },
  {
    codigo: 'HORAS_ASIGNADAS',
    nombre: 'Horas asignadas',
    descripcion: 'Suma de horas planificadas de profesionales en el proyecto.',
    ambito: 'PROYECTO',
    unidad: 'NUMERO',
  },
  {
    codigo: 'HORAS_SOBREASIGNADAS',
    nombre: 'Horas sobreasignadas',
    descripcion: 'Horas asignadas en días en que el profesional supera el 100 % de dedicación.',
    ambito: 'PROYECTO',
    unidad: 'NUMERO',
  },
] as const;

export const CODIGOS_VARIABLES_KPI: ReadonlySet<string> = new Set(
  VARIABLES_KPI.map((v) => v.codigo),
);

export interface HojaCalculoKpi {
  id: number;
  codigo: string;
  inicioPlan: string | null;
  finPlan: string | null;
  duracionDias: number;
  porcentajeAvance: number;
  costoPlan: number;
  costoReal: number;
}

export interface FilaLineaBaseKpi {
  tareaId: number | null;
  codigo: string;
  inicioPlan: string | null;
  finPlan: string | null;
  duracionDias: number;
  costoPlan: number;
}

export interface HitoCalculoKpi {
  id: number;
  fechaObjetivo: string;
  fechaCumplimiento: string | null;
  tarea: { finPlan: string | null; porcentajeAvance: number } | null;
}

export interface AsignacionProfesionalKpi {
  profesionalId: number;
  tareaId: number;
  dedicacion: number;
  horasPlan: number | null;
  duracionDias: number;
  horasDiarias: number;
}

export interface DatosCalculoVariablesKpi {
  corte: string;
  calendario: CalendarioLaboral;
  hojasActuales: readonly HojaCalculoKpi[];
  avanceRealProyecto: number;
  lineaBase: readonly FilaLineaBaseKpi[] | null;
  hitos: readonly HitoCalculoKpi[];
  asignacionesProyecto: readonly AsignacionProfesionalKpi[];
  cargaDiariaGlobal?: CargaDiaria;
}

export interface VariableKpiConValor extends VariableKpiDefinicion {
  valor: number | null;
}

export interface ResultadoVariablesKpi {
  corte: string;
  origen: 'LINEA_BASE' | 'PLAN_ACTUAL';
  valores: Record<string, number | null>;
  variables: VariableKpiConValor[];
}

function calcularHabilesInclusive(
  desdeIso: string,
  hastaIso: string,
  esHabilFn: (f: string) => boolean,
): number {
  const dInicio = aDiaEpoca(desdeIso);
  const dFin = aDiaEpoca(hastaIso);
  let n = 0;
  for (let d = dInicio; d <= dFin; d += 1) {
    if (esHabilFn(aFechaIso(d))) n += 1;
  }
  return n;
}

function calcularDuracionRango(
  fechas: readonly { inicio: string | null; fin: string | null }[],
  esHabilFn: (f: string) => boolean,
): number {
  const validas = fechas.filter(
    (f): f is { inicio: string; fin: string } => f.inicio !== null && f.fin !== null,
  );
  const primera = validas[0];
  if (!primera) return 0;
  let minInicio = primera.inicio;
  let maxFin = primera.fin;
  for (const f of validas) {
    if (f.inicio < minInicio) minInicio = f.inicio;
    if (f.fin > maxFin) maxFin = f.fin;
  }
  return calcularHabilesInclusive(minInicio, maxFin, esHabilFn);
}

export function calcularVariablesKpi(datos: DatosCalculoVariablesKpi): ResultadoVariablesKpi {
  const esHabilFn = (fechaIso: string) => esHabilCalendario(fechaIso, datos.calendario);

  const hojasParaVg: HojaActual[] = datos.hojasActuales.map((h) => ({
    tareaId: h.id,
    codigo: h.codigo,
    inicio: h.inicioPlan,
    fin: h.finPlan,
    costo: h.costoPlan,
    avance: h.porcentajeAvance,
    costoReal: h.costoReal,
  }));

  const baseParaVg: FilaLineaBase[] | null = datos.lineaBase
    ? datos.lineaBase.map((f) => ({
        tareaId: f.tareaId,
        codigo: f.codigo,
        inicio: f.inicioPlan,
        fin: f.finPlan,
        costo: f.costoPlan,
      }))
    : null;

  const vg = calcularValorGanado(hojasParaVg, baseParaVg, datos.corte, esHabilFn);

  let avancePlan = 0;
  if (datos.lineaBase !== null && datos.lineaBase.length > 0) {
    const duracionesMap = new Map(datos.lineaBase.map((f) => [f.codigo, f.duracionDias]));
    const hojasBase = hojasDeLineaBase(baseParaVg!);
    const elementos = hojasBase.map((h) => ({
      avance: fraccionPlanificada(h.inicio, h.fin, datos.corte, esHabilFn) * 100,
      duracion: duracionesMap.get(h.codigo) ?? 1,
    }));
    avancePlan = avancePonderado(elementos);
  } else {
    const elementos = datos.hojasActuales.map((h) => ({
      avance: fraccionPlanificada(h.inicioPlan, h.finPlan, datos.corte, esHabilFn) * 100,
      duracion: h.duracionDias,
    }));
    avancePlan = avancePonderado(elementos);
  }

  const durPlanBase =
    datos.lineaBase !== null && datos.lineaBase.length > 0
      ? calcularDuracionRango(
          datos.lineaBase.map((f) => ({ inicio: f.inicioPlan, fin: f.finPlan })),
          esHabilFn,
        )
      : calcularDuracionRango(
          datos.hojasActuales.map((h) => ({ inicio: h.inicioPlan, fin: h.finPlan })),
          esHabilFn,
        );

  const durActual = calcularDuracionRango(
    datos.hojasActuales.map((h) => ({ inicio: h.inicioPlan, fin: h.finPlan })),
    esHabilFn,
  );

  const tareasTotal = datos.hojasActuales.length;
  const tareasAtrasadas = datos.hojasActuales.filter((h) =>
    estaAtrasada({ finPlan: h.finPlan, porcentajeAvance: h.porcentajeAvance }, datos.corte),
  ).length;

  const hitosTotal = datos.hitos.length;
  const hitosCumplidos = datos.hitos.filter((h) => h.fechaCumplimiento !== null).length;
  const hitosATiempo = datos.hitos.filter((h) => {
    const ev = evaluarHito(
      {
        fechaObjetivo: h.fechaObjetivo,
        fechaCumplimiento: h.fechaCumplimiento,
        tarea: h.tarea,
      },
      datos.calendario,
      datos.corte,
    );
    return ev.aTiempo === true;
  }).length;

  const horasAsignadas = redondear(
    datos.asignacionesProyecto.reduce(
      (suma, a) =>
        suma + (a.horasPlan ?? calcularHorasPlan(a.duracionDias, a.horasDiarias, a.dedicacion)),
      0,
    ),
    2,
  );

  let horasSobreasignadas = 0;
  if (datos.cargaDiariaGlobal) {
    const mapaAsignaciones = new Map<string, { dedicacion: number; horasDiarias: number }>();
    for (const a of datos.asignacionesProyecto) {
      mapaAsignaciones.set(`${a.profesionalId}:${a.tareaId}`, {
        dedicacion: a.dedicacion,
        horasDiarias: a.horasDiarias,
      });
    }
    let suma = 0;
    for (const [profesionalId, dias] of datos.cargaDiariaGlobal) {
      for (const [, celda] of dias) {
        if (celda.centesimas > 10_000) {
          for (const tareaId of celda.tareaIds) {
            const asig = mapaAsignaciones.get(`${profesionalId}:${tareaId}`);
            if (asig) {
              suma += (asig.dedicacion * asig.horasDiarias) / 100;
            }
          }
        }
      }
    }
    horasSobreasignadas = Math.min(horasAsignadas, Math.max(0, redondear(suma, 2)));
  }

  const valores: Record<string, number | null> = {
    PV: vg.pv,
    EV: vg.ev,
    AC: vg.ac,
    BAC: vg.bac,
    AVANCE_REAL: redondear(datos.avanceRealProyecto, 2),
    AVANCE_PLAN: avancePlan,
    TAREAS_TOTAL: tareasTotal,
    TAREAS_ATRASADAS: tareasAtrasadas,
    DUR_PLAN_BASE: durPlanBase,
    DUR_ACTUAL: durActual,
    HITOS_TOTAL: hitosTotal,
    HITOS_CUMPLIDOS: hitosCumplidos,
    HITOS_A_TIEMPO: hitosATiempo,
    HORAS_ASIGNADAS: horasAsignadas,
    HORAS_SOBREASIGNADAS: horasSobreasignadas,
  };

  const variables: VariableKpiConValor[] = VARIABLES_KPI.map((v) => ({
    ...v,
    valor: valores[v.codigo] ?? null,
  }));

  return {
    corte: datos.corte,
    origen: vg.origen,
    valores,
    variables,
  };
}
