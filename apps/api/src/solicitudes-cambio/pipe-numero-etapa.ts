import { HttpStatus, Injectable, PipeTransform } from '@nestjs/common';
import { ExcepcionApi } from '../comun/errores/excepcion-api';

@Injectable()
export class PipeNumeroEtapa implements PipeTransform<string, number> {
  transform(valor: string): number {
    const numero = Number(valor);
    if (Number.isInteger(numero) && numero >= 1 && numero <= 10) {
      return numero;
    }
    throw new ExcepcionApi(
      HttpStatus.BAD_REQUEST,
      'VALIDACION_FALLIDA',
      'El número de etapa debe ser un número entero entre 1 y 10.',
      [{ campo: 'numero', mensaje: 'Debe estar entre 1 y 10.' }],
    );
  }
}
