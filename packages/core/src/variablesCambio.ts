import { redondear } from './numeros';
import { aDiaEpoca } from './calendario';
import { nivelRiesgo } from './cambios';

export interface AccionCorrectivaCambioItem {
  estado: string;
}

export interface EtapaCambioItem {
  id: number;
  numero: number;
  estado: string;
  fechaInicio?: string | Date | null;
  fechaFin?: string | Date | null;
  fechaIniciada?: string | Date | null;
  fechaCompletada?: string | Date | null;
  porcentajeAdopcion?: number | null;
  acciones?: readonly AccionCorrectivaCambioItem[];
}

export interface SolicitudCambioItem {
  id: number;
  codigo: string;
  estado: string;
  fechaRegistro: string | Date;
  fechaDecision?: string | Date | null;
  fechaCierre?: string | Date | null;
  probabilidadRiesgo: number;
  impactoRiesgo: number;
  etapas?: readonly EtapaCambioItem[];
}

export interface LineaBaseCambioItem {
  version: number;
  costoPlanTotal: number;
  fechaFinProyecto?: string | Date | null;
  solicitudCambioId?: number | null;
}

export interface EtapaVencidaInfo {
  etapaId: number;
  solicitudId: number;
  codigo: string;
  numero: number;
  fechaFin: string;
}

export interface DatosCalculoVariablesCambio {
  solicitudes: readonly SolicitudCambioItem[];
  lineasBase: readonly LineaBaseCambioItem[];
  corte: string;
  diasHabilesEntre: (desdeIso: string, hastaIso: string) => number;
}

export interface ValoresVariablesCambio {
  [key: string]: number | null;
  SC_TOTAL: number;
  SC_APROBADAS: number;
  SC_RECHAZADAS: number;
  SC_ABIERTAS: number;
  SC_TIEMPO_CICLO_PROM: number | null;
  SC_TIEMPO_EVAL_PROM: number | null;
  SC_ETAPAS_VENCIDAS: number;
  SC_IMPACTO_COSTO_TOTAL: number;
  SC_IMPACTO_DIAS_TOTAL: number;
  SC_ACC_CORRECTIVAS_TOTAL: number;
  SC_ACC_CORRECTIVAS_CERRADAS: number;
  SC_ADOPCION_PROM: number | null;
  SC_RIESGO_ALTO: number;
}

function aIso(fecha: string | Date): string {
  return (typeof fecha === 'string' ? fecha : fecha.toISOString()).slice(0, 10);
}

export function etapasVencidas(
  solicitudes: readonly SolicitudCambioItem[],
  corte: string,
): EtapaVencidaInfo[] {
  const resultado: EtapaVencidaInfo[] = [];
  const corteIso = corte.slice(0, 10);
  for (const s of solicitudes) {
    if (s.estado === 'RECHAZADA' || s.estado === 'CERRADA') continue;
    for (const e of s.etapas ?? []) {
      if (e.estado === 'EN_CURSO' && e.fechaFin) {
        const finIso = aIso(e.fechaFin);
        if (finIso < corteIso) {
          resultado.push({
            etapaId: e.id,
            solicitudId: s.id,
            codigo: s.codigo,
            numero: e.numero,
            fechaFin: finIso,
          });
        }
      }
    }
  }
  return resultado;
}

export function calcularVariablesCambio(
  datos: DatosCalculoVariablesCambio,
): ValoresVariablesCambio {
  const { solicitudes, lineasBase, corte, diasHabilesEntre } = datos;

  const total = solicitudes.length;
  let aprobadas = 0;
  let rechazadas = 0;
  let abiertas = 0;
  let riesgoAlto = 0;

  let sumaCiclo = 0;
  let cuentaCiclo = 0;

  let sumaEval = 0;
  let cuentaEval = 0;

  let accionesTotal = 0;
  let accionesCerradas = 0;

  let sumaAdopcion = 0;
  let cuentaAdopcion = 0;

  for (const s of solicitudes) {
    if (s.estado === 'APROBADA' || s.estado === 'IMPLEMENTADA' || s.estado === 'CERRADA') {
      aprobadas += 1;
    }
    if (s.estado === 'RECHAZADA') {
      rechazadas += 1;
    }
    const esAbierta = s.estado !== 'RECHAZADA' && s.estado !== 'CERRADA';
    if (esAbierta) {
      abiertas += 1;
      const riesgo = nivelRiesgo(s.probabilidadRiesgo, s.impactoRiesgo);
      if (riesgo === 'ALTO' || riesgo === 'CRITICO') {
        riesgoAlto += 1;
      }
    }

    if (s.estado === 'CERRADA' && s.fechaCierre) {
      const dias = Math.max(0, aDiaEpoca(aIso(s.fechaCierre)) - aDiaEpoca(aIso(s.fechaRegistro)));
      sumaCiclo += dias;
      cuentaCiclo += 1;
    }

    if (s.fechaDecision) {
      const e1 = s.etapas?.find((e) => e.numero === 1);
      const inicio = e1?.fechaIniciada ?? s.fechaRegistro;
      const dias = Math.max(0, aDiaEpoca(aIso(s.fechaDecision)) - aDiaEpoca(aIso(inicio)));
      sumaEval += dias;
      cuentaEval += 1;
    }

    for (const e of s.etapas ?? []) {
      if (typeof e.porcentajeAdopcion === 'number') {
        sumaAdopcion += e.porcentajeAdopcion;
        cuentaAdopcion += 1;
      }
      for (const a of e.acciones ?? []) {
        accionesTotal += 1;
        if (a.estado === 'CERRADA') {
          accionesCerradas += 1;
        }
      }
    }
  }

  const vencidas = etapasVencidas(solicitudes, corte).length;

  const lbsOrdenadas = [...lineasBase].sort((a, b) => a.version - b.version);
  let impactoCosto = 0;
  let impactoDias = 0;

  for (let i = 0; i < lbsOrdenadas.length; i += 1) {
    const lb = lbsOrdenadas[i];
    if (lb && lb.solicitudCambioId != null && i > 0) {
      const anterior = lbsOrdenadas[i - 1];
      if (anterior) {
        impactoCosto += Number(lb.costoPlanTotal) - Number(anterior.costoPlanTotal);
        if (lb.fechaFinProyecto && anterior.fechaFinProyecto) {
          impactoDias += diasHabilesEntre(
            aIso(anterior.fechaFinProyecto),
            aIso(lb.fechaFinProyecto),
          );
        }
      }
    }
  }

  return {
    SC_TOTAL: total,
    SC_APROBADAS: aprobadas,
    SC_RECHAZADAS: rechazadas,
    SC_ABIERTAS: abiertas,
    SC_TIEMPO_CICLO_PROM: cuentaCiclo > 0 ? redondear(sumaCiclo / cuentaCiclo, 2) : null,
    SC_TIEMPO_EVAL_PROM: cuentaEval > 0 ? redondear(sumaEval / cuentaEval, 2) : null,
    SC_ETAPAS_VENCIDAS: vencidas,
    SC_IMPACTO_COSTO_TOTAL: redondear(impactoCosto, 2),
    SC_IMPACTO_DIAS_TOTAL: impactoDias,
    SC_ACC_CORRECTIVAS_TOTAL: accionesTotal,
    SC_ACC_CORRECTIVAS_CERRADAS: accionesCerradas,
    SC_ADOPCION_PROM: cuentaAdopcion > 0 ? redondear(sumaAdopcion / cuentaAdopcion, 2) : null,
    SC_RIESGO_ALTO: riesgoAlto,
  };
}
