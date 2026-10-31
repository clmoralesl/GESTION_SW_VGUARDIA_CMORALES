import { esquemaFechaIso } from './fechas';
import type { TareaAfectada } from './recalculo';
import { tieneMaximoDecimales, z } from './validacion';

export const DIAS_LABORABLES_POR_DEFECTO = [1, 2, 3, 4, 5] as const;

export const DIAS_SEMANA_EN_PANTALLA = [
  { valor: 1, nombre: 'Lunes' },
  { valor: 2, nombre: 'Martes' },
  { valor: 3, nombre: 'Miércoles' },
  { valor: 4, nombre: 'Jueves' },
  { valor: 5, nombre: 'Viernes' },
  { valor: 6, nombre: 'Sábado' },
  { valor: 0, nombre: 'Domingo' },
] as const;

export interface CalendarioLaboral {
  readonly diasLaborables: ReadonlySet<number>;
  readonly feriados: ReadonlySet<number>;
}

export interface FeriadoCalendario {
  id: number;
  fecha: string;
  descripcion: string;
}

export interface CalendarioProyecto {
  proyectoId: number;
  diasLaborables: number[];
  horasPorDia: number;
  feriados: FeriadoCalendario[];
}

export interface RespuestaCalendario {
  calendario: CalendarioProyecto;
  tareasAfectadas: TareaAfectada[];
}

export class CalendarioSinDiasHabilesError extends Error {
  constructor() {
    super('El calendario no tiene días hábiles alcanzables.');
    this.name = 'CalendarioSinDiasHabilesError';
  }
}

const MILISEGUNDOS_DIA = 86_400_000;

export const aDiaEpoca = (fechaIso: string): number =>
  Math.round(Date.parse(`${fechaIso}T00:00:00.000Z`) / MILISEGUNDOS_DIA);

export const aFechaIso = (dia: number): string =>
  new Date(dia * MILISEGUNDOS_DIA).toISOString().slice(0, 10);

const diaSemana = (dia: number): number => (((dia + 4) % 7) + 7) % 7;

export function crearCalendarioLaboral(datos: {
  diasLaborables: readonly number[];
  feriados?: readonly string[];
}): CalendarioLaboral {
  const diasLaborables = new Set(
    datos.diasLaborables.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6),
  );
  if (diasLaborables.size === 0) throw new CalendarioSinDiasHabilesError();
  return { diasLaborables, feriados: new Set((datos.feriados ?? []).map(aDiaEpoca)) };
}

export const CALENDARIO_POR_DEFECTO = crearCalendarioLaboral({
  diasLaborables: DIAS_LABORABLES_POR_DEFECTO,
});

export function calendarioLaboralDe(
  calendario: Pick<CalendarioProyecto, 'diasLaborables' | 'feriados'>,
): CalendarioLaboral {
  return crearCalendarioLaboral({
    diasLaborables: calendario.diasLaborables,
    feriados: calendario.feriados.map((f) => f.fecha),
  });
}

export const esDiaHabil = (dia: number, calendario: CalendarioLaboral): boolean =>
  calendario.diasLaborables.has(diaSemana(dia)) && !calendario.feriados.has(dia);

const limitePasos = (n: number, calendario: CalendarioLaboral): number =>
  7 * (Math.abs(n) + calendario.feriados.size + 1);

function normalizarAdelante(dia: number, calendario: CalendarioLaboral): number {
  const limite = limitePasos(0, calendario);
  let actual = dia;
  for (let pasos = 0; !esDiaHabil(actual, calendario); pasos += 1) {
    if (pasos > limite) throw new CalendarioSinDiasHabilesError();
    actual += 1;
  }
  return actual;
}

function normalizarAtras(dia: number, calendario: CalendarioLaboral): number {
  const limite = limitePasos(0, calendario);
  let actual = dia;
  for (let pasos = 0; !esDiaHabil(actual, calendario); pasos += 1) {
    if (pasos > limite) throw new CalendarioSinDiasHabilesError();
    actual -= 1;
  }
  return actual;
}

