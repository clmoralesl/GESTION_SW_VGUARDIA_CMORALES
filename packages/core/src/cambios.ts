import { dateAFechaIso, diasCorridosEntre, esquemaFechaIso } from './fechas';
import { coincideBusqueda } from './texto';
import { z } from './validacion';

export const ESTADOS_SOLICITUD = [
  'REGISTRADA',
  'EN_EVALUACION',
  'APROBADA',
  'RECHAZADA',
  'IMPLEMENTADA',
  'CERRADA',
] as const;
export type EstadoSolicitud = (typeof ESTADOS_SOLICITUD)[number];

export const ESTADOS_ETAPA = ['PENDIENTE', 'EN_CURSO', 'COMPLETADA', 'OMITIDA'] as const;
export type EstadoEtapa = (typeof ESTADOS_ETAPA)[number];

export const PRIORIDADES_SOLICITUD = ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'] as const;
export type PrioridadSolicitud = (typeof PRIORIDADES_SOLICITUD)[number];

export const CATEGORIAS_CAMBIO = ['ALCANCE', 'PLAZO', 'COSTO', 'RECURSO', 'CALIDAD'] as const;
export type CategoriaCambio = (typeof CATEGORIAS_CAMBIO)[number];

export const NIVELES_RIESGO = ['BAJO', 'MEDIO', 'ALTO', 'CRITICO'] as const;
export type NivelRiesgo = (typeof NIVELES_RIESGO)[number];

export const ESTADOS_ACCION = ['PENDIENTE', 'EN_CURSO', 'CERRADA'] as const;
export type EstadoAccion = (typeof ESTADOS_ACCION)[number];

export const NOMBRES_ETAPAS: Record<number, string> = {
  1: 'Identificar la necesidad del cambio',
  2: 'Analizar y evaluar la realización del cambio',
  3: 'Evaluación de los riesgos',
  4: 'Planificación',
  5: 'Comunicación del cambio',
  6: 'Implementación del cambio',
  7: 'Evaluación y seguimiento del plan de trabajo',
  8: 'Comunicación de los resultados a corto plazo',
  9: 'Generar las acciones correctivas',
  10: 'Adoptar el cambio en la cultura de la empresa',
};

export const ETAPAS_OBLIGATORIAS = [1, 2, 3, 6, 10] as const;
const TERMINALES_ETAPA: readonly EstadoEtapa[] = ['COMPLETADA', 'OMITIDA'];
const ESTADOS_TERMINALES: readonly EstadoSolicitud[] = ['RECHAZADA', 'CERRADA'];

const ESTADOS_PERMITIDOS_POR_ETAPA: Record<number, readonly EstadoSolicitud[]> = {
  1: ['REGISTRADA'],
  2: ['REGISTRADA', 'EN_EVALUACION'],
  3: ['EN_EVALUACION'],
  4: ['APROBADA'],
  5: ['APROBADA'],
  6: ['APROBADA'],
  7: ['IMPLEMENTADA'],
  8: ['IMPLEMENTADA'],
  9: ['IMPLEMENTADA'],
  10: ['IMPLEMENTADA'],
};

export interface DetallesTransicion {
  motivo: string;
  estadoSolicitud?: EstadoSolicitud;
  etapa?: number;
  estadoEtapa?: EstadoEtapa;
  [clave: string]: unknown;
}

export class ErrorTransicion extends Error {
  readonly motivo: string;
  readonly detalles: DetallesTransicion;
  constructor(motivo: string, detalles: Partial<DetallesTransicion> = {}) {
    super(motivo);
    this.name = 'ErrorTransicion';
    this.motivo = motivo;
    this.detalles = { motivo, ...detalles };
  }
}

export const esTerminalEtapa = (estado: EstadoEtapa): boolean => TERMINALES_ETAPA.includes(estado);

export function calcularEtapaActual(
  etapas: readonly { numero: number; estado: EstadoEtapa }[],
): number {
  const pendiente = etapas.find((e) => !esTerminalEtapa(e.estado));
  return pendiente ? pendiente.numero : 10;
}

export function siguienteCodigo(codigos: readonly string[]): string {
  const maximo = codigos.reduce((max, codigo) => {
    const r = /^SC-(\d+)$/.exec(codigo);
    return r ? Math.max(max, Number(r[1])) : max;
  }, 0);
  return `SC-${String(maximo + 1).padStart(3, '0')}`;
}

export function nivelRiesgo(probabilidad: number, impacto: number): NivelRiesgo {
  const producto = probabilidad * impacto;
  if (producto >= 15) return 'CRITICO';
  if (producto >= 10) return 'ALTO';
  if (producto >= 5) return 'MEDIO';
  return 'BAJO';
}

