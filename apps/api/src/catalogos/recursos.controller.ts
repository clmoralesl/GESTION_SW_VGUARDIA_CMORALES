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
  esquemaActualizarRecurso,
  esquemaCrearRecurso,
  PERMISOS,
  type ActualizarRecurso,
  type CrearRecurso,
  type RecursoResumen,
  type Rol,
} from '@autofix/core';
import { RolActual } from '../comun/roles/rol-actual.decorator';
import { Roles } from '../comun/roles/roles.decorator';
import { PipeIdRuta } from '../comun/validacion/id-ruta.pipe';
import { PipeValidacionZod } from '../comun/validacion/validacion-zod.pipe';
import { RecursosService } from './recursos.service';

@Controller('recursos')
export class RecursosController {
  constructor(private readonly recursos: RecursosService) {}

  @Get()
  listar(): Promise<RecursoResumen[]> {
    return this.recursos.listar();
  }

  @Get(':recursoId')
  obtenerPorId(
    @Param('recursoId', new PipeIdRuta('recursoId')) id: number,
  ): Promise<RecursoResumen> {
    return this.recursos.obtenerPorId(id);
  }

  @Roles(...PERMISOS.gestionarRecursos)
  @HttpCode(HttpStatus.CREATED)
  @Post()
  crear(
    @Body(new PipeValidacionZod(esquemaCrearRecurso)) datos: CrearRecurso,
    @RolActual() rol: Rol,
  ): Promise<RecursoResumen> {
    return this.recursos.crear(datos, rol);
  }

  @Roles(...PERMISOS.gestionarRecursos)
  @Patch(':recursoId')
  actualizar(
    @Param('recursoId', new PipeIdRuta('recursoId')) id: number,
    @Body(new PipeValidacionZod(esquemaActualizarRecurso))
    datos: ActualizarRecurso,
    @RolActual() rol: Rol,
  ): Promise<RecursoResumen> {
    return this.recursos.actualizar(id, datos, rol);
  }

  @Roles(...PERMISOS.gestionarRecursos)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':recursoId')
  eliminar(
    @Param('recursoId', new PipeIdRuta('recursoId')) id: number,
    @RolActual() rol: Rol,
  ): Promise<void> {
    return this.recursos.eliminar(id, rol);
  }
}