function avanzar(dia: number, n: number, calendario: CalendarioLaboral): number {
  const paso = n < 0 ? -1 : 1;
  const limite = limitePasos(n, calendario);
  let restantes = Math.abs(n);
  let actual = dia;
  let pasos = 0;
  while (restantes > 0) {
    actual += paso;
    pasos += 1;
    if (pasos > limite) throw new CalendarioSinDiasHabilesError();
    if (esDiaHabil(actual, calendario)) restantes -= 1;
  }
  return actual;
}

export function esHabil(fechaIso: string, calendario: CalendarioLaboral): boolean {
  return esDiaHabil(aDiaEpoca(fechaIso), calendario);
}

export function siguienteHabil(fechaIso: string, calendario: CalendarioLaboral): string {
  return aFechaIso(normalizarAdelante(aDiaEpoca(fechaIso), calendario));
}

export function anteriorHabil(fechaIso: string, calendario: CalendarioLaboral): string {
  return aFechaIso(normalizarAtras(aDiaEpoca(fechaIso), calendario));
}

export function sumarDiasHabiles(
  fechaIso: string,
  n: number,
  calendario: CalendarioLaboral,
): string {
  if (!Number.isInteger(n)) {
    throw new RangeError('La cantidad de días hábiles debe ser un número entero.');
  }
  const dia = aDiaEpoca(fechaIso);
  return aFechaIso(n === 0 ? normalizarAdelante(dia, calendario) : avanzar(dia, n, calendario));
}

export function diasHabilesEntre(
  desdeIso: string,
  hastaIso: string,
  calendario: CalendarioLaboral,
): number {
  const desde = aDiaEpoca(desdeIso);
  const hasta = aDiaEpoca(hastaIso);
  const menor = Math.min(desde, hasta);
  const mayor = Math.max(desde, hasta);
  let cuenta = 0;
  for (let dia = menor + 1; dia <= mayor; dia += 1) {
    if (esDiaHabil(dia, calendario)) cuenta += 1;
  }
  if (cuenta === 0) return 0;
  return desde <= hasta ? cuenta : -cuenta;
}

export function formatearDuracion(dias: number): string {
  return dias === 1 ? '1 día hábil' : `${dias} días hábiles`;
}

export const esquemaDiasLaborables = z
  .array(
    z
      .number({ error: 'Seleccione días de la semana válidos.' })
      .int('Seleccione días de la semana válidos.')
      .min(0, 'Seleccione días de la semana válidos.')
      .max(6, 'Seleccione días de la semana válidos.'),
    { error: 'Seleccione los días laborables.' },
  )
  .min(1, 'Seleccione al menos un día laborable.')
  .refine((dias) => new Set(dias).size === dias.length, 'No repita días de la semana.');

export const esquemaActualizarCalendario = z
  .object({
    diasLaborables: esquemaDiasLaborables,
    horasPorDia: z
      .number({ error: 'Ingrese las horas por día.' })
      .positive('Las horas por día deben ser mayores que 0.')
      .max(24, 'Las horas por día no pueden superar 24.')
      .refine((v) => tieneMaximoDecimales(v, 2), 'Use como máximo 2 decimales.'),
  })
  .strict()
  .partial()
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar.',
    when: (carga) => carga.issues.length === 0,
  });

export type ActualizarCalendario = z.infer<typeof esquemaActualizarCalendario>;

export const esquemaCrearFeriado = z
  .object({
    fecha: esquemaFechaIso.refine(
      (fecha) => fecha >= '2000-01-01' && fecha <= '2100-12-31',
      'Ingrese una fecha entre los años 2000 y 2100.',
    ),
    descripcion: z
      .string({ error: 'Ingrese la descripción.' })
      .trim()
      .min(1, 'Ingrese la descripción.')
      .max(120, 'Use como máximo 120 caracteres.'),
  })
  .strict();

export type CrearFeriado = z.infer<typeof esquemaCrearFeriado>;