export function duracionRealDias(
  etapa: {
    estado: EstadoEtapa;
    fechaIniciada?: string | Date | null;
    fechaCompletada?: string | Date | null;
  },
  hoy: string,
): number | null {
  if (!etapa.fechaIniciada) return null;
  const inicio =
    typeof etapa.fechaIniciada === 'string'
      ? etapa.fechaIniciada.slice(0, 10)
      : dateAFechaIso(etapa.fechaIniciada);
  let fin: string | null = null;
  if (etapa.estado === 'COMPLETADA' && etapa.fechaCompletada) {
    fin =
      typeof etapa.fechaCompletada === 'string'
        ? etapa.fechaCompletada.slice(0, 10)
        : dateAFechaIso(etapa.fechaCompletada);
  } else if (etapa.estado === 'EN_CURSO') {
    fin = hoy.slice(0, 10);
  }
  if (!fin) return null;
  return diasCorridosEntre(inicio, fin) + 1;
}

export interface EtapaParaAccion {
  numero: number;
  estado: EstadoEtapa;
  fechaIniciada?: string | Date | null;
  fechaCompletada?: string | Date | null;
  comentario?: string | null;
  porcentajeAdopcion?: number | string | null;
  accionesAbiertas?: number;
  accionesTotales?: number;
}

export interface SolicitudParaAccion {
  estado: EstadoSolicitud;
  etapaActual: number;
  etapas: EtapaParaAccion[];
}

export type TipoAccionEtapa = 'iniciar' | 'completar' | 'omitir';

export interface DatosAccionEtapa {
  hoy: string;
  comentario?: string;
}

export function aplicarAccionEtapa<T extends SolicitudParaAccion>(
  solicitud: T,
  numero: number,
  accion: TipoAccionEtapa,
  datos: DatosAccionEtapa,
): T {
  if (ESTADOS_TERMINALES.includes(solicitud.estado)) {
    throw new ErrorTransicion('SOLICITUD_TERMINAL', {
      estadoSolicitud: solicitud.estado,
      etapa: numero,
    });
  }

  const etapas = solicitud.etapas.map((e) => ({ ...e }));
  const etapa = etapas.find((e) => e.numero === numero);
  if (!etapa) {
    throw new ErrorTransicion('ETAPA_INEXISTENTE', {
      estadoSolicitud: solicitud.estado,
      etapa: numero,
    });
  }

  const anterior = etapas.find((e) => e.numero === numero - 1);
  if (anterior && !esTerminalEtapa(anterior.estado)) {
    throw new ErrorTransicion('ETAPA_ANTERIOR_PENDIENTE', {
      estadoSolicitud: solicitud.estado,
      etapa: numero,
      estadoEtapa: etapa.estado,
    });
  }

  const permitidos = ESTADOS_PERMITIDOS_POR_ETAPA[numero] ?? [];
  if (!permitidos.includes(solicitud.estado)) {
    throw new ErrorTransicion('ESTADO_SOLICITUD_NO_PERMITE', {
      estadoSolicitud: solicitud.estado,
      etapa: numero,
      estadoEtapa: etapa.estado,
    });
  }

  let nuevoEstadoSolicitud = solicitud.estado;

  if (accion === 'iniciar') {
    if (etapa.estado !== 'PENDIENTE') {
      throw new ErrorTransicion('ETAPA_NO_PENDIENTE', {
        estadoSolicitud: solicitud.estado,
        etapa: numero,
        estadoEtapa: etapa.estado,
      });
    }
    etapa.estado = 'EN_CURSO';
    etapa.fechaIniciada = datos.hoy;
    if (numero === 2) nuevoEstadoSolicitud = 'EN_EVALUACION';
  } else if (accion === 'completar') {
    if (etapa.estado !== 'EN_CURSO') {
      throw new ErrorTransicion('ETAPA_NO_EN_CURSO', {
        estadoSolicitud: solicitud.estado,
        etapa: numero,
        estadoEtapa: etapa.estado,
      });
    }
    if (
      numero === 10 &&
      (etapa.porcentajeAdopcion === null || etapa.porcentajeAdopcion === undefined)
    ) {
      throw new ErrorTransicion('ADOPCION_REQUERIDA', {
        estadoSolicitud: solicitud.estado,
        etapa: numero,
        estadoEtapa: etapa.estado,
      });
    }
    if (numero === 9 && (etapa.accionesAbiertas ?? 0) > 0) {
      throw new ErrorTransicion('ACCIONES_ABIERTAS', {
        estadoSolicitud: solicitud.estado,
        etapa: numero,
        estadoEtapa: etapa.estado,
      });
    }
    etapa.estado = 'COMPLETADA';
    etapa.fechaCompletada = datos.hoy;
    if (numero === 6) nuevoEstadoSolicitud = 'IMPLEMENTADA';
    if (numero === 10) nuevoEstadoSolicitud = 'CERRADA';
  } else if (accion === 'omitir') {
    if ((ETAPAS_OBLIGATORIAS as readonly number[]).includes(numero)) {
      throw new ErrorTransicion('ETAPA_NO_OMITIBLE', {
        estadoSolicitud: solicitud.estado,
        etapa: numero,
        estadoEtapa: etapa.estado,
      });
    }
    if (esTerminalEtapa(etapa.estado)) {
      throw new ErrorTransicion('ETAPA_TERMINADA', {
        estadoSolicitud: solicitud.estado,
        etapa: numero,
        estadoEtapa: etapa.estado,
      });
    }
    if (!datos.comentario || !datos.comentario.trim()) {
      throw new ErrorTransicion('COMENTARIO_REQUERIDO', {
        estadoSolicitud: solicitud.estado,
        etapa: numero,
        estadoEtapa: etapa.estado,
      });
    }
    if (numero === 9 && (etapa.accionesTotales ?? 0) > 0) {
      throw new ErrorTransicion('ETAPA_CON_ACCIONES', {
        estadoSolicitud: solicitud.estado,
        etapa: numero,
        estadoEtapa: etapa.estado,
      });
    }
    etapa.estado = 'OMITIDA';
    etapa.comentario = datos.comentario.trim();
  } else {
    throw new ErrorTransicion('ACCION_DESCONOCIDA', {
      estadoSolicitud: solicitud.estado,
      etapa: numero,
      estadoEtapa: etapa.estado,
    });
  }

  return {
    ...solicitud,
    estado: nuevoEstadoSolicitud,
    etapas,
    etapaActual: calcularEtapaActual(etapas),
  };
}

