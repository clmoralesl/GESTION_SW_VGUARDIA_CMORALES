import { describe, expect, it } from 'vitest';
import {
  ALTO_FILA,
  bordesBarra,
  calcularRango,
  crearEscala,
  PX_POR_DIA,
  type NivelZoom,
} from './escala';

describe('escala', () => {
  it('calcularRango devuelve null si no hay fechas validas', () => {
    expect(calcularRango([])).toBeNull();
    expect(calcularRango([null, null])).toBeNull();
  });

  it('calcularRango agrega 3 dias antes y 7 dias despues', () => {
    const rango = calcularRango(['2026-11-02', '2026-12-10']);
    expect(rango).toEqual({
      inicio: '2026-10-30',
      fin: '2026-12-17',
    });
  });

  it('cumple la ida y vuelta fecha -> x -> fecha en los 3 zooms', () => {
    const rango = { inicio: '2026-10-27', fin: '2027-04-07' };
    const niveles: NivelZoom[] = ['DIA', 'SEMANA', 'MES'];

    for (const nivel of niveles) {
      const px = PX_POR_DIA[nivel];
      const escala = crearEscala(rango, px);

      const fechas = ['2026-10-27', '2026-11-02', '2026-11-23', '2026-12-10', '2027-03-31'];
      for (const fecha of fechas) {
        const x = escala.xDe(fecha);
        expect(escala.fechaDe(x)).toBe(fecha);
        expect(escala.fechaDe(x + px - 0.01)).toBe(fecha);
      }
    }
  });

  it('calcula bordesBarra para tarea normal y de duracion 0', () => {
    const escala = crearEscala({ inicio: '2026-11-01', fin: '2026-11-30' }, 32);

    const normal = bordesBarra(
      { inicioPlan: '2026-11-02', finPlan: '2026-11-04', duracionDias: 3 },
      escala,
    );
    expect(normal).toEqual({
      xInicio: 32,
      xFin: 32 + 3 * 32,
    });

    const hitoCero = bordesBarra(
      { inicioPlan: '2026-11-02', finPlan: '2026-11-02', duracionDias: 0 },
      escala,
    );
    expect(hitoCero).toEqual({
      xInicio: 64,
      xFin: 64,
    });
  });

  it('constantes ALTO_FILA y PX_POR_DIA tienen valores esperados', () => {
    expect(ALTO_FILA).toBe(32);
    expect(PX_POR_DIA).toEqual({ DIA: 32, SEMANA: 12, MES: 4 });
  });
});
