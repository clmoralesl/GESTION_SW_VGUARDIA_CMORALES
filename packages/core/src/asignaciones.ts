import { esquemaFechaIso } from './fechas';
import { tieneMaximoDecimales, z } from './validacion';

export const DEDICACION_MINIMA = 1;
export const DEDICACION_MAXIMA = 100;
export const HORAS_PLAN_MAXIMAS = 99_999_999.99;
export const HORAS_REALES_MAXIMAS = 99_999_999.99;
export const CANTIDAD_PLAN_MAXIMA = 9_999_999_999.99;
export const CANTIDAD_REAL_MAXIMA = 9_999_999_999.99;
export const SEMANAS_CARGA_MAXIMAS = 26;

const MENSAJE_SIN_CAMPOS = 'Debe enviar al menos un campo para actualizar.';
const tieneCampos = (datos: object) => Object.keys(datos).length > 0;

export const esquemaCrearAsignacionProfesional = z.strictObject({
  profesionalId: z
    .number({ error: 'Indique el profesional.' })
    .int('Indique un profesional válido.')
    .positive('Indique un profesional válido.'),
  dedicacion: z
    .number({ error: 'Ingrese el porcentaje de dedicación.' })
    .min(DEDICACION_MINIMA, 'La dedicación debe ser de al menos 1 %.')
    .max(DEDICACION_MAXIMA, 'La dedicación no puede superar 100 %.')
    .refine((v) => tieneMaximoDecimales(v, 2), 'Use como máximo 2 decimales.'),
  horasPlan: z
    .number({ error: 'Ingrese las horas plan.' })
    .min(0, 'Las horas plan no pueden ser negativas.')
    .max(HORAS_PLAN_MAXIMAS, 'Las horas plan superan el máximo permitido.')
    .refine((v) => tieneMaximoDecimales(v, 2), 'Use como máximo 2 decimales.')
    .nullable()
    .optional(),
  horasReales: z
    .number({ error: 'Ingrese las horas reales.' })
    .min(0, 'Las horas reales no pueden ser negativas.')
    .max(HORAS_REALES_MAXIMAS, 'Las horas reales superan el máximo permitido.')
    .refine((v) => tieneMaximoDecimales(v, 2), 'Use como máximo 2 decimales.')
    .nullable()
    .optional(),
});

export const esquemaCrearAsignacionRecurso = z.strictObject({
  recursoId: z
    .number({ error: 'Indique el recurso.' })
    .int('Indique un recurso válido.')
    .positive('Indique un recurso válido.'),
  cantidadPlan: z
    .number({ error: 'Ingrese la cantidad plan.' })
    .min(0, 'La cantidad plan no puede ser negativa.')
    .max(CANTIDAD_PLAN_MAXIMA, 'La cantidad plan supera el máximo permitido.')
    .refine((v) => tieneMaximoDecimales(v, 2), 'Use como máximo 2 decimales.')
    .nullable()
    .optional(),
  cantidadReal: z
    .number({ error: 'Ingrese la cantidad real.' })
    .min(0, 'La cantidad real no puede ser negativa.')
    .max(CANTIDAD_REAL_MAXIMA, 'La cantidad real supera el máximo permitido.')
    .refine((v) => tieneMaximoDecimales(v, 2), 'Use como máximo 2 decimales.')
    .nullable()
    .optional(),
});

export const esquemaCrearAsignacion = z.union([
  esquemaCrearAsignacionProfesional,
  esquemaCrearAsignacionRecurso,
]);