export function puedeDecidir(solicitud: {
  estado: EstadoSolicitud;
  etapas: readonly { numero: number; estado: EstadoEtapa }[];
}): boolean {
  if (solicitud.estado !== 'EN_EVALUACION') return false;
  const etapa3 = solicitud.etapas.find((e) => e.numero === 3);
  return etapa3?.estado === 'COMPLETADA';
}

export function decidir<T extends SolicitudParaAccion>(
  solicitud: T,
  decision: 'aprobar' | 'rechazar',
  opciones?: { simulacion?: boolean },
): T {
  if (opciones?.simulacion) {
    if (solicitud.estado !== 'REGISTRADA' && solicitud.estado !== 'EN_EVALUACION') {
      throw new ErrorTransicion('ESTADO_SOLICITUD_NO_PERMITE', {
        estadoSolicitud: solicitud.estado,
      });
    }
  } else {
    if (solicitud.estado !== 'EN_EVALUACION') {
      throw new ErrorTransicion('ESTADO_SOLICITUD_NO_PERMITE', {
        estadoSolicitud: solicitud.estado,
      });
    }
    const etapa3 = solicitud.etapas.find((e) => e.numero === 3);
    if (etapa3?.estado !== 'COMPLETADA') {
      throw new ErrorTransicion('ETAPA_3_PENDIENTE', {
        estadoSolicitud: solicitud.estado,
        etapa: 3,
        estadoEtapa: etapa3?.estado,
      });
    }
  }
  return {
    ...solicitud,
    estado: decision === 'aprobar' ? 'APROBADA' : 'RECHAZADA',
  };
}

export interface SolicitudFiltrable {
  codigo: string;
  titulo: string;
  responsable: string;
  estado: EstadoSolicitud;
  etapaActual: number;
  prioridad: PrioridadSolicitud;
  categoria: CategoriaCambio;
  probabilidadRiesgo: number;
  impactoRiesgo: number;
  fechaRegistro: string | Date;
}

export interface FiltrosSolicitud {
  estado?: EstadoSolicitud;
  etapaActual?: number;
  responsable?: string;
  prioridad?: PrioridadSolicitud;
  categoria?: CategoriaCambio;
  nivelRiesgo?: NivelRiesgo;
  fechaDesde?: string;
  fechaHasta?: string;
}

