import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  esquemaConsultaTableroCambio,
  type ConsultaTableroCambio,
  type TableroCambio,
} from '@autofix/core';
import { Roles } from '../comun/roles/roles.decorator';
import { PipeIdRuta } from '../comun/validacion/id-ruta.pipe';
import { PipeValidacionZod } from '../comun/validacion/validacion-zod.pipe';
import { TableroCambioService } from './tablero-cambio.service';

@Controller('proyectos')
export class TableroCambioController {
  constructor(private readonly tableroCambioService: TableroCambioService) {}

  @Roles('JP', 'CC')
  @Get(':proyectoId/tablero-cambio')
  obtenerTableroCambio(
    @Param('proyectoId', new PipeIdRuta('proyectoId')) proyectoId: number,
    @Query(new PipeValidacionZod(esquemaConsultaTableroCambio)) consulta: ConsultaTableroCambio,
  ): Promise<TableroCambio> {
    return this.tableroCambioService.obtenerTableroCambio(proyectoId, consulta);
  }
}
