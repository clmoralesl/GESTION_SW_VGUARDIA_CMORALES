import { Injectable } from '@nestjs/common';
import type { LineaBaseVigente } from '@autofix/core';
import { PrismaService } from '../prisma/prisma.service';
import { errorProyectoNoEncontrado } from '../proyectos/proyecto-abierto';
import { mapearLineaBaseGantt } from './lineas-base.mapeo';

@Injectable()
export class LineasBaseService {
  constructor(private readonly prisma: PrismaService) {}

  async obtenerVigente(proyectoId: number): Promise<LineaBaseVigente> {
    const proyecto = await this.prisma.proyecto.findUnique({
      where: { id: proyectoId },
      select: { id: true },
    });
    if (!proyecto) throw errorProyectoNoEncontrado();

    const lineaBase = await this.prisma.lineaBase.findFirst({
      where: { proyectoId },
      orderBy: { version: 'desc' },
      include: {
        tareas: {
          orderBy: { codigo: 'asc' },
        },
      },
    });

    return {
      proyectoId,
      lineaBase: lineaBase ? mapearLineaBaseGantt(lineaBase) : null,
    };
  }
}
