import { HttpException, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CodigoError, CuerpoError } from '@autofix/core';
import { ExcepcionApi } from './excepcion-api';

export interface ErrorTraducido {
  estado: number;
  cuerpo: CuerpoError;
}

const TITULOS: Record<number, string> = {
  400: 'Solicitud inválida',
  403: 'Acceso denegado',
  404: 'No encontrado',
  409: 'Conflicto',
  413: 'Contenido demasiado grande',
  415: 'Tipo de medio no soportado',
  422: 'Operación no permitida',
  500: 'Error interno',
  503: 'Servicio no disponible',
};

const POR_ESTADO: Record<number, [CodigoError, string]> = {
  400: ['SOLICITUD_INVALIDA', 'La solicitud no es válida.'],
  403: ['ACCESO_DENEGADO', 'No tiene permiso para realizar esta acción.'],
  404: ['RECURSO_NO_ENCONTRADO', 'El recurso solicitado no existe.'],
  409: ['CONFLICTO', 'La operación entra en conflicto con el estado actual de los datos.'],
  413: ['CONTENIDO_DEMASIADO_GRANDE', 'El contenido enviado supera el tamaño permitido.'],
  415: ['TIPO_ARCHIVO_NO_PERMITIDO', 'El tipo de archivo no está permitido.'],
};

const SIN_CONEXION_BD = new Set(['P1001', 'P1002', 'P1017']);

function armar(
  estado: number,
  codigo: CodigoError,
  mensaje: string,
  detalles?: unknown,
): ErrorTraducido {
  const titulo = TITULOS[estado] ?? (estado >= 500 ? 'Error interno' : 'Solicitud inválida');
  return {
    estado,
    cuerpo:
      detalles === undefined
        ? { codigo, error: titulo, mensaje }
        : { codigo, error: titulo, mensaje, detalles },
  };
}

function traducirPrisma(error: Prisma.PrismaClientKnownRequestError): ErrorTraducido | null {
  if (error.code === 'P2002') {
    return armar(409, 'REGISTRO_DUPLICADO', 'Ya existe un registro con esos datos.', {
      campos: error.meta?.target ?? [],
    });
  }
  if (error.code === 'P2003') {
    return armar(
      409,
      'REGISTRO_RELACIONADO',
      'La operación afecta a registros relacionados que lo impiden.',
    );
  }
  if (error.code === 'P2025') {
    return armar(404, 'REGISTRO_NO_ENCONTRADO', 'El registro solicitado no existe.');
  }
  if (error.code === 'P2000' || error.code === 'P2004' || error.code === 'P2011') {
    return armar(400, 'RESTRICCION_VIOLADA', 'Los datos no cumplen una regla de integridad.');
  }
  if (error.code === 'P2034') {
    return armar(409, 'CONFLICTO', 'Otra operación modificó los mismos datos. Intente nuevamente.');
  }
  if (SIN_CONEXION_BD.has(error.code)) {
    return armar(
      503,
      'BD_NO_DISPONIBLE',
      'La base de datos no está disponible. Intente nuevamente.',
    );
  }
  return null;
}

export function traducirError(excepcion: unknown): ErrorTraducido {
  if (
    excepcion &&
    typeof excepcion === 'object' &&
    'name' in excepcion &&
    (excepcion as { name: string }).name === 'MulterError'
  ) {
    const errorMulter = excepcion as unknown as { code: string };
    if (errorMulter.code === 'LIMIT_FILE_SIZE') {
      return armar(
        413,
        'CONTENIDO_DEMASIADO_GRANDE',
        'El archivo supera el tamaño máximo permitido de 10 MB.',
      );
    }
  }
  if (excepcion instanceof ExcepcionApi) {
    return armar(excepcion.getStatus(), excepcion.codigo, excepcion.mensaje, excepcion.detalles);
  }
  if (excepcion instanceof Prisma.PrismaClientKnownRequestError) {
    const traducido = traducirPrisma(excepcion);
    if (traducido) return traducido;
  }
  if (
    excepcion instanceof Prisma.PrismaClientUnknownRequestError &&
    excepcion.message.includes('23514')
  ) {
    return armar(400, 'RESTRICCION_VIOLADA', 'Los datos no cumplen una regla de integridad.');
  }
  if (excepcion instanceof Prisma.PrismaClientInitializationError) {
    return armar(
      503,
      'BD_NO_DISPONIBLE',
      'La base de datos no está disponible. Intente nuevamente.',
    );
  }
  if (excepcion instanceof HttpException) {
    const estado = excepcion.getStatus();
    const [codigo, mensaje] = POR_ESTADO[estado] ?? [
      'SOLICITUD_INVALIDA',
      'La solicitud no es válida.',
    ];
    if (estado < HttpStatus.INTERNAL_SERVER_ERROR) return armar(estado, codigo, mensaje);
  }
  return armar(500, 'ERROR_INTERNO', 'Ocurrió un error inesperado. Intente nuevamente.');
}
