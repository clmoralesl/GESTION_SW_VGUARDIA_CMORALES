import { Controller, Get, Param, Query } from '@nestjs/common';
import { esquemaConsultaTablero, type ConsultaTablero, type TableroProyecto } from '@autofix/core';
import { Roles } from '../comun/roles/roles.decorator';
import { PipeIdRuta } from '../comun/validacion/id-ruta.pipe';
import { PipeValidacionZod } from '../comun/validacion/validacion-zod.pipe';
import { TableroService } from './tablero.service';

@Controller('proyectos')
export class TableroController {
  constructor(private readonly tableroService: TableroService) {}

  @Roles('JP', 'CC')
  @Get(':proyectoId/tablero')
  obtenerTablero(
    @Param('proyectoId', new PipeIdRuta('proyectoId')) proyectoId: number,
    @Query(new PipeValidacionZod(esquemaConsultaTablero)) consulta: ConsultaTablero,
  ): Promise<TableroProyecto> {
    return this.tableroService.obtenerTablero(proyectoId, consulta);
  }
}
