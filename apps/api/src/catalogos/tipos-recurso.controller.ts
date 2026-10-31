import { Controller, Get } from '@nestjs/common';
import { type TipoRecursoResumen } from '@autofix/core';
import { TiposRecursoService } from './tipos-recurso.service';

@Controller('tipos-recurso')
export class TiposRecursoController {
  constructor(private readonly tiposRecurso: TiposRecursoService) {}

  @Get()
  listar(): Promise<TipoRecursoResumen[]> {
    return this.tiposRecurso.listar();
  }
}
