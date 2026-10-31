import { Controller, Get, Param, Query } from '@nestjs/common';
import type { Alerta } from '@prisma/client';
import { PipeIdRuta } from '../comun/validacion/id-ruta.pipe';
import { AlertasService, type RespuestaCargaRecursos } from './alertas.service';

@Controller()
export class AlertasController {
  constructor(private readonly alertas: AlertasService) {}

  @Get('proyectos/:proyectoId/alertas')
  listarPorProyecto(
    @Param('proyectoId', new PipeIdRuta('proyectoId')) proyectoId: number,
    @Query('activas') activas?: string,
  ): Promise<Alerta[]> {
    const soloActivas = activas === undefined || activas === 'true';
    return this.alertas.listarPorProyecto(proyectoId, soloActivas);
  }

  @Get('carga-recursos')
  obtenerCargaRecursos(
    @Query('desde') desde: string,
    @Query('hasta') hasta: string,
  ): Promise<RespuestaCargaRecursos> {
    return this.alertas.obtenerCargaRecursos(desde, hasta);
  }
}
