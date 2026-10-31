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
  esquemaActualizarProfesional,
  esquemaCrearProfesional,
  PERMISOS,
  type ActualizarProfesional,
  type CrearProfesional,
  type ProfesionalResumen,
  type Rol,
} from '@autofix/core';
import { RolActual } from '../comun/roles/rol-actual.decorator';
import { Roles } from '../comun/roles/roles.decorator';
import { PipeIdRuta } from '../comun/validacion/id-ruta.pipe';
import { PipeValidacionZod } from '../comun/validacion/validacion-zod.pipe';
import { ProfesionalesService } from './profesionales.service';

@Controller('profesionales')
export class ProfesionalesController {
  constructor(private readonly profesionales: ProfesionalesService) {}

  @Get()
  listar(): Promise<ProfesionalResumen[]> {
    return this.profesionales.listar();
  }

  @Get(':profesionalId')
  obtenerPorId(
    @Param('profesionalId', new PipeIdRuta('profesionalId')) id: number,
  ): Promise<ProfesionalResumen> {
    return this.profesionales.obtenerPorId(id);
  }

  @Roles(...PERMISOS.gestionarRecursos)
  @HttpCode(HttpStatus.CREATED)
  @Post()
  crear(
    @Body(new PipeValidacionZod(esquemaCrearProfesional))
    datos: CrearProfesional,
    @RolActual() rol: Rol,
  ): Promise<ProfesionalResumen> {
    return this.profesionales.crear(datos, rol);
  }

  @Roles(...PERMISOS.gestionarRecursos)
  @Patch(':profesionalId')
  actualizar(
    @Param('profesionalId', new PipeIdRuta('profesionalId')) id: number,
    @Body(new PipeValidacionZod(esquemaActualizarProfesional))
    datos: ActualizarProfesional,
    @RolActual() rol: Rol,
  ): Promise<ProfesionalResumen> {
    return this.profesionales.actualizar(id, datos, rol);
  }

  @Roles(...PERMISOS.gestionarRecursos)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':profesionalId')
  eliminar(
    @Param('profesionalId', new PipeIdRuta('profesionalId')) id: number,
    @RolActual() rol: Rol,
  ): Promise<void> {
    return this.profesionales.eliminar(id, rol);
  }
}
