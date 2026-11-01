import { compararCodigos } from './cronograma';
import { diasCorridosEntre } from './fechas';
import { redondearMonto } from './montos';

export interface TareaLineaBase {
  tareaId: number | null;
  codigo: string;
  nombre: string;
  duracionDias: number;
  inicioPlan: string | null;
  finPlan: string | null;
}

export interface LineaBaseGantt {
  id: number;
  version: number;
  descripcion: string | null;
  creadoEn: string;
  fechaFinProyecto: string | null;
  tareas: TareaLineaBase[];
}

export interface LineaBaseVigente {
  proyectoId: number;
  lineaBase: LineaBaseGantt | null;
}

export interface FilaLineaBaseComparador {
  tareaId: number | null;
  codigo: string;
  nombre: string;
  nivel?: string;
  duracionDias: number;
  inicioPlan: string | null;
  finPlan: string | null;
  costoPlan: number;
}

export type EstadoComparacionFila = 'IGUAL' | 'MODIFICADA' | 'AGREGADA' | 'ELIMINADA';

export interface FilaComparacion {
  tareaId: number | null;
  codigo: string;
  nombre: string;
  nivel?: string;
  estado: EstadoComparacionFila;
  duracionDiasA: number | null;
  duracionDiasB: number | null;
  inicioPlanA: string | null;
  inicioPlanB: string | null;
  finPlanA: string | null;
  finPlanB: string | null;
  costoPlanA: number | null;
  costoPlanB: number | null;
  diferenciaDuracionDias: number | null;
  diferenciaCostoPlan: number | null;
}

export interface ResumenVersionComparacion {
  version: number;
  descripcion: string | null;
  fechaFinProyecto: string | null;
  costoPlanTotal: number;
  creadoEn: string;
}

export interface TotalesComparacion {
  costoPlanTotalA: number;
  costoPlanTotalB: number;
  diferenciaCostoTotal: number;
  fechaFinProyectoA: string | null;
  fechaFinProyectoB: string | null;
  diferenciaDiasFinProyecto: number | null;
  totalTareas: number;
  tareasIguales: number;
  tareasModificadas: number;
  tareasAgregadas: number;
  tareasEliminadas: number;
}

export interface ComparacionLineasBase {
  versionA: ResumenVersionComparacion;
  versionB: ResumenVersionComparacion;
  totales: TotalesComparacion;
  filas: FilaComparacion[];
}

export interface MetricasPlan {
  fechaFinProyecto: string | null;
  costoPlanTotal: number;
  presupuesto: number;
  spi: number | null;
  cpi: number | null;
}

export interface ResultadoSimulacion {
  solicitudId: number;
  antes: MetricasPlan;
  despues: MetricasPlan;
  tareasAfectadas: FilaComparacion[];
}

export interface LineaBaseResumen {
  id: number;
  version: number;
  descripcion: string | null;
  solicitudCambioId: number | null;
  solicitudCodigo?: string | null;
  fechaFinProyecto: string | null;
  costoPlanTotal: number;
  creadoEn: string;
}

export interface RespuestaListaLineasBase {
  versiones: LineaBaseResumen[];
  versionGantt: number | null;
}

