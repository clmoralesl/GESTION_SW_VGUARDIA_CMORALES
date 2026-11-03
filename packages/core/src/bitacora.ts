import { esquemaFechaIso } from './fechas';
import { ROLES, type Rol } from './roles';
import { z } from './validacion';

export const ENTIDADES_BITACORA = [
  'Tarea',
  'Proyecto',
  'Asignacion',
  'SolicitudCambio',
  'Hito',
  'Profesional',
  'KpiDefinicion',
  'Dependencia',
  'EtapaCambio',
  'ImpactoCambio',
  'LineaBase',
  'AccionCorrectiva',
  'Evidencia',
  'Feriado',
  'Calendario',
  'Recurso',
] as const;

export type EntidadBitacora = (typeof ENTIDADES_BITACORA)[number];

export const ACCIONES_BITACORA = [
  'CREAR',
  'ACTUALIZAR',
  'ELIMINAR',
  'RECALCULAR',
  'APROBAR',
  'RECHAZAR',
  'IMPORTAR',
  'CERRAR',
] as const;

export type AccionBitacora = (typeof ACCIONES_BITACORA)[number];

export type TipoOrigenBitacora = 'MANUAL' | 'RECALCULO' | 'IMPORTACION' | 'APROBACION' | 'RECHAZO';

export interface OrigenBitacora {
  tipo: TipoOrigenBitacora;
  etiqueta: string;
  solicitudCambioId: number | null;
  detalle: string | null;
}

export interface RegistroBitacora {
  id: number;
  proyectoId: number | null;
  fecha: string;
  rol: Rol | null;
  entidad: string;
  entidadId: number | null;
  accion: AccionBitacora;
  campo: string | null;
  valorAnterior: unknown;
  valorNuevo: unknown;
  origen: OrigenBitacora;
}

export interface RespuestaBitacora {
  registros: RegistroBitacora[];
  total: number;
  pagina: number;
  tamanoPagina: number;
  totalPaginas: number;
}

export const esquemaPaginacion = z.strictObject({
  pagina: z.coerce.number().int().min(1).default(1),
  tamanoPagina: z.coerce.number().int().min(1).max(100).default(25),
});

export type ParametrosPaginacion = z.infer<typeof esquemaPaginacion>;

export const esquemaConsultaBitacora = z
  .strictObject({
    proyectoId: z.coerce.number().int().positive().optional(),
    entidad: z.enum(ENTIDADES_BITACORA).optional(),
    entidadId: z.coerce.number().int().positive().optional(),
    rol: z.enum(ROLES).optional(),
    accion: z.enum(ACCIONES_BITACORA).optional(),
    desde: esquemaFechaIso.optional(),
    hasta: esquemaFechaIso.optional(),
    pagina: z.coerce.number().int().min(1).default(1),
    tamanoPagina: z.coerce.number().int().min(1).max(100).default(25),
  })
  .superRefine((data, ctx) => {
    if (data.entidadId !== undefined && data.entidad === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'No se puede filtrar por id de entidad sin especificar la entidad.',
        path: ['entidadId'],
      });
    }
    if (data.desde !== undefined && data.hasta !== undefined && data.desde > data.hasta) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La fecha hasta no puede ser menor a la fecha desde.',
        path: ['hasta'],
      });
    }
  });

export type ConsultaBitacora = z.infer<typeof esquemaConsultaBitacora>;

export interface EntradaDerivarOrigen {
  accion: string;
  solicitudCambioId?: number | null;
  solicitudCambioCodigo?: string | null;
  origen?: string | null;
}

