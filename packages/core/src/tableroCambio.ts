import {
  CATEGORIAS_CAMBIO,
  duracionRealDias,
  type EstadoEtapa,
  type EstadoSolicitud,
  NIVELES_RIESGO,
  type NivelRiesgo,
  NOMBRES_ETAPAS,
  nivelRiesgo,
  PRIORIDADES_SOLICITUD,
  type PrioridadSolicitud,
} from './cambios';
import { dateAFechaIso, esquemaFechaIso } from './fechas';
import type { UnidadKpi } from './kpi';
import type { Semaforo } from './semaforo';
import { redondear } from './numeros';
import { z } from './validacion';
import type { EtapaVencidaInfo } from './variablesCambio';

export const esquemaConsultaTableroCambio = z
  .strictObject({
    prioridad: z.enum(PRIORIDADES_SOLICITUD).optional(),
    categoria: z.enum(CATEGORIAS_CAMBIO).optional(),
    nivelRiesgo: z.enum(NIVELES_RIESGO).optional(),
    responsable: z.string().trim().min(1).max(120).optional(),
    desde: esquemaFechaIso.optional(),
    hasta: esquemaFechaIso.optional(),
  })
  .refine((d) => d.desde === undefined || d.hasta === undefined || d.desde <= d.hasta, {
    message: 'La fecha inicial debe ser anterior o igual a la fecha final.',
    path: ['desde'],
  });

export type ConsultaTableroCambio = z.infer<typeof esquemaConsultaTableroCambio>;

export interface SolicitudParaEmbudo {
  estado: EstadoSolicitud;
  etapaActual: number;
  etapas: {
    numero: number;
    estado: EstadoEtapa;
  }[];
}

export interface EmbudoEtapaItem {
  numero: number;
  nombre: string;
  alcanzaron: number;
  enEtapa: number;
}

export function embudoEtapas(solicitudes: readonly SolicitudParaEmbudo[]): EmbudoEtapaItem[] {
  const resultado: EmbudoEtapaItem[] = [];
  for (let n = 1; n <= 10; n += 1) {
    let alcanzaron = 0;
    let enEtapa = 0;
    for (const s of solicitudes) {
      const etapa = s.etapas.find((e) => e.numero === n);
      if (etapa && etapa.estado !== 'PENDIENTE') {
        alcanzaron += 1;
      }
      if (s.estado !== 'RECHAZADA' && s.estado !== 'CERRADA' && s.etapaActual === n) {
        enEtapa += 1;
      }
    }
    resultado.push({
      numero: n,
      nombre: NOMBRES_ETAPAS[n] ?? `Etapa ${n}`,
      alcanzaron,
      enEtapa,
    });
  }
  return resultado;
}

export interface SolicitudParaTiempos {
  etapas: {
    numero: number;
    estado: EstadoEtapa;
    fechaIniciada: string | Date | null;
    fechaCompletada: string | Date | null;
  }[];
}

export interface TiempoEtapaItem {
  numero: number;
  nombre: string;
  muestras: number;
  promedioDias: number | null;
}

export function tiempoPromedioPorEtapa(
  solicitudes: readonly SolicitudParaTiempos[],
): TiempoEtapaItem[] {
  const resultado: TiempoEtapaItem[] = [];
  for (let n = 1; n <= 10; n += 1) {
    let sumaDias = 0;
    let muestras = 0;
    for (const s of solicitudes) {
      const etapa = s.etapas.find((e) => e.numero === n);
      if (etapa && etapa.estado === 'COMPLETADA' && etapa.fechaIniciada && etapa.fechaCompletada) {
        const fechaFinIso =
          typeof etapa.fechaCompletada === 'string'
            ? etapa.fechaCompletada.slice(0, 10)
            : dateAFechaIso(etapa.fechaCompletada);
        const dias = duracionRealDias(etapa, fechaFinIso);
        if (typeof dias === 'number') {
          sumaDias += dias;
          muestras += 1;
        }
      }
    }
    resultado.push({
      numero: n,
      nombre: NOMBRES_ETAPAS[n] ?? `Etapa ${n}`,
      muestras,
      promedioDias: muestras > 0 ? redondear(sumaDias / muestras, 2) : null,
    });
  }
  return resultado;
}

export interface SolicitudParaMatriz {
  id: number;
  codigo: string;
  estado: EstadoSolicitud;
  prioridad: PrioridadSolicitud;
  probabilidadRiesgo: number;
  impactoRiesgo: number;
}

export interface MatrizRiesgoItemSolicitud {
  solicitudId: number;
  codigo: string;
  prioridad: PrioridadSolicitud;
}

export interface MatrizRiesgoCelda {
  probabilidad: number;
  impacto: number;
  nivel: NivelRiesgo;
  prioridadMaxima: PrioridadSolicitud | null;
  solicitudes: MatrizRiesgoItemSolicitud[];
}

