import { esquemaFechaIso } from './fechas';
import { validarUmbrales, type Direccion, type Semaforo, type UmbralesKpi } from './semaforo';
import { z } from './validacion';

export const AMBITOS_KPI = ['PROYECTO', 'HITO', 'CAMBIO'] as const;
export type AmbitoKpi = (typeof AMBITOS_KPI)[number];

export const UNIDADES_KPI = ['PORCENTAJE', 'INDICE', 'DIAS', 'CLP', 'NUMERO'] as const;
export type UnidadKpi = (typeof UNIDADES_KPI)[number];

export const DIRECCIONES_KPI = ['MAYOR_MEJOR', 'MENOR_MEJOR'] as const;
export type DireccionKpi = (typeof DIRECCIONES_KPI)[number];

export const esquemaUmbralesKpi = z
  .strictObject({
    verde: z
      .number({ error: 'El umbral verde debe ser un número.' })
      .nullable()
      .optional()
      .transform((v) => (v === undefined ? null : v)),
    amarillo: z
      .number({ error: 'El umbral amarillo debe ser un número.' })
      .nullable()
      .optional()
      .transform((v) => (v === undefined ? null : v)),
  })
  .nullable()
  .optional()
  .transform((v) =>
    v ? { verde: v.verde ?? null, amarillo: v.amarillo ?? null } : { verde: null, amarillo: null },
  );

export const esquemaCrearKpi = z
  .strictObject({
    codigo: z
      .string({ error: 'Ingrese el código.' })
      .trim()
      .min(1, 'Ingrese el código.')
      .max(40, 'Use como máximo 40 caracteres.'),
    nombre: z
      .string({ error: 'Ingrese el nombre.' })
      .trim()
      .min(1, 'Ingrese el nombre.')
      .max(120, 'Use como máximo 120 caracteres.'),
    descripcion: z
      .string()
      .trim()
      .max(1000, 'Use como máximo 1000 caracteres.')
      .nullable()
      .optional(),
    ambito: z.enum(AMBITOS_KPI, { error: 'Seleccione un ámbito válido.' }),
    formula: z
      .string({ error: 'Ingrese la fórmula.' })
      .trim()
      .min(1, 'Ingrese la fórmula.')
      .max(500, 'La fórmula supera 500 caracteres.'),
    unidad: z.enum(UNIDADES_KPI, { error: 'Seleccione una unidad válida.' }),
    meta: z.number({ error: 'La meta debe ser un número.' }).nullable().optional(),
    direccion: z.enum(DIRECCIONES_KPI, { error: 'Seleccione la dirección de mejora.' }),
    esAdicional: z.boolean().optional(),
    activo: z.boolean().optional(),
    umbrales: esquemaUmbralesKpi,
  })
  .superRefine((datos, ctx) => {
    if (datos.ambito === 'HITO') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'El ámbito HITO no está soportado.',
        path: ['ambito'],
        params: { codigo: 'AMBITO_NO_SOPORTADO' },
      });
    }
    const u: UmbralesKpi = datos.umbrales ?? { verde: null, amarillo: null };
    const err = validarUmbrales(datos.direccion as Direccion, u);
    if (err !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: err,
        path: ['umbrales'],
        params: { codigo: 'UMBRALES_INVALIDOS' },
      });
    }
  });

export type CrearKpi = z.infer<typeof esquemaCrearKpi>;

export const esquemaUmbralesParcial = z
  .strictObject({
    verde: z.number({ error: 'El umbral verde debe ser un número.' }).nullable(),
    amarillo: z.number({ error: 'El umbral amarillo debe ser un número.' }).nullable(),
  })
  .nullable()
  .optional();

export const esquemaActualizarKpi = z
  .strictObject({
    nombre: z
      .string({ error: 'Ingrese el nombre.' })
      .trim()
      .min(1, 'Ingrese el nombre.')
      .max(120, 'Use como máximo 120 caracteres.')
      .optional(),
    descripcion: z
      .string()
      .trim()
      .max(1000, 'Use como máximo 1000 caracteres.')
      .nullable()
      .optional(),
    ambito: z.enum(AMBITOS_KPI, { error: 'Seleccione un ámbito válido.' }).optional(),
    formula: z
      .string({ error: 'Ingrese la fórmula.' })
      .trim()
      .min(1, 'Ingrese la fórmula.')
      .max(500, 'La fórmula supera 500 caracteres.')
      .optional(),
    unidad: z.enum(UNIDADES_KPI, { error: 'Seleccione una unidad válida.' }).optional(),
    meta: z.number({ error: 'La meta debe ser un número.' }).nullable().optional(),
    direccion: z.enum(DIRECCIONES_KPI, { error: 'Seleccione la dirección de mejora.' }).optional(),
    esAdicional: z.boolean().optional(),
    activo: z.boolean().optional(),
    umbrales: esquemaUmbralesParcial,
  })
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar.',
  })
  .superRefine((datos, ctx) => {
    if (datos.ambito === 'HITO') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'El ámbito HITO no está soportado.',
        path: ['ambito'],
        params: { codigo: 'AMBITO_NO_SOPORTADO' },
      });
    }
  });

export type ActualizarKpi = z.infer<typeof esquemaActualizarKpi>;

export const esquemaValidarFormula = z.strictObject({
  formula: z.string({ error: 'Ingrese la fórmula.' }).trim().min(1, 'Ingrese la fórmula.'),
  ambito: z.enum(AMBITOS_KPI, { error: 'Seleccione un ámbito válido.' }).optional(),
  proyectoId: z
    .number()
    .int('El identificador de proyecto debe ser un entero.')
    .positive('El identificador de proyecto debe ser positivo.')
    .optional(),
  fechaCorte: esquemaFechaIso.optional(),
});

export type ValidarFormulaDto = z.infer<typeof esquemaValidarFormula>;

export const esquemaConsultaVariablesKpi = z.strictObject({
  proyectoId: z.coerce.number().int().positive().optional(),
  fechaCorte: esquemaFechaIso.optional(),
});

export type ConsultaVariablesKpi = z.infer<typeof esquemaConsultaVariablesKpi>;

export interface KpiDetalleRespuesta {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  ambito: AmbitoKpi;
  formula: string;
  unidad: UnidadKpi;
  meta: number | null;
  direccion: DireccionKpi;
  esAdicional: boolean;
  activo: boolean;
  umbrales: UmbralesKpi;
}

export interface KpiMedicionRespuesta {
  id: number;
  kpiId: number;
  proyectoId: number;
  hitoId: number | null;
  valor: number | null;
  semaforo: Semaforo | null;
  origen: string | null;
  medidoEn: string;
}

export interface KpiProyectoResumen {
  kpiId: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  ambito: AmbitoKpi;
  unidad: UnidadKpi;
  meta: number | null;
  direccion: DireccionKpi;
  valor: number | null;
  semaforo: Semaforo | null;
  medidoEn: string | null;
  origen: string | null;
  umbrales: UmbralesKpi;
}
