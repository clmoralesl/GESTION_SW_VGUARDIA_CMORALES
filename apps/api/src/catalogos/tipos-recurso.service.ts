import { Injectable } from '@nestjs/common';
import { TIPOS_RECURSO, type TipoRecursoResumen } from '@autofix/core';
import { PrismaService } from '../prisma/prisma.service';
import { mapearTipoRecurso } from './catalogos.mapeo';

@Injectable()
export class TiposRecursoService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(): Promise<TipoRecursoResumen[]> {
    const tipos = await this.prisma.tipoRecurso.findMany();
    const ordenNombres = TIPOS_RECURSO.map((t) => t.nombre as string);
    const ordenados = [...tipos].sort((a, b) => {
      const indiceA = ordenNombres.indexOf(a.nombre);
      const indiceB = ordenNombres.indexOf(b.nombre);
      if (indiceA !== -1 && indiceB !== -1) return indiceA - indiceB;
      return a.id - b.id;
    });
    return ordenados.map(mapearTipoRecurso);
  }
}
