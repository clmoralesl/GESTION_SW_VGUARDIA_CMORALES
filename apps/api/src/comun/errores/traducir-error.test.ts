import { HttpStatus, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { ExcepcionApi } from './excepcion-api';
import { traducirError } from './traducir-error';

describe('traducirError', () => {
  it('traduce ExcepcionApi conservando estado y codigo', () => {
    const excepcion = new ExcepcionApi(HttpStatus.BAD_REQUEST, 'ROL_REQUERIDO', 'Falta rol');
    const resultado = traducirError(excepcion);
    expect(resultado.estado).toBe(400);
    expect(resultado.cuerpo.codigo).toBe('ROL_REQUERIDO');
    expect(resultado.cuerpo.mensaje).toBe('Falta rol');
    expect(resultado.cuerpo.error).toBe('Solicitud inválida');
  });

  it('traduce ExcepcionApi 422 con titulo Operacion no permitida', () => {
    const excepcion = new ExcepcionApi(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'JERARQUIA_INVALIDA',
      'Jerarquia invalida',
    );
    const resultado = traducirError(excepcion);
    expect(resultado.estado).toBe(422);
    expect(resultado.cuerpo.codigo).toBe('JERARQUIA_INVALIDA');
    expect(resultado.cuerpo.error).toBe('Operación no permitida');
  });

  it('traduce Prisma P2002 a 409 REGISTRO_DUPLICADO con campos', () => {
    const errorPrisma = new Prisma.PrismaClientKnownRequestError('duplicado', {
      code: 'P2002',
      clientVersion: '6',
      meta: { target: ['codigo'] },
    });
    const resultado = traducirError(errorPrisma);
    expect(resultado.estado).toBe(409);
    expect(resultado.cuerpo.codigo).toBe('REGISTRO_DUPLICADO');
    expect(resultado.cuerpo.detalles).toEqual({ campos: ['codigo'] });
  });

  it('traduce Prisma P2003 a 409 REGISTRO_RELACIONADO', () => {
    const errorPrisma = new Prisma.PrismaClientKnownRequestError('relacionado', {
      code: 'P2003',
      clientVersion: '6',
    });
    const resultado = traducirError(errorPrisma);
    expect(resultado.estado).toBe(409);
    expect(resultado.cuerpo.codigo).toBe('REGISTRO_RELACIONADO');
  });

  it('traduce Prisma P2025 a 404 REGISTRO_NO_ENCONTRADO', () => {
    const errorPrisma = new Prisma.PrismaClientKnownRequestError('no existe', {
      code: 'P2025',
      clientVersion: '6',
    });
    const resultado = traducirError(errorPrisma);
    expect(resultado.estado).toBe(404);
    expect(resultado.cuerpo.codigo).toBe('REGISTRO_NO_ENCONTRADO');
  });

  it('traduce Prisma P2000, P2004 y P2011 a 400 RESTRICCION_VIOLADA', () => {
    for (const code of ['P2000', 'P2004', 'P2011'] as const) {
      const errorPrisma = new Prisma.PrismaClientKnownRequestError('restriccion', {
        code,
        clientVersion: '6',
      });
      const resultado = traducirError(errorPrisma);
      expect(resultado.estado).toBe(400);
      expect(resultado.cuerpo.codigo).toBe('RESTRICCION_VIOLADA');
    }
  });

  it('traduce Prisma P2034 a 409 CONFLICTO', () => {
    const errorPrisma = new Prisma.PrismaClientKnownRequestError('conflicto transaccion', {
      code: 'P2034',
      clientVersion: '6',
    });
    const resultado = traducirError(errorPrisma);
    expect(resultado.estado).toBe(409);
    expect(resultado.cuerpo.codigo).toBe('CONFLICTO');
    expect(resultado.cuerpo.mensaje).toBe(
      'Otra operación modificó los mismos datos. Intente nuevamente.',
    );
  });

  it('traduce PrismaClientUnknownRequestError con 23514 a 400 RESTRICCION_VIOLADA', () => {
    const errorPrisma = new Prisma.PrismaClientUnknownRequestError(
      'violates check constraint 23514',
      {
        clientVersion: '6',
      },
    );
    const resultado = traducirError(errorPrisma);
    expect(resultado.estado).toBe(400);
    expect(resultado.cuerpo.codigo).toBe('RESTRICCION_VIOLADA');
  });

  it('traduce errores de conexion de Prisma a 503 BD_NO_DISPONIBLE', () => {
    const errorConexion = new Prisma.PrismaClientKnownRequestError('sin conexion', {
      code: 'P1001',
      clientVersion: '6',
    });
    expect(traducirError(errorConexion).estado).toBe(503);
    expect(traducirError(errorConexion).cuerpo.codigo).toBe('BD_NO_DISPONIBLE');

    const errorInit = new Prisma.PrismaClientInitializationError('sin bd', '6');
    expect(traducirError(errorInit).estado).toBe(503);
    expect(traducirError(errorInit).cuerpo.codigo).toBe('BD_NO_DISPONIBLE');
  });

  it('traduce HttpException en ingles a textos en espanol', () => {
    const resultado = traducirError(new NotFoundException('Not found in english'));
    expect(resultado.estado).toBe(404);
    expect(resultado.cuerpo.codigo).toBe('RECURSO_NO_ENCONTRADO');
    expect(resultado.cuerpo.mensaje).toBe('El recurso solicitado no existe.');
  });

  it('traduce ExcepcionApi 415 con titulo Tipo de medio no soportado', () => {
    const excepcion = new ExcepcionApi(
      HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      'TIPO_ARCHIVO_NO_PERMITIDO',
      'El tipo de archivo no está permitido.',
    );
    const resultado = traducirError(excepcion);
    expect(resultado.estado).toBe(415);
    expect(resultado.cuerpo.codigo).toBe('TIPO_ARCHIVO_NO_PERMITIDO');
    expect(resultado.cuerpo.error).toBe('Tipo de medio no soportado');
  });

  it('traduce error inesperado a 500 ERROR_INTERNO', () => {
    const resultado = traducirError(new Error('Fallo no controlado'));
    expect(resultado.estado).toBe(500);
    expect(resultado.cuerpo.codigo).toBe('ERROR_INTERNO');
    expect(resultado.cuerpo.mensaje).toBe('Ocurrió un error inesperado. Intente nuevamente.');
  });
});
