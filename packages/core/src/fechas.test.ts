process.env.TZ = 'America/Santiago';

import { describe, expect, it } from 'vitest';
import {
  dateAFechaIso,
  diasCorridosEntre,
  esFechaIsoValida,
  esquemaFechaIso,
  fechaIsoADate,
  fechaLocalIso,
  hoyEnZona,
  inicioDiaEnZona,
  rangoFechasBitacora,
  sumarDiasCorridos,
} from './fechas';
import { validar } from './validacion';

describe('fechas', () => {
  it('valida fechas en formato ISO AAAA-MM-DD incluyendo anio bisiesto', () => {
    expect(esFechaIsoValida('2026-11-02')).toBe(true);
    expect(esFechaIsoValida('2028-02-29')).toBe(true);
    expect(esFechaIsoValida('2026-02-29')).toBe(false);
    expect(esFechaIsoValida('2026-02-30')).toBe(false);
    expect(esFechaIsoValida('2026-13-01')).toBe(false);
    expect(esFechaIsoValida('30-02-2026')).toBe(false);
    expect(esFechaIsoValida('2026-1-1')).toBe(false);
    expect(esFechaIsoValida('')).toBe(false);
  });

  it('valida con esquemaFechaIso', () => {
    const ok = validar(esquemaFechaIso, '2026-11-02');
    expect(ok.ok).toBe(true);

    const errorFormato = validar(esquemaFechaIso, '2026-02-30');
    expect(errorFormato.ok).toBe(false);
    if (!errorFormato.ok) {
      expect(errorFormato.detalles[0].mensaje).toBe(
        'Ingrese una fecha válida con el formato AAAA-MM-DD.',
      );
    }
  });

  it('convierte entre fecha ISO y Date en UTC', () => {
    const fecha = fechaIsoADate('2026-11-02');
    expect(fecha.toISOString()).toBe('2026-11-02T00:00:00.000Z');
    expect(dateAFechaIso(fecha)).toBe('2026-11-02');
  });

  it('obtiene fecha local sin verse afectada por desfase UTC', () => {
    const fechaNoche = new Date(2026, 9, 29, 22, 0, 0);
    expect(fechaLocalIso(fechaNoche)).toBe('2026-10-29');
    expect(fechaNoche.toISOString().startsWith('2026-10-30')).toBe(true);
  });

  it('suma dias corridos y calcula dias entre fechas en UTC', () => {
    expect(sumarDiasCorridos('2026-11-02', 0)).toBe('2026-11-02');
    expect(sumarDiasCorridos('2026-11-02', 3)).toBe('2026-11-05');
    expect(sumarDiasCorridos('2026-11-02', -2)).toBe('2026-10-31');
    expect(diasCorridosEntre('2026-11-02', '2026-11-05')).toBe(3);
    expect(diasCorridosEntre('2026-11-02', '2026-11-02')).toBe(0);
    expect(diasCorridosEntre('2026-11-05', '2026-11-02')).toBe(-3);
  });

  it('obtiene fecha actual en zona horaria especificada', () => {
    expect(hoyEnZona(new Date('2026-10-31T02:59:00Z'))).toBe('2026-10-30');
    expect(hoyEnZona(new Date('2026-10-31T03:00:00Z'))).toBe('2026-10-31');
    expect(hoyEnZona(new Date('2026-07-01T03:59:00Z'))).toBe('2026-06-30');
    expect(hoyEnZona(new Date('2026-07-01T04:00:00Z'))).toBe('2026-07-01');
  });

  it('calcula inicio del dia en zona horaria considerando cambios de horario de verano e invierno', () => {
    const d1 = inicioDiaEnZona('2026-04-04');
    expect(d1.toISOString()).toBe('2026-04-04T03:00:00.000Z');
    expect(hoyEnZona(d1)).toBe('2026-04-04');
    expect(hoyEnZona(new Date(d1.getTime() - 1))).toBe('2026-04-03');

    const d2 = inicioDiaEnZona('2026-04-05');
    expect(d2.toISOString()).toBe('2026-04-05T04:00:00.000Z');
    expect(hoyEnZona(d2)).toBe('2026-04-05');
    expect(hoyEnZona(new Date(d2.getTime() - 1))).toBe('2026-04-04');

    const d3 = inicioDiaEnZona('2026-07-15');
    expect(d3.toISOString()).toBe('2026-07-15T04:00:00.000Z');
    expect(hoyEnZona(d3)).toBe('2026-07-15');
    expect(hoyEnZona(new Date(d3.getTime() - 1))).toBe('2026-07-14');

    const d4 = inicioDiaEnZona('2026-09-05');
    expect(d4.toISOString()).toBe('2026-09-05T04:00:00.000Z');
    expect(hoyEnZona(d4)).toBe('2026-09-05');
    expect(hoyEnZona(new Date(d4.getTime() - 1))).toBe('2026-09-04');

    const d5 = inicioDiaEnZona('2026-09-06');
    expect(d5.toISOString()).toBe('2026-09-06T04:00:00.000Z');
    expect(hoyEnZona(d5)).toBe('2026-09-06');
    expect(hoyEnZona(new Date(d5.getTime() - 1))).toBe('2026-09-05');

    const d6 = inicioDiaEnZona('2026-11-02');
    expect(d6.toISOString()).toBe('2026-11-02T03:00:00.000Z');
    expect(hoyEnZona(d6)).toBe('2026-11-02');
    expect(hoyEnZona(new Date(d6.getTime() - 1))).toBe('2026-11-01');
  });

  it('construye rango de fechas para bitacora con limites inclusivos de dia', () => {
    const rangoCompleto = rangoFechasBitacora('2026-11-02', '2026-11-02');
    expect(rangoCompleto.gte?.toISOString()).toBe('2026-11-02T03:00:00.000Z');
    expect(rangoCompleto.lt?.toISOString()).toBe('2026-11-03T03:00:00.000Z');

    const soloDesde = rangoFechasBitacora('2026-11-02');
    expect(soloDesde.gte?.toISOString()).toBe('2026-11-02T03:00:00.000Z');
    expect(soloDesde.lt).toBeUndefined();

    const soloHasta = rangoFechasBitacora(undefined, '2026-11-02');
    expect(soloHasta.gte).toBeUndefined();
    expect(soloHasta.lt?.toISOString()).toBe('2026-11-03T03:00:00.000Z');

    const sinFiltro = rangoFechasBitacora();
    expect(sinFiltro.gte).toBeUndefined();
    expect(sinFiltro.lt).toBeUndefined();
  });
});