export function emparejarFilas(
  filasA: readonly FilaLineaBaseComparador[],
  filasB: readonly FilaLineaBaseComparador[],
): FilaComparacion[] {
  const usadasB = new Set<number>();
  const resultado: FilaComparacion[] = [];

  for (const fa of filasA) {
    let indiceB = -1;

    if (fa.tareaId !== null) {
      indiceB = filasB.findIndex((fb, idx) => !usadasB.has(idx) && fb.tareaId === fa.tareaId);
    } else {
      indiceB = filasB.findIndex(
        (fb, idx) => !usadasB.has(idx) && fb.tareaId === null && fb.codigo === fa.codigo,
      );
    }

    if (indiceB !== -1) {
      usadasB.add(indiceB);
      const fb = filasB[indiceB];
      if (!fb) continue;
      const esIgual =
        fa.duracionDias === fb.duracionDias &&
        fa.inicioPlan === fb.inicioPlan &&
        fa.finPlan === fb.finPlan &&
        redondearMonto(fa.costoPlan) === redondearMonto(fb.costoPlan) &&
        fa.nombre === fb.nombre;

      resultado.push({
        tareaId: fb.tareaId,
        codigo: fb.codigo,
        nombre: fb.nombre,
        nivel: fb.nivel ?? fa.nivel,
        estado: esIgual ? 'IGUAL' : 'MODIFICADA',
        duracionDiasA: fa.duracionDias,
        duracionDiasB: fb.duracionDias,
        inicioPlanA: fa.inicioPlan,
        inicioPlanB: fb.inicioPlan,
        finPlanA: fa.finPlan,
        finPlanB: fb.finPlan,
        costoPlanA: redondearMonto(fa.costoPlan),
        costoPlanB: redondearMonto(fb.costoPlan),
        diferenciaDuracionDias: fb.duracionDias - fa.duracionDias,
        diferenciaCostoPlan: redondearMonto(fb.costoPlan - fa.costoPlan),
      });
    } else {
      resultado.push({
        tareaId: fa.tareaId,
        codigo: fa.codigo,
        nombre: fa.nombre,
        nivel: fa.nivel,
        estado: 'ELIMINADA',
        duracionDiasA: fa.duracionDias,
        duracionDiasB: null,
        inicioPlanA: fa.inicioPlan,
        inicioPlanB: null,
        finPlanA: fa.finPlan,
        finPlanB: null,
        costoPlanA: redondearMonto(fa.costoPlan),
        costoPlanB: null,
        diferenciaDuracionDias: -fa.duracionDias,
        diferenciaCostoPlan: redondearMonto(-fa.costoPlan),
      });
    }
  }

  for (let idx = 0; idx < filasB.length; idx++) {
    if (!usadasB.has(idx)) {
      const fb = filasB[idx];
      if (!fb) continue;
      resultado.push({
        tareaId: fb.tareaId,
        codigo: fb.codigo,
        nombre: fb.nombre,
        nivel: fb.nivel,
        estado: 'AGREGADA',
        duracionDiasA: null,
        duracionDiasB: fb.duracionDias,
        inicioPlanA: null,
        inicioPlanB: fb.inicioPlan,
        finPlanA: null,
        finPlanB: fb.finPlan,
        costoPlanA: null,
        costoPlanB: redondearMonto(fb.costoPlan),
        diferenciaDuracionDias: fb.duracionDias,
        diferenciaCostoPlan: redondearMonto(fb.costoPlan),
      });
    }
  }

  resultado.sort((a, b) => {
    const orden = compararCodigos(a.codigo, b.codigo);
    if (orden !== 0) return orden;
    if (a.estado === 'ELIMINADA' && b.estado === 'AGREGADA') return -1;
    if (a.estado === 'AGREGADA' && b.estado === 'ELIMINADA') return 1;
    return 0;
  });

  return resultado;
}

export function resumirComparacion(
  versionA: ResumenVersionComparacion,
  versionB: ResumenVersionComparacion,
  filasA: readonly FilaLineaBaseComparador[],
  filasB: readonly FilaLineaBaseComparador[],
): ComparacionLineasBase {
  const filas = emparejarFilas(filasA, filasB);
  const difDiasFin =
    versionA.fechaFinProyecto && versionB.fechaFinProyecto
      ? diasCorridosEntre(versionA.fechaFinProyecto, versionB.fechaFinProyecto)
      : null;

  const totales: TotalesComparacion = {
    costoPlanTotalA: redondearMonto(versionA.costoPlanTotal),
    costoPlanTotalB: redondearMonto(versionB.costoPlanTotal),
    diferenciaCostoTotal: redondearMonto(versionB.costoPlanTotal - versionA.costoPlanTotal),
    fechaFinProyectoA: versionA.fechaFinProyecto,
    fechaFinProyectoB: versionB.fechaFinProyecto,
    diferenciaDiasFinProyecto: difDiasFin,
    totalTareas: filas.length,
    tareasIguales: filas.filter((f) => f.estado === 'IGUAL').length,
    tareasModificadas: filas.filter((f) => f.estado === 'MODIFICADA').length,
    tareasAgregadas: filas.filter((f) => f.estado === 'AGREGADA').length,
    tareasEliminadas: filas.filter((f) => f.estado === 'ELIMINADA').length,
  };

  return {
    versionA,
    versionB,
    totales,
    filas,
  };
}

export function calcularVersionGantt(
  lineasBase: readonly { version: number; solicitudCambioId: number | null }[],
): number | null {
  if (lineasBase.length === 0) return null;
  const ordenadas = [...lineasBase].sort((a, b) => b.version - a.version);
  const maxima = ordenadas[0];
  if (!maxima) return null;
  const anterior = ordenadas[1];
  if (maxima.solicitudCambioId !== null && anterior) {
    return anterior.version;
  }
  return maxima.version;
}
