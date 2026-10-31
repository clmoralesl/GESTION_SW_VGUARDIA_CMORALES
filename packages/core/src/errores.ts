import { z } from './validacion';

export const CODIGOS_ERROR = [
  'ROL_REQUERIDO',
  'ROL_INVALIDO',
  'ROL_NO_PERMITIDO',
  'ACCESO_DENEGADO',
  'VALIDACION_FALLIDA',
  'RESTRICCION_VIOLADA',
  'SOLICITUD_INVALIDA',
  'RECURSO_NO_ENCONTRADO',
  'REGISTRO_NO_ENCONTRADO',
  'REGISTRO_DUPLICADO',
  'REGISTRO_RELACIONADO',
  'CONFLICTO',
  'TIENE_ASIGNACIONES',
  'PROYECTO_CERRADO',
  'TRANSICION_INVALIDA',
  'JERARQUIA_INVALIDA',
  'CICLO_DETECTADO',
  'DEPENDENCIA_INVALIDA',
  'CAMPO_CALCULADO',
  'CONTENIDO_DEMASIADO_GRANDE',
  'ERROR_INTERNO',
  'BD_NO_DISPONIBLE',
  'SIN_CONEXION',
  'RESPUESTA_INESPERADA',
] as const;

export type CodigoError = (typeof CODIGOS_ERROR)[number];

export const esquemaCuerpoError = z.object({
  codigo: z.string(),
  error: z.string(),
  mensaje: z.string(),
  detalles: z.unknown().optional(),
});

export type CuerpoError = z.infer<typeof esquemaCuerpoError>;
