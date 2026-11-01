import {
  CANTIDAD_PLAN_MAXIMA,
  DEDICACION_MAXIMA,
  DEDICACION_MINIMA,
  HORAS_PLAN_MAXIMAS,
} from './asignaciones';
import { TIPOS_DEPENDENCIA } from './cronograma';
import { PRESUPUESTO_MAXIMO } from './proyectos';
import { tieneMaximoDecimales, z } from './validacion';

export const TIPOS_IMPACTO = ['DURACION', 'ASIGNACION', 'NUEVA_TAREA', 'PRESUPUESTO'] as const;
export type TipoImpacto = (typeof TIPOS_IMPACTO)[number];

export const OPERACIONES_ASIGNACION = ['agregar', 'modificar', 'quitar'] as const;
export type OperacionAsignacion = (typeof OPERACIONES_ASIGNACION)[number];

export const ELEMENTOS_ASIGNACION = ['PROFESIONAL', 'RECURSO'] as const;
export type ElementoAsignacion = (typeof ELEMENTOS_ASIGNACION)[number];

export const MAXIMO_IMPACTOS_POR_SOLICITUD = 50;

export const esquemaPredecesoraNuevaTarea = z
  .strictObject({
    tareaId: z.number().int().positive().optional(),
    clave: z
      .string()
      .regex(/^N([1-9][0-9]?)$/, 'La clave de predecesora debe tener el formato N1 a N99.')
      .optional(),
    tipo: z.enum(TIPOS_DEPENDENCIA).default('FS'),
    desfaseDias: z
      .number()
      .int('El desfase debe ser un número entero.')
      .min(-3650, 'El desfase no puede ser inferior a -3650 días.')
      .max(3650, 'El desfase no puede superar 3650 días.')
      .default(0),
  })
  .refine(
    (p) =>
      (p.tareaId !== undefined && p.clave === undefined) ||
      (p.tareaId === undefined && p.clave !== undefined),
    { message: 'Debe especificar tareaId o clave de predecesora, pero no ambos.' },
  );

export type PredecesoraNuevaTarea = z.infer<typeof esquemaPredecesoraNuevaTarea>;

export const esquemaImpactoDuracion = z.strictObject({
  tipo: z.literal('DURACION'),
  descripcion: z.string().trim().max(500).optional(),
  tareaId: z.number().int().positive(),
  duracionDias: z
    .number({ error: 'Ingrese la duración en días hábiles.' })
    .int('La duración debe ser un número entero.')
    .min(1, 'La duración debe ser de al menos 1 día hábil.')
    .max(3650, 'La duración no puede superar 3650 días hábiles.'),
});

const agregarProfesional = z.strictObject({
  tipo: z.literal('ASIGNACION'),
  descripcion: z.string().trim().max(500).optional(),
  operacion: z.literal('agregar'),
  elemento: z.literal('PROFESIONAL'),
  tareaId: z.number().int().positive(),
  profesionalId: z.number().int().positive(),
  dedicacion: z
    .number()
    .min(DEDICACION_MINIMA, 'La dedicación debe ser de al menos 1 %.')
    .max(DEDICACION_MAXIMA, 'La dedicación no puede superar 100 %.')
    .refine((v) => tieneMaximoDecimales(v, 2), 'Use como máximo 2 decimales.')
    .optional(),
  horasPlan: z
    .number()
    .min(0, 'Las horas plan no pueden ser negativas.')
    .max(HORAS_PLAN_MAXIMAS, 'Las horas plan superan el máximo permitido.')
    .refine((v) => tieneMaximoDecimales(v, 2), 'Use como máximo 2 decimales.')
    .nullable()
    .optional(),
  tarifaAplicada: z
    .number()
    .min(0, 'La tarifa no puede ser negativa.')
    .max(PRESUPUESTO_MAXIMO, 'La tarifa supera el máximo permitido.')
    .refine((v) => tieneMaximoDecimales(v, 2), 'Use como máximo 2 decimales.')
    .nullable()
    .optional(),
});

const agregarRecurso = z.strictObject({
  tipo: z.literal('ASIGNACION'),
  descripcion: z.string().trim().max(500).optional(),
  operacion: z.literal('agregar'),
  elemento: z.literal('RECURSO'),
  tareaId: z.number().int().positive(),
  recursoId: z.number().int().positive(),
  cantidadPlan: z
    .number()
    .positive('La cantidad plan debe ser mayor a 0.')
    .max(CANTIDAD_PLAN_MAXIMA, 'La cantidad plan supera el máximo permitido.')
    .refine((v) => tieneMaximoDecimales(v, 2), 'Use como máximo 2 decimales.'),
  costoUnitarioAplicado: z
    .number()
    .min(0, 'El costo unitario no puede ser negativo.')
    .max(PRESUPUESTO_MAXIMO, 'El costo unitario supera el máximo permitido.')
    .refine((v) => tieneMaximoDecimales(v, 2), 'Use como máximo 2 decimales.')
    .nullable()
    .optional(),
});