export const esquemaActualizarAsignacionProfesional = z
  .strictObject({
    dedicacion: z
      .number({ error: 'Ingrese el porcentaje de dedicación.' })
      .min(DEDICACION_MINIMA, 'La dedicación debe ser de al menos 1 %.')
      .max(DEDICACION_MAXIMA, 'La dedicación no puede superar 100 %.')
      .refine((v) => tieneMaximoDecimales(v, 2), 'Use como máximo 2 decimales.')
      .optional(),
    horasPlan: z
      .number({ error: 'Ingrese las horas plan.' })
      .min(0, 'Las horas plan no pueden ser negativas.')
      .max(HORAS_PLAN_MAXIMAS, 'Las horas plan superan el máximo permitido.')
      .refine((v) => tieneMaximoDecimales(v, 2), 'Use como máximo 2 decimales.')
      .nullable()
      .optional(),
    horasReales: z
      .number({ error: 'Ingrese las horas reales.' })
      .min(0, 'Las horas reales no pueden ser negativas.')
      .max(HORAS_REALES_MAXIMAS, 'Las horas reales superan el máximo permitido.')
      .refine((v) => tieneMaximoDecimales(v, 2), 'Use como máximo 2 decimales.')
      .nullable()
      .optional(),
    actualizarTarifa: z.boolean().optional(),
  })
  .refine(tieneCampos, { message: MENSAJE_SIN_CAMPOS });

export const esquemaActualizarAsignacionRecurso = z
  .strictObject({
    cantidadPlan: z
      .number({ error: 'Ingrese la cantidad plan.' })
      .min(0, 'La cantidad plan no puede ser negativa.')
      .max(CANTIDAD_PLAN_MAXIMA, 'La cantidad plan supera el máximo permitido.')
      .refine((v) => tieneMaximoDecimales(v, 2), 'Use como máximo 2 decimales.')
      .nullable()
      .optional(),
    cantidadReal: z
      .number({ error: 'Ingrese la cantidad real.' })
      .min(0, 'La cantidad real no puede ser negativa.')
      .max(CANTIDAD_REAL_MAXIMA, 'La cantidad real supera el máximo permitido.')
      .refine((v) => tieneMaximoDecimales(v, 2), 'Use como máximo 2 decimales.')
      .nullable()
      .optional(),
    actualizarTarifa: z.boolean().optional(),
  })
  .refine(tieneCampos, { message: MENSAJE_SIN_CAMPOS });

export const esquemaActualizarAsignacion = z.union([
  esquemaActualizarAsignacionProfesional,
  esquemaActualizarAsignacionRecurso,
]);

export const esquemaConsultaCargaRecursos = z
  .strictObject({
    desde: esquemaFechaIso,
    hasta: esquemaFechaIso,
  })
  .refine((d) => d.desde <= d.hasta, {
    message: 'La fecha inicial debe ser anterior o igual a la fecha final.',
    path: ['desde'],
  })
  .refine(
    (d) => {
      const diffDias = Math.round(
        (Date.parse(`${d.hasta}T00:00:00Z`) - Date.parse(`${d.desde}T00:00:00Z`)) / 86_400_000,
      );
      return diffDias <= SEMANAS_CARGA_MAXIMAS * 7;
    },
    { message: 'El rango de consulta no puede superar 26 semanas.', path: ['hasta'] },
  );

export type CrearAsignacionProfesional = z.infer<typeof esquemaCrearAsignacionProfesional>;
export type CrearAsignacionRecurso = z.infer<typeof esquemaCrearAsignacionRecurso>;
export type CrearAsignacion = z.infer<typeof esquemaCrearAsignacion>;
export type ActualizarAsignacionProfesional = z.infer<
  typeof esquemaActualizarAsignacionProfesional
>;
export type ActualizarAsignacionRecurso = z.infer<typeof esquemaActualizarAsignacionRecurso>;
export type ActualizarAsignacion = z.infer<typeof esquemaActualizarAsignacion>;
export type ConsultaCargaRecursos = z.infer<typeof esquemaConsultaCargaRecursos>;

export interface AsignacionResumen {
  id: number;
  tareaId: number;
  profesionalId: number | null;
  recursoId: number | null;
  dedicacion: number | null;
  horasPlan: number | null;
  horasPlanManual: boolean;
  horasReales: number | null;
  tarifaAplicada: number | null;
  cantidadPlan: number | null;
  cantidadReal: number | null;
  costoUnitarioAplicado: number | null;
  costoPlan: number;
  costoReal: number;
  profesional?: {
    id: number;
    nombre: string;
    cargo: string;
    activo: boolean;
    tarifaHora: number;
    horasDiarias: number;
  } | null;
  recurso?: {
    id: number;
    nombre: string;
    activo: boolean;
    costoUnitario: number;
    unidad: string;
    tipoRecurso?: { id: number; nombre: string } | null;
  } | null;
}
