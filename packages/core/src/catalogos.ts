import { tieneMaximoDecimales, z } from './validacion';

export const TARIFA_HORA_MAXIMA = 9_999_999;
export const COSTO_UNITARIO_MAXIMO = 99_999_999;
export const HORAS_DIARIAS_MAXIMAS = 24;
export const HORAS_DIARIAS_POR_DEFECTO = 8;

export const UNIDADES_SUGERIDAS = [
  'hora',
  'unidad',
  'día',
  'mes',
  'licencia',
  'litro',
  'kg',
  'servicio',
] as const;

export const TIPOS_RECURSO = [
  {
    nombre: 'Humano',
    descripcion: 'Mano de obra externa cobrada por unidad, sin control de sobreasignación.',
  },
  {
    nombre: 'Equipamiento',
    descripcion: 'Herramientas y equipos del taller cobrados por uso.',
  },
  { nombre: 'Material', descripcion: 'Insumos y repuestos que se consumen.' },
  {
    nombre: 'Servicio',
    descripcion: 'Servicios contratados a terceros y licencias.',
  },
] as const;

const textoCatalogo = (campo: string, maximo: number) =>
  z
    .string({ error: `Ingrese ${campo}.` })
    .normalize('NFC')
    .trim()
    .overwrite((texto) => texto.replace(/\s+/g, ' '))
    .min(1, `Ingrese ${campo}.`)
    .max(maximo, `Use como máximo ${maximo} caracteres.`);

const MENSAJE_SIN_CAMPOS = 'Debe enviar al menos un campo para actualizar.';
const tieneCampos = (datos: object) => Object.keys(datos).length > 0;
const esquemaActivo = z.boolean({ error: 'Indique si está activo.' });

const camposProfesional = {
  nombre: textoCatalogo('el nombre', 120),
  cargo: textoCatalogo('el cargo', 120),
  tarifaHora: z
    .number({ error: 'Ingrese la tarifa por hora.' })
    .int('Ingrese la tarifa en pesos, sin decimales.')
    .min(0, 'La tarifa no puede ser negativa.')
    .max(TARIFA_HORA_MAXIMA, 'La tarifa supera el máximo permitido.'),
  horasDiarias: z
    .number({ error: 'Ingrese las horas por día.' })
    .gt(0, 'Las horas por día deben ser mayores que 0.')
    .max(HORAS_DIARIAS_MAXIMAS, 'Las horas por día no pueden superar 24.')
    .refine((valor) => tieneMaximoDecimales(valor, 2), 'Use como máximo 2 decimales.'),
};

export const esquemaCrearProfesional = z.strictObject({
  ...camposProfesional,
  horasDiarias: camposProfesional.horasDiarias.default(HORAS_DIARIAS_POR_DEFECTO),
});

export const esquemaActualizarProfesional = z
  .strictObject({ ...camposProfesional, activo: esquemaActivo })
  .partial()
  .refine(tieneCampos, MENSAJE_SIN_CAMPOS);

const camposRecurso = {
  nombre: textoCatalogo('el nombre', 120),
  tipoRecursoId: z
    .number({ error: 'Seleccione el tipo de recurso.' })
    .int('Seleccione el tipo de recurso.')
    .positive('Seleccione el tipo de recurso.'),
  unidad: textoCatalogo('la unidad', 30),
  costoUnitario: z
    .number({ error: 'Ingrese el costo unitario.' })
    .int('Ingrese el costo en pesos, sin decimales.')
    .min(0, 'El costo no puede ser negativo.')
    .max(COSTO_UNITARIO_MAXIMO, 'El costo supera el máximo permitido.'),
};

export const esquemaCrearRecurso = z.strictObject(camposRecurso);

export const esquemaActualizarRecurso = z
  .strictObject({ ...camposRecurso, activo: esquemaActivo })
  .partial()
  .refine(tieneCampos, MENSAJE_SIN_CAMPOS);

export type CrearProfesional = z.infer<typeof esquemaCrearProfesional>;
export type ActualizarProfesional = z.infer<typeof esquemaActualizarProfesional>;
export type CrearRecurso = z.infer<typeof esquemaCrearRecurso>;
export type ActualizarRecurso = z.infer<typeof esquemaActualizarRecurso>;

export function claveNombre(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/(?<![nN])\u0303|[\u0300-\u0302\u0304-\u036f]/g, '')
    .normalize('NFC')
    .toLocaleLowerCase('es')
    .replace(/\s+/g, ' ')
    .trim();
}

export function textoAsignaciones(cantidad: number): string {
  return cantidad === 1 ? '1 asignación' : `${cantidad} asignaciones`;
}

export function mensajeTieneAsignaciones(
  entidad: string,
  nombre: string,
  cantidad: number,
): string {
  return `${entidad} «${nombre}» tiene ${textoAsignaciones(cantidad)}. Solo puede desactivarlo.`;
}

export interface TipoRecursoResumen {
  id: number;
  nombre: string;
  descripcion: string | null;
}

export interface ProfesionalResumen {
  id: number;
  nombre: string;
  cargo: string;
  tarifaHora: number;
  horasDiarias: number;
  activo: boolean;
  numeroAsignaciones: number;
}

export interface RecursoResumen {
  id: number;
  nombre: string;
  tipoRecurso: { id: number; nombre: string };
  unidad: string;
  costoUnitario: number;
  activo: boolean;
  numeroAsignaciones: number;
}
