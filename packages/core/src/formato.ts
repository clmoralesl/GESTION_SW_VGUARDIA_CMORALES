export const SIN_DATO = '—';

const PATRON_FECHA = /^(\d{4})-(\d{2})-(\d{2})/;

const FORMATO_CLP = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

const FORMATO_PORCENTAJE = new Intl.NumberFormat('es-CL', {
  maximumFractionDigits: 1,
});

const FORMATO_HORAS = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 });

const FORMATO_FECHA_HORA = new Intl.DateTimeFormat('es-CL', {
  timeZone: 'America/Santiago',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

type ValorFecha = string | Date | null | undefined;

function aTextoIso(valor: ValorFecha): string | null {
  if (valor === null || valor === undefined || valor === '') return null;
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor.toISOString();
  return valor;
}

export function formatearFecha(valor: ValorFecha): string {
  const iso = aTextoIso(valor);
  const partes = iso === null ? null : PATRON_FECHA.exec(iso);
  if (!partes) return SIN_DATO;
  return `${partes[3]}-${partes[2]}-${partes[1]}`;
}

export function formatearFechaHora(valor: ValorFecha): string {
  const iso = aTextoIso(valor);
  const fecha = iso === null ? null : new Date(iso);
  if (!fecha || Number.isNaN(fecha.getTime())) return SIN_DATO;
  const parte = (tipo: Intl.DateTimeFormatPartTypes) =>
    FORMATO_FECHA_HORA.formatToParts(fecha).find((p) => p.type === tipo)?.value ?? '';
  return `${parte('day')}-${parte('month')}-${parte('year')} ${parte('hour')}:${parte('minute')}`;
}

export function formatearMonto(valor: number | string | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') return SIN_DATO;
  const numero = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isFinite(numero)) return SIN_DATO;
  return FORMATO_CLP.format(Math.round(numero) || 0);
}

export function formatearPorcentaje(valor: number | string | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') return SIN_DATO;
  const numero = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isFinite(numero)) return SIN_DATO;
  return `${FORMATO_PORCENTAJE.format(numero)} %`;
}

export function formatearHoras(valor: number | string | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') return SIN_DATO;
  const numero = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isFinite(numero)) return SIN_DATO;
  return `${FORMATO_HORAS.format(numero)} h`;
}
