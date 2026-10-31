import { Controller, Get, Param } from '@nestjs/common';
import type { LineaBaseVigente } from '@autofix/core';
import { PipeIdRuta } from '../comun/validacion/id-ruta.pipe';
import { LineasBaseService } from './lineas-base.service';

@Controller()
export class LineasBaseController {
  constructor(private readonly lineasBase: LineasBaseService) {}

  @Get('proyectos/:proyectoId/lineas-base/vigente')
  obtenerVigente(
    @Param('proyectoId', new PipeIdRuta('proyectoId')) proyectoId: number,
  ): Promise<LineaBaseVigente> {
    return this.lineasBase.obtenerVigente(proyectoId);
  }
}