const modificarProfesional = z.strictObject({
  tipo: z.literal('ASIGNACION'),
  descripcion: z.string().trim().max(500).optional(),
  operacion: z.literal('modificar'),
  elemento: z.literal('PROFESIONAL'),
  tareaId: z.number().int().positive(),
  profesionalId: z.number().int().positive(),
  dedicacion: z
    .number()
    .min(DEDICACION_MINIMA, 'La dedicación debe ser de al menos 1 %.')
    .max(DEDICACION_MAXIMA, 'La dedicación no puede superar 100 %.')
    .refine((v) => tieneMaximoDecimales(v, 2), 'Use como máximo 2 decimales.')
    .optional(),
  horasPlan: z
    .number()
    .min(0, 'Las horas plan no pueden ser negativas.')
    .max(HORAS_PLAN_MAXIMAS, 'Las horas plan superan el máximo permitido.')
    .refine((v) => tieneMaximoDecimales(v, 2), 'Use como máximo 2 decimales.')
    .nullable()
    .optional(),
  tarifaAplicada: z
    .number()
    .min(0, 'La tarifa no puede ser negativa.')
    .max(PRESUPUESTO_MAXIMO, 'La tarifa supera el máximo permitido.')
    .refine((v) => tieneMaximoDecimales(v, 2), 'Use como máximo 2 decimales.')
    .nullable()
    .optional(),
});

const modificarRecurso = z.strictObject({
  tipo: z.literal('ASIGNACION'),
  descripcion: z.string().trim().max(500).optional(),
  operacion: z.literal('modificar'),
  elemento: z.literal('RECURSO'),
  tareaId: z.number().int().positive(),
  recursoId: z.number().int().positive(),
  cantidadPlan: z
    .number()
    .positive('La cantidad plan debe ser mayor a 0.')
    .max(CANTIDAD_PLAN_MAXIMA, 'La cantidad plan supera el máximo permitido.')
    .refine((v) => tieneMaximoDecimales(v, 2), 'Use como máximo 2 decimales.')
    .optional(),
  costoUnitarioAplicado: z
    .number()
    .min(0, 'El costo unitario no puede ser negativo.')
    .max(PRESUPUESTO_MAXIMO, 'El costo unitario supera el máximo permitido.')
    .refine((v) => tieneMaximoDecimales(v, 2), 'Use como máximo 2 decimales.')
    .nullable()
    .optional(),
});

const quitarProfesional = z.strictObject({
  tipo: z.literal('ASIGNACION'),
  descripcion: z.string().trim().max(500).optional(),
  operacion: z.literal('quitar'),
  elemento: z.literal('PROFESIONAL'),
  tareaId: z.number().int().positive(),
  profesionalId: z.number().int().positive(),
});

const quitarRecurso = z.strictObject({
  tipo: z.literal('ASIGNACION'),
  descripcion: z.string().trim().max(500).optional(),
  operacion: z.literal('quitar'),
  elemento: z.literal('RECURSO'),
  tareaId: z.number().int().positive(),
  recursoId: z.number().int().positive(),
});

export const esquemaImpactoAsignacion = z.discriminatedUnion('operacion', [
  z.discriminatedUnion('elemento', [agregarProfesional, agregarRecurso]),
  z.discriminatedUnion('elemento', [modificarProfesional, modificarRecurso]),
  z.discriminatedUnion('elemento', [quitarProfesional, quitarRecurso]),
]);

export const esquemaImpactoNuevaTarea = z.strictObject({
  tipo: z.literal('NUEVA_TAREA'),
  descripcion: z.string().trim().max(500).optional(),
  clave: z
    .string()
    .regex(/^N([1-9][0-9]?)$/, 'La clave de la tarea nueva debe tener el formato N1 a N99.'),
  padreId: z.number().int().positive().nullable().optional(),
  nombre: z
    .string()
    .trim()
    .min(1, 'Ingrese el nombre.')
    .max(200, 'Use como máximo 200 caracteres.'),
  duracionDias: z
    .number({ error: 'Ingrese la duración en días hábiles.' })
    .int('La duración debe ser un número entero.')
    .min(1, 'La duración debe ser de al menos 1 día hábil.')
    .max(3650, 'La duración no puede superar 3650 días hábiles.'),
  predecesoras: z
    .array(esquemaPredecesoraNuevaTarea)
    .max(20, 'No puede registrar más de 20 predecesoras.')
    .default([]),
});

export const esquemaImpactoPresupuesto = z.strictObject({
  tipo: z.literal('PRESUPUESTO'),
  descripcion: z.string().trim().max(500).optional(),
  presupuesto: z
    .number({ error: 'Ingrese el presupuesto.' })
    .min(0, 'El presupuesto no puede ser negativo.')
    .max(PRESUPUESTO_MAXIMO, 'El presupuesto supera el máximo permitido.')
    .refine((v) => tieneMaximoDecimales(v, 2), 'Use como máximo 2 decimales.'),
});

export const esquemaCrearImpacto = z.discriminatedUnion('tipo', [
  esquemaImpactoDuracion,
  esquemaImpactoAsignacion,
  esquemaImpactoNuevaTarea,
  esquemaImpactoPresupuesto,
]);

