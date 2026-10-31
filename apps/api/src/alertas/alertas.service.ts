import { HttpStatus, Injectable } from '@nestjs/common';
import { type Alerta, EstadoProyecto, Prisma } from '@prisma/client';
import {
  CALENDARIO_POR_DEFECTO,
  calcularCargaDiaria,
  cargaSemanal,
  dateAFechaIso,
  esHabil,
  esquemaConsultaCargaRecursos,
  validar,
  type AsignacionCarga,
  type CalendarioLaboral,
  type CeldaCarga,
  type TareaCarga,
} from '@autofix/core';
import { cargarCalendarioLaboral } from '../calendario/calendario-laboral';
import { ExcepcionApi } from '../comun/errores/excepcion-api';
import { PrismaService } from '../prisma/prisma.service';

const errorProyectoNoExiste = () =>
  new ExcepcionApi(HttpStatus.NOT_FOUND, 'REGISTRO_NO_ENCONTRADO', 'El proyecto no existe.');

export interface ProfesionalCargaRecursos {
  id: number;
  nombre: string;
  activo: boolean;
  celdas: CeldaCarga[];
}

export interface RespuestaCargaRecursos {
  semanas: string[];
  profesionales: ProfesionalCargaRecursos[];
}

@Injectable()
export class AlertasService {
  constructor(private readonly prisma: PrismaService) {}

  async listarPorProyecto(proyectoId: number, soloActivas: boolean = true): Promise<Alerta[]> {
    const proyecto = await this.prisma.proyecto.findUnique({ where: { id: proyectoId } });
    if (!proyecto) throw errorProyectoNoExiste();

    const where: Prisma.AlertaWhereInput = { proyectoId };
    if (soloActivas) {
      where.activa = true;
    }

    return this.prisma.alerta.findMany({
      where,
      orderBy: [{ activa: 'desc' }, { creadaEn: 'desc' }],
    });
  }

  async obtenerCargaRecursos(desde: string, hasta: string): Promise<RespuestaCargaRecursos> {
    const validacion = validar(esquemaConsultaCargaRecursos, { desde, hasta });
    if (!validacion.ok) {
      throw new ExcepcionApi(
        HttpStatus.BAD_REQUEST,
        'VALIDACION_FALLIDA',
        'Los parámetros de consulta no son válidos.',
        validacion.detalles,
      );
    }

    const profesionales = await this.prisma.profesional.findMany({
      orderBy: { nombre: 'asc' },
    });

    const asignaciones = await this.prisma.asignacion.findMany({
      where: {
        profesionalId: { not: null },
        tarea: {
          inicioPlan: { not: null },
          finPlan: { not: null },
          porcentajeAvance: { lt: 100 },
          proyecto: { estado: { not: EstadoProyecto.CERRADO } },
          hijas: { none: {} },
        },
      },
      include: {
        tarea: {
          select: {
            id: true,
            codigo: true,
            proyectoId: true,
            inicioPlan: true,
            finPlan: true,
            porcentajeAvance: true,
          },
        },
      },
    });

    const proyectoIds = [...new Set(asignaciones.map((a) => a.tarea.proyectoId))];
    const calendarios = new Map<number, CalendarioLaboral>();
    for (const pId of proyectoIds) {
      calendarios.set(pId, await cargarCalendarioLaboral(this.prisma, pId));
    }

    const tareasMap = new Map<number, TareaCarga>();
    for (const a of asignaciones) {
      if (!tareasMap.has(a.tarea.id)) {
        const cal = calendarios.get(a.tarea.proyectoId) ?? CALENDARIO_POR_DEFECTO;
        tareasMap.set(a.tarea.id, {
          id: a.tarea.id,
          codigo: a.tarea.codigo,
          proyectoId: a.tarea.proyectoId,
          inicioPlan: a.tarea.inicioPlan ? dateAFechaIso(a.tarea.inicioPlan) : null,
          finPlan: a.tarea.finPlan ? dateAFechaIso(a.tarea.finPlan) : null,
          porcentajeAvance: Number(a.tarea.porcentajeAvance),
          esHabil: (fechaIso: string) => esHabil(fechaIso, cal),
        });
      }
    }

    const asignacionesCarga: AsignacionCarga[] = asignaciones.map((a) => ({
      profesionalId: a.profesionalId!,
      tareaId: a.tareaId,
      dedicacion: a.dedicacion ? Number(a.dedicacion) : 0,
    }));

    const carga = calcularCargaDiaria(asignacionesCarga, [...tareasMap.values()]);

    const resultadoProfesionales = profesionales.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      activo: p.activo,
      celdas: cargaSemanal(carga, p.id, desde, hasta, (fechaIso) =>
        esHabil(fechaIso, CALENDARIO_POR_DEFECTO),
      ),
    }));

    const semanas = resultadoProfesionales[0]?.celdas.map((c) => c.semana) ?? [];

    return {
      semanas,
      profesionales: resultadoProfesionales,
    };
  }
}
