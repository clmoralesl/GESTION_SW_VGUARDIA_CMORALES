import { z } from './validacion';

const PATRON_FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

export function esFechaIsoValida(texto: string): boolean {
  if (!PATRON_FECHA_ISO.test(texto)) return false;
  const fecha = new Date(`${texto}T00:00:00.000Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().startsWith(texto);
}

export const esquemaFechaIso = z
  .string({ error: 'Ingrese una fecha.' })
  .refine(esFechaIsoValida, 'Ingrese una fecha válida con el formato AAAA-MM-DD.');

export function fechaIsoADate(texto: string): Date {
  return new Date(`${texto}T00:00:00.000Z`);
}

export function dateAFechaIso(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

export function fechaLocalIso(fecha: Date = new Date()): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

export function hoyEnZona(instante: Date = new Date(), zona = 'America/Santiago'): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instante);
}

const MILISEGUNDOS_DIA = 86_400_000;

export function sumarDiasCorridos(fechaIso: string, dias: number): string {
  const fecha = fechaIsoADate(fechaIso);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return dateAFechaIso(fecha);
}

export function diasCorridosEntre(inicioIso: string, finIso: string): number {
  return Math.round(
    (fechaIsoADate(finIso).getTime() - fechaIsoADate(inicioIso).getTime()) / MILISEGUNDOS_DIA,
  );
}

export function inicioDiaEnZona(fechaIso: string, zona = 'America/Santiago'): Date {
  let bajo = new Date(`${fechaIso}T00:00:00.000Z`).getTime() - 15 * 3600 * 1000;
  let alto = new Date(`${fechaIso}T00:00:00.000Z`).getTime() + 15 * 3600 * 1000;
  let res = alto;
  while (bajo <= alto) {
    const medio = Math.floor((bajo + alto) / 2);
    const fecha = hoyEnZona(new Date(medio), zona);
    if (fecha >= fechaIso) {
      res = medio;
      alto = medio - 1;
    } else {
      bajo = medio + 1;
    }
  }
  return new Date(res);
}

export function rangoFechasBitacora(
  desde?: string,
  hasta?: string,
  zona = 'America/Santiago',
): { gte?: Date; lt?: Date } {
  const resultado: { gte?: Date; lt?: Date } = {};
  if (desde) {
    resultado.gte = inicioDiaEnZona(desde, zona);
  }
  if (hasta) {
    const diaDespues = sumarDiasCorridos(hasta, 1);
    resultado.lt = inicioDiaEnZona(diaDespues, zona);
  }
  return resultado;
}
