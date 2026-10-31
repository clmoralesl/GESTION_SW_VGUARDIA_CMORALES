import { Injectable } from '@nestjs/common';
import { esFechaIsoValida, hoyEnZona } from '@autofix/core';

@Injectable()
export class Reloj {
  constructor() {
    const corte = process.env.FECHA_CORTE;
    if (corte !== undefined && corte.trim() !== '' && !esFechaIsoValida(corte.trim())) {
      throw new Error(
        `La variable de entorno FECHA_CORTE="${corte}" no es una fecha ISO válida (AAAA-MM-DD).`,
      );
    }
  }

  hoy(): string {
    const corte = process.env.FECHA_CORTE;
    if (corte !== undefined && corte.trim() !== '') {
      const fecha = corte.trim();
      if (!esFechaIsoValida(fecha)) {
        throw new Error(
          `La variable de entorno FECHA_CORTE="${corte}" no es una fecha ISO válida (AAAA-MM-DD).`,
        );
      }
      return fecha;
    }
    return hoyEnZona();
  }
}