export function derivarOrigen(entrada: EntradaDerivarOrigen): OrigenBitacora {
  const detalle = entrada.origen ?? null;
  if (entrada.solicitudCambioId) {
    const id = entrada.solicitudCambioId;
    const codigo = entrada.solicitudCambioCodigo ?? `#${id}`;
    if (entrada.accion === 'RECHAZAR') {
      return {
        tipo: 'RECHAZO',
        etiqueta: `Rechazo ${codigo}`,
        solicitudCambioId: id,
        detalle,
      };
    }
    return {
      tipo: 'APROBACION',
      etiqueta: `Aprobación ${codigo}`,
      solicitudCambioId: id,
      detalle,
    };
  }
  if (entrada.accion === 'IMPORTAR') {
    return {
      tipo: 'IMPORTACION',
      etiqueta: 'Importación',
      solicitudCambioId: null,
      detalle,
    };
  }
  if (entrada.accion === 'RECALCULAR') {
    return {
      tipo: 'RECALCULO',
      etiqueta: 'Recálculo',
      solicitudCambioId: null,
      detalle,
    };
  }
  return {
    tipo: 'MANUAL',
    etiqueta: 'Manual',
    solicitudCambioId: null,
    detalle,
  };
}

export interface ResumenValorBitacora {
  texto: string;
  esObjeto: boolean;
  detalles: Record<string, string> | null;
  toString(): string;
}

const MAXIMO_CODIGOS_DETALLE = 10;

function codigoDe(valor: unknown): string | null {
  if (typeof valor !== 'object' || valor === null) return null;
  const codigo = (valor as Record<string, unknown>).codigo;
  return typeof codigo === 'string' ? codigo : null;
}

function formatearArregloAnidado(valor: readonly unknown[]): string {
  const codigos = valor.map(codigoDe);
  if (valor.length > 0 && codigos.every((c) => c !== null)) {
    const visibles = codigos.slice(0, MAXIMO_CODIGOS_DETALLE).join(', ');
    const restantes = valor.length - MAXIMO_CODIGOS_DETALLE;
    return restantes > 0 ? `${visibles} y ${restantes} más` : visibles;
  }
  return valor.length === 1 ? '1 elemento' : `${valor.length} elementos`;
}

function formatearDetalle(valor: unknown): string {
  if (valor === null || valor === undefined) return '-';
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  if (Array.isArray(valor)) return formatearArregloAnidado(valor);
  if (typeof valor === 'object') {
    const cantidad = Object.keys(valor).length;
    return cantidad === 1 ? '1 campo' : `${cantidad} campos`;
  }
  return String(valor);
}

export function resumirValorBitacora(valor: unknown): ResumenValorBitacora {
  if (valor === null || valor === undefined) {
    return {
      texto: '-',
      esObjeto: false,
      detalles: null,
      toString() {
        return this.texto;
      },
    };
  }
  if (typeof valor === 'boolean') {
    return {
      texto: valor ? 'Sí' : 'No',
      esObjeto: false,
      detalles: null,
      toString() {
        return this.texto;
      },
    };
  }
  if (typeof valor === 'number' || typeof valor === 'string') {
    return {
      texto: String(valor),
      esObjeto: false,
      detalles: null,
      toString() {
        return this.texto;
      },
    };
  }
  if (Array.isArray(valor)) {
    const cantidad = valor.length;
    const detalles: Record<string, string> = {};
    valor.forEach((item, index) => {
      detalles[`[${index}]`] = formatearDetalle(item);
    });
    return {
      texto: cantidad === 1 ? '1 elemento' : `${cantidad} elementos`,
      esObjeto: true,
      detalles,
      toString() {
        return this.texto;
      },
    };
  }
  if (typeof valor === 'object') {
    const entries = Object.entries(valor as Record<string, unknown>);
    const cantidad = entries.length;
    const detalles: Record<string, string> = {};
    for (const [clave, val] of entries) {
      detalles[clave] = formatearDetalle(val);
    }
    return {
      texto: cantidad === 1 ? '1 campo' : `${cantidad} campos`,
      esObjeto: true,
      detalles,
      toString() {
        return this.texto;
      },
    };
  }
  return {
    texto: String(valor),
    esObjeto: false,
    detalles: null,
    toString() {
      return this.texto;
    },
  };
}
