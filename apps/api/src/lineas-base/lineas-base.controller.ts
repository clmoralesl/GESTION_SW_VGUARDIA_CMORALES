import { Controller, Get, HttpStatus, Param, Query } from '@nestjs/common';
import type {
  ComparacionLineasBase,
  LineaBaseGantt,
  LineaBaseVigente,
  RespuestaListaLineasBase,
} from '@autofix/core';
import { ExcepcionApi } from '../comun/errores/excepcion-api';
import { PipeIdRuta } from '../comun/validacion/id-ruta.pipe';
import { LineasBaseService } from './lineas-base.service';

@Controller()
export class LineasBaseController {
  constructor(private readonly lineasBase: LineasBaseService) {}

  @Get('proyectos/:proyectoId/lineas-base')
  listar(
    @Param('proyectoId', new PipeIdRuta('proyectoId')) proyectoId: number,
  ): Promise<RespuestaListaLineasBase> {
    return this.lineasBase.listar(proyectoId);
  }

  @Get('proyectos/:proyectoId/lineas-base/vigente')
  obtenerVigente(
    @Param('proyectoId', new PipeIdRuta('proyectoId')) proyectoId: number,
  ): Promise<LineaBaseVigente> {
    return this.lineasBase.obtenerVigente(proyectoId);
  }

  @Get('proyectos/:proyectoId/lineas-base/comparar')
  comparar(
    @Param('proyectoId', new PipeIdRuta('proyectoId')) proyectoId: number,
    @Query('a') versionA?: string,
    @Query('b') versionB?: string,
  ): Promise<ComparacionLineasBase> {
    if (!versionA || !versionB) {
      throw new ExcepcionApi(
        HttpStatus.BAD_REQUEST,
        'SOLICITUD_INVALIDA',
        'Debe indicar las versiones a comparar en los parámetros a y b.',
      );
    }
    const a = Number(versionA);
    const b = Number(versionB);
    return this.lineasBase.comparar(proyectoId, a, b);
  }

  @Get('proyectos/:proyectoId/lineas-base/:version')
  obtenerPorVersion(
    @Param('proyectoId', new PipeIdRuta('proyectoId')) proyectoId: number,
    @Param('version', new PipeIdRuta('version')) version: number,
  ): Promise<LineaBaseGantt> {
    return this.lineasBase.obtenerPorVersion(proyectoId, version);
  }
}