export function filtrarSolicitudes<T extends SolicitudFiltrable>(
  solicitudes: readonly T[],
  filtros: FiltrosSolicitud,
): T[] {
  return solicitudes.filter((s) => {
    if (filtros.estado && s.estado !== filtros.estado) return false;
    if (filtros.etapaActual !== undefined && s.etapaActual !== filtros.etapaActual) return false;
    if (filtros.responsable && !coincideBusqueda(s.responsable, filtros.responsable)) return false;
    if (filtros.prioridad && s.prioridad !== filtros.prioridad) return false;
    if (filtros.categoria && s.categoria !== filtros.categoria) return false;
    if (
      filtros.nivelRiesgo &&
      nivelRiesgo(s.probabilidadRiesgo, s.impactoRiesgo) !== filtros.nivelRiesgo
    )
      return false;
    const fechaRegIso =
      typeof s.fechaRegistro === 'string'
        ? s.fechaRegistro.slice(0, 10)
        : dateAFechaIso(s.fechaRegistro);
    if (filtros.fechaDesde && fechaRegIso < filtros.fechaDesde) return false;
    if (filtros.fechaHasta && fechaRegIso > filtros.fechaHasta) return false;
    return true;
  });
}

export const esquemaCrearSolicitud = z.strictObject({
  titulo: z.string().trim().min(3).max(200),
  descripcion: z.string().trim().min(3),
  justificacion: z.string().trim().min(3),
  solicitante: z.string().trim().min(2).max(120),
  responsable: z.string().trim().min(2).max(120),
  prioridad: z.enum(PRIORIDADES_SOLICITUD),
  categoria: z.enum(CATEGORIAS_CAMBIO),
  probabilidadRiesgo: z.number().int().min(1).max(5),
  impactoRiesgo: z.number().int().min(1).max(5),
});

export type EntradaCrearSolicitud = z.infer<typeof esquemaCrearSolicitud>;

export const esquemaActualizarSolicitud = z.strictObject({
  titulo: z.string().trim().min(3).max(200).optional(),
  descripcion: z.string().trim().min(3).optional(),
  justificacion: z.string().trim().min(3).optional(),
  solicitante: z.string().trim().min(2).max(120).optional(),
  responsable: z.string().trim().min(2).max(120).optional(),
  prioridad: z.enum(PRIORIDADES_SOLICITUD).optional(),
  categoria: z.enum(CATEGORIAS_CAMBIO).optional(),
  probabilidadRiesgo: z.number().int().min(1).max(5).optional(),
  impactoRiesgo: z.number().int().min(1).max(5).optional(),
});

export type EntradaActualizarSolicitud = z.infer<typeof esquemaActualizarSolicitud>;

export const esquemaActualizarEtapa = z
  .strictObject({
    responsable: z.string().trim().min(2).max(120).nullable().optional(),
    fechaInicio: esquemaFechaIso.nullable().optional(),
    fechaFin: esquemaFechaIso.nullable().optional(),
    comentario: z.string().trim().nullable().optional(),
    porcentajeAdopcion: z.number().min(0).max(100).nullable().optional(),
  })
  .refine(
    (datos) => {
      if (datos.fechaInicio && datos.fechaFin) {
        return datos.fechaFin >= datos.fechaInicio;
      }
      return true;
    },
    {
      message: 'La fecha de fin debe ser posterior o igual a la fecha de inicio.',
      path: ['fechaFin'],
    },
  );

export type EntradaActualizarEtapa = z.infer<typeof esquemaActualizarEtapa>;

export const esquemaOmitirEtapa = z.strictObject({
  comentario: z.string().trim().min(1, 'El comentario es requerido para omitir una etapa.'),
});

export type EntradaOmitirEtapa = z.infer<typeof esquemaOmitirEtapa>;

export const esquemaCrearAccionCorrectiva = z.strictObject({
  descripcion: z.string().trim().min(3),
  responsable: z.string().trim().min(2).max(120),
  fechaCompromiso: esquemaFechaIso,
});

export type EntradaCrearAccionCorrectiva = z.infer<typeof esquemaCrearAccionCorrectiva>;

export const esquemaActualizarAccionCorrectiva = z.strictObject({
  descripcion: z.string().trim().min(3).optional(),
  responsable: z.string().trim().min(2).max(120).optional(),
  fechaCompromiso: esquemaFechaIso.optional(),
  estado: z.enum(ESTADOS_ACCION).optional(),
  fechaCierre: esquemaFechaIso.nullable().optional(),
});

export type EntradaActualizarAccionCorrectiva = z.infer<typeof esquemaActualizarAccionCorrectiva>;

export const esquemaRechazarSolicitud = z.strictObject({
  motivo: z
    .string()
    .trim()
    .min(1, 'El motivo es requerido para rechazar la solicitud.')
    .max(2000, 'El motivo no puede superar 2000 caracteres.'),
});

export type EntradaRechazarSolicitud = z.infer<typeof esquemaRechazarSolicitud>;
