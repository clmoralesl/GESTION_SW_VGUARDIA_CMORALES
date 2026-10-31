import { HttpStatus, Injectable, PipeTransform } from '@nestjs/common';
import { ExcepcionApi } from '../errores/excepcion-api';

@Injectable()
export class PipeCuerpoObjeto implements PipeTransform<unknown, Record<string, unknown>> {
  transform(valor: unknown): Record<string, unknown> {
    if (!valor || typeof valor !== 'object' || Array.isArray(valor)) {
      throw new ExcepcionApi(
        HttpStatus.BAD_REQUEST,
        'VALIDACION_FALLIDA',
        'El cuerpo de la solicitud debe ser un objeto.',
      );
    }
    return valor as Record<string, unknown>;
  }
}
