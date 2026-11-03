import { Controller, Get, Query } from '@nestjs/common';
import {
  esquemaConsultaBitacora,
  type ConsultaBitacora,
  type RespuestaBitacora,
} from '@autofix/core';
import { Roles } from '../roles/roles.decorator';
import { PipeValidacionZod } from '../validacion/validacion-zod.pipe';
import { BitacoraLecturaService } from './bitacora-lectura.service';

@Controller('bitacora')
export class BitacoraController {
  constructor(private readonly bitacoraLectura: BitacoraLecturaService) {}

  @Roles('JP', 'CC')
  @Get()
  consultar(
    @Query(new PipeValidacionZod(esquemaConsultaBitacora)) consulta: ConsultaBitacora,
  ): Promise<RespuestaBitacora> {
    return this.bitacoraLectura.consultar(consulta);
  }
}