export type EntradaCrearImpacto = z.infer<typeof esquemaCrearImpacto>;

export interface ErrorValidacionLote {
  indice: number;
  mensaje: string;
}

export function validarLoteImpactos(
  impactos: readonly EntradaCrearImpacto[],
): ErrorValidacionLote[] {
  const errores: ErrorValidacionLote[] = [];
  const elementosVistos = new Set<string>();
  const clavesNuevas = new Set<string>();

  for (let i = 0; i < impactos.length; i++) {
    const imp = impactos[i];
    if (!imp) continue;
    if (imp.tipo === 'NUEVA_TAREA') {
      if (clavesNuevas.has(imp.clave)) {
        errores.push({ indice: i, mensaje: `Clave repetida: ${imp.clave}` });
      } else {
        clavesNuevas.add(imp.clave);
      }
    }
  }

  for (let i = 0; i < impactos.length; i++) {
    const imp = impactos[i];
    if (!imp) continue;
    let claveElemento = '';

    if (imp.tipo === 'DURACION') {
      claveElemento = `DURACION_${imp.tareaId}`;
    } else if (imp.tipo === 'PRESUPUESTO') {
      claveElemento = 'PRESUPUESTO';
    } else if (imp.tipo === 'ASIGNACION') {
      if (imp.elemento === 'PROFESIONAL') {
        claveElemento = `ASIGNACION_${imp.tareaId}_PROFESIONAL_${imp.profesionalId}`;
      } else {
        claveElemento = `ASIGNACION_${imp.tareaId}_RECURSO_${imp.recursoId}`;
      }
    } else if (imp.tipo === 'NUEVA_TAREA') {
      claveElemento = `NUEVA_TAREA_${imp.clave}`;
    }

    if (elementosVistos.has(claveElemento)) {
      errores.push({
        indice: i,
        mensaje: `Elemento duplicado en el lote de impactos: ${claveElemento}`,
      });
    } else {
      elementosVistos.add(claveElemento);
    }

    if (imp.tipo === 'NUEVA_TAREA') {
      const predsVistas = new Set<string>();
      for (const pred of imp.predecesoras ?? []) {
        if (pred.clave) {
          if (pred.clave === imp.clave) {
            errores.push({
              indice: i,
              mensaje: `Autodependencia: la tarea ${imp.clave} depende de sí misma.`,
            });
          }
          if (!clavesNuevas.has(pred.clave)) {
            errores.push({
              indice: i,
              mensaje: `La clave de predecesora ${pred.clave} no existe en el lote.`,
            });
          }
          const clavePred = `CLAVE_${pred.clave}`;
          if (predsVistas.has(clavePred)) {
            errores.push({
              indice: i,
              mensaje: `Predecesora duplicada en la tarea: ${pred.clave}`,
            });
          } else {
            predsVistas.add(clavePred);
          }
        } else if (pred.tareaId !== undefined) {
          const clavePred = `ID_${pred.tareaId}`;
          if (predsVistas.has(clavePred)) {
            errores.push({
              indice: i,
              mensaje: `Predecesora duplicada en la tarea: ID ${pred.tareaId}`,
            });
          } else {
            predsVistas.add(clavePred);
          }
        }
      }
    }
  }

  const grafo = new Map<string, string[]>();
  for (const imp of impactos) {
    if (imp && imp.tipo === 'NUEVA_TAREA') {
      const preds: string[] = [];
      for (const p of imp.predecesoras ?? []) {
        if (p.clave && clavesNuevas.has(p.clave)) {
          preds.push(p.clave);
        }
      }
      grafo.set(imp.clave, preds);
    }
  }

  const estado = new Map<string, number>();
  const tareasEnCiclo = new Set<string>();

  function dfs(nodo: string, camino: string[]): boolean {
    estado.set(nodo, 1);
    camino.push(nodo);
    const vecinos = grafo.get(nodo) ?? [];
    for (const v of vecinos) {
      const st = estado.get(v) ?? 0;
      if (st === 1) {
        const idx = camino.indexOf(v);
        for (let k = idx; k < camino.length; k++) {
          const item = camino[k];
          if (item) {
            tareasEnCiclo.add(item);
          }
        }
        return true;
      }
      if (st === 0 && dfs(v, camino)) {
        return true;
      }
    }
    camino.pop();
    estado.set(nodo, 2);
    return false;
  }

  for (const clave of clavesNuevas) {
    if ((estado.get(clave) ?? 0) === 0) {
      dfs(clave, []);
    }
  }

  if (tareasEnCiclo.size > 0) {
    for (let i = 0; i < impactos.length; i++) {
      const imp = impactos[i];
      if (imp && imp.tipo === 'NUEVA_TAREA' && tareasEnCiclo.has(imp.clave)) {
        errores.push({
          indice: i,
          mensaje: `Ciclo detectado entre tareas nuevas del lote que involucra a ${imp.clave}.`,
        });
      }
    }
  }

  return errores;
}