const PESO_PRIORIDAD: Record<PrioridadSolicitud, number> = {
  BAJA: 1,
  MEDIA: 2,
  ALTA: 3,
  CRITICA: 4,
};

function calcularPrioridadMaxima(
  solicitudes: readonly MatrizRiesgoItemSolicitud[],
): PrioridadSolicitud | null {
  const primero = solicitudes[0];
  if (!primero) return null;
  let maxima: PrioridadSolicitud = primero.prioridad;
  for (let i = 1; i < solicitudes.length; i += 1) {
    const actual = solicitudes[i];
    if (actual && PESO_PRIORIDAD[actual.prioridad] > PESO_PRIORIDAD[maxima]) {
      maxima = actual.prioridad;
    }
  }
  return maxima;
}

export function matrizRiesgo(solicitudes: readonly SolicitudParaMatriz[]): MatrizRiesgoCelda[] {
  const celdas: MatrizRiesgoCelda[] = [];
  const abiertas = solicitudes.filter((s) => s.estado !== 'RECHAZADA' && s.estado !== 'CERRADA');

  for (let p = 5; p >= 1; p -= 1) {
    for (let i = 1; i <= 5; i += 1) {
      const enCelda = abiertas
        .filter((s) => s.probabilidadRiesgo === p && s.impactoRiesgo === i)
        .map((s) => ({
          solicitudId: s.id,
          codigo: s.codigo,
          prioridad: s.prioridad,
        }));

      celdas.push({
        probabilidad: p,
        impacto: i,
        nivel: nivelRiesgo(p, i),
        prioridadMaxima: calcularPrioridadMaxima(enCelda),
        solicitudes: enCelda,
      });
    }
  }
  return celdas;
}

export interface SolicitudParaAdopcion {
  id: number;
  codigo: string;
  titulo: string;
  estado: EstadoSolicitud;
  etapas: {
    numero: number;
    porcentajeAdopcion: number | null;
  }[];
}

export interface AdopcionItem {
  solicitudId: number;
  codigo: string;
  titulo: string;
  porcentaje: number;
}

export interface AdopcionResultado {
  items: AdopcionItem[];
  promedio: number | null;
}

export function adopcionPorSolicitud(
  solicitudes: readonly SolicitudParaAdopcion[],
): AdopcionResultado {
  const items: AdopcionItem[] = [];
  for (const s of solicitudes) {
    if (s.estado === 'CERRADA') {
      const e10 = s.etapas.find((e) => e.numero === 10);
      if (e10 && typeof e10.porcentajeAdopcion === 'number') {
        items.push({
          solicitudId: s.id,
          codigo: s.codigo,
          titulo: s.titulo,
          porcentaje: e10.porcentajeAdopcion,
        });
      }
    }
  }
  const promedio =
    items.length > 0
      ? redondear(items.reduce((acc, it) => acc + it.porcentaje, 0) / items.length, 2)
      : null;
  return { items, promedio };
}

export function tasaAprobacion(aprobadas: number, rechazadas: number): number | null {
  const total = aprobadas + rechazadas;
  if (total === 0) return null;
  return redondear((aprobadas / total) * 100, 2);
}

export interface ResumenTableroCambio {
  total: number;
  abiertas: number;
  aprobadas: number;
  rechazadas: number;
  tasaAprobacion: number | null;
  tiempoCicloPromedio: number | null;
  adopcionPromedio: number | null;
}

export interface KpiTableroHistorialItem {
  medidoEn: string;
  valor: number | null;
  semaforo: Semaforo | null;
}

export interface KpiTableroCambioItem {
  kpiId: number;
  codigo: string;
  nombre: string;
  unidad: UnidadKpi;
  meta: number | null;
  valor: number | null;
  semaforo: Semaforo | null;
  historial: KpiTableroHistorialItem[];
}

export interface AlertaRiesgoAlto {
  solicitudId: number;
  codigo: string;
  titulo: string;
  nivel: NivelRiesgo;
  prioridad: PrioridadSolicitud;
}

export interface AlertaKpiRojo {
  alertaId: number;
  kpiId: number;
  mensaje: string;
  creadaEn: string;
}

export interface AlertasTableroCambio {
  etapasVencidas: EtapaVencidaInfo[];
  riesgosAltos: AlertaRiesgoAlto[];
  kpiEnRojo: AlertaKpiRojo[];
}

export interface TableroCambio {
  corte: string;
  resumen: ResumenTableroCambio;
  embudo: EmbudoEtapaItem[];
  tiemposPorEtapa: TiempoEtapaItem[];
  matrizRiesgo: MatrizRiesgoCelda[];
  adopcion: AdopcionResultado;
  kpis: KpiTableroCambioItem[];
  alertas: AlertasTableroCambio;
  opciones: {
    responsables: string[];
  };
}
