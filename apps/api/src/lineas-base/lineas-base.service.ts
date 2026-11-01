import { HttpStatus, Injectable } from '@nestjs/common';
import {
  calcularVersionGantt,
  dateAFechaIso,
  resumirComparacion,
  type ComparacionLineasBase,
  type FilaLineaBaseComparador,
  type LineaBaseGantt,
  type LineaBaseResumen,
  type LineaBaseVigente,
  type RespuestaListaLineasBase,
  type ResumenVersionComparacion,
} from '@autofix/core';
import { ExcepcionApi } from '../comun/errores/excepcion-api';
import { PrismaService } from '../prisma/prisma.service';
import { errorProyectoNoEncontrado } from '../proyectos/proyecto-abierto';
import { mapearLineaBaseGantt } from './lineas-base.mapeo';

@Injectable()
export class LineasBaseService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(proyectoId: number): Promise<RespuestaListaLineasBase> {
    const proyecto = await this.prisma.proyecto.findUnique({
      where: { id: proyectoId },
      select: { id: true },
    });
    if (!proyecto) throw errorProyectoNoEncontrado();

    const lineas = await this.prisma.lineaBase.findMany({
      where: { proyectoId },
      orderBy: { version: 'desc' },
      include: {
        solicitudCambio: {
          select: { codigo: true },
        },
      },
    });

    const versiones: LineaBaseResumen[] = lineas.map((l) => ({
      id: l.id,
      version: l.version,
      descripcion: l.descripcion,
      solicitudCambioId: l.solicitudCambioId,
      solicitudCodigo: l.solicitudCambio?.codigo ?? null,
      fechaFinProyecto: l.fechaFinProyecto ? dateAFechaIso(l.fechaFinProyecto) : null,
      costoPlanTotal: Number(l.costoPlanTotal),
      creadoEn: l.creadoEn.toISOString(),
    }));

    const versionGantt = calcularVersionGantt(lineas);
    return { versiones, versionGantt };
  }

  async obtenerPorVersion(proyectoId: number, version: number): Promise<LineaBaseGantt> {
    const proyecto = await this.prisma.proyecto.findUnique({
      where: { id: proyectoId },
      select: { id: true },
    });
    if (!proyecto) throw errorProyectoNoEncontrado();

    const lineaBase = await this.prisma.lineaBase.findUnique({
      where: {
        proyectoId_version: {
          proyectoId,
          version,
        },
      },
      include: {
        tareas: {
          orderBy: { codigo: 'asc' },
        },
      },
    });

    if (!lineaBase) {
      throw new ExcepcionApi(
        HttpStatus.NOT_FOUND,
        'RECURSO_NO_ENCONTRADO',
        `No se encontró la línea base versión ${version} para el proyecto.`,
      );
    }

    return mapearLineaBaseGantt(lineaBase);
  }

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

  async comparar(
    proyectoId: number,
    versionA: number,
    versionB: number,
  ): Promise<ComparacionLineasBase> {
    if (
      !Number.isInteger(versionA) ||
      versionA <= 0 ||
      !Number.isInteger(versionB) ||
      versionB <= 0
    ) {
      throw new ExcepcionApi(
        HttpStatus.BAD_REQUEST,
        'SOLICITUD_INVALIDA',
        'Las versiones a comparar deben ser números enteros positivos.',
      );
    }

    if (versionA === versionB) {
      throw new ExcepcionApi(
        HttpStatus.BAD_REQUEST,
        'SOLICITUD_INVALIDA',
        'No se puede comparar una versión de línea base consigo misma.',
      );
    }

    const proyecto = await this.prisma.proyecto.findUnique({
      where: { id: proyectoId },
      select: { id: true },
    });
    if (!proyecto) throw errorProyectoNoEncontrado();

    const [lbA, lbB] = await Promise.all([
      this.prisma.lineaBase.findUnique({
        where: { proyectoId_version: { proyectoId, version: versionA } },
        include: { tareas: { orderBy: { codigo: 'asc' } } },
      }),
      this.prisma.lineaBase.findUnique({
        where: { proyectoId_version: { proyectoId, version: versionB } },
        include: { tareas: { orderBy: { codigo: 'asc' } } },
      }),
    ]);

    if (!lbA) {
      throw new ExcepcionApi(
        HttpStatus.NOT_FOUND,
        'RECURSO_NO_ENCONTRADO',
        `No se encontró la línea base versión ${versionA}.`,
      );
    }

    if (!lbB) {
      throw new ExcepcionApi(
        HttpStatus.NOT_FOUND,
        'RECURSO_NO_ENCONTRADO',
        `No se encontró la línea base versión ${versionB}.`,
      );
    }

    const resA: ResumenVersionComparacion = {
      version: lbA.version,
      descripcion: lbA.descripcion,
      fechaFinProyecto: lbA.fechaFinProyecto ? dateAFechaIso(lbA.fechaFinProyecto) : null,
      costoPlanTotal: Number(lbA.costoPlanTotal),
      creadoEn: lbA.creadoEn.toISOString(),
    };

    const resB: ResumenVersionComparacion = {
      version: lbB.version,
      descripcion: lbB.descripcion,
      fechaFinProyecto: lbB.fechaFinProyecto ? dateAFechaIso(lbB.fechaFinProyecto) : null,
      costoPlanTotal: Number(lbB.costoPlanTotal),
      creadoEn: lbB.creadoEn.toISOString(),
    };

    const filasA: FilaLineaBaseComparador[] = lbA.tareas.map((t) => ({
      tareaId: t.tareaId,
      codigo: t.codigo,
      nombre: t.nombre,
      nivel: t.nivel,
      duracionDias: t.duracionDias,
      inicioPlan: t.inicioPlan ? dateAFechaIso(t.inicioPlan) : null,
      finPlan: t.finPlan ? dateAFechaIso(t.finPlan) : null,
      costoPlan: Number(t.costoPlan),
    }));

    const filasB: FilaLineaBaseComparador[] = lbB.tareas.map((t) => ({
      tareaId: t.tareaId,
      codigo: t.codigo,
      nombre: t.nombre,
      nivel: t.nivel,
      duracionDias: t.duracionDias,
      inicioPlan: t.inicioPlan ? dateAFechaIso(t.inicioPlan) : null,
      finPlan: t.finPlan ? dateAFechaIso(t.finPlan) : null,
      costoPlan: Number(t.costoPlan),
    }));

    return resumirComparacion(resA, resB, filasA, filasB);
  }
}
