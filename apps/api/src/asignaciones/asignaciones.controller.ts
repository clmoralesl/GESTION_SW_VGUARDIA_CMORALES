import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  esquemaCrearAsignacion,
  PERMISOS,
  type ActualizarAsignacion,
  type AsignacionResumen,
  type CrearAsignacion,
  type ResumenCostos,
  type Rol,
} from '@autofix/core';
import { RolActual } from '../comun/roles/rol-actual.decorator';
import { Roles } from '../comun/roles/roles.decorator';
import { PipeIdRuta } from '../comun/validacion/id-ruta.pipe';
import { PipeCuerpoObjeto } from '../comun/validacion/cuerpo-objeto.pipe';
import { PipeValidacionZod } from '../comun/validacion/validacion-zod.pipe';
import { AsignacionesService, type RespuestaMutacionAsignacion } from './asignaciones.service';

@Controller()
export class AsignacionesController {
  constructor(private readonly asignaciones: AsignacionesService) {}

  @Get('tareas/:tareaId/asignaciones')
  listarPorTarea(
    @Param('tareaId', new PipeIdRuta('tareaId')) tareaId: number,
  ): Promise<AsignacionResumen[]> {
    return this.asignaciones.listarPorTarea(tareaId);
  }

  @Get('proyectos/:proyectoId/costos')
  obtenerCostos(
    @Param('proyectoId', new PipeIdRuta('proyectoId')) proyectoId: number,
  ): Promise<ResumenCostos> {
    return this.asignaciones.obtenerCostos(proyectoId);
  }

  @Roles(...PERMISOS.editarPlanificacion)
  @HttpCode(HttpStatus.CREATED)
  @Post('tareas/:tareaId/asignaciones')
  crear(
    @Param('tareaId', new PipeIdRuta('tareaId')) tareaId: number,
    @Body(new PipeValidacionZod(esquemaCrearAsignacion)) datos: CrearAsignacion,
    @RolActual() rol: Rol,
  ): Promise<RespuestaMutacionAsignacion> {
    return this.asignaciones.crear(tareaId, datos, rol);
  }

  @Roles(...PERMISOS.editarPlanificacion)
  @Patch('asignaciones/:asignacionId')
  actualizar(
    @Param('asignacionId', new PipeIdRuta('asignacionId')) asignacionId: number,
    @Body(new PipeCuerpoObjeto()) datos: ActualizarAsignacion,
    @RolActual() rol: Rol,
  ): Promise<RespuestaMutacionAsignacion> {
    return this.asignaciones.actualizar(asignacionId, datos, rol);
  }

  @Roles(...PERMISOS.editarPlanificacion)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('asignaciones/:asignacionId')
  eliminar(
    @Param('asignacionId', new PipeIdRuta('asignacionId')) asignacionId: number,
    @RolActual() rol: Rol,
  ): Promise<void> {
    return this.asignaciones.eliminar(asignacionId, rol);
  }
}
