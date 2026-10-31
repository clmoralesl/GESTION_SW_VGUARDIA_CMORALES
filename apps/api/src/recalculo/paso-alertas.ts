import { Injectable } from '@nestjs/common';
import { EstadoProyecto, Prisma, SeveridadAlerta, TipoAlerta } from '@prisma/client';
import {
  claveSobreasignacion,
  dateAFechaIso,
  detectarSobreasignaciones,
  esHabil,
  type AsignacionCarga,
  type CalendarioLaboral,
  type ConflictoSobreasignacion,
  type TareaCarga,
} from '@autofix/core';
import { cargarCalendarioLaboral } from '../calendario/calendario-laboral';
import type { ContextoRecalculo, PasoRecalculo } from './recalculo.tipos';

function formatearFechaChilena(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
}

@Injectable()
export class PasoAlertas implements PasoRecalculo {
  readonly nombre = 'alertas';

  async ejecutar(contexto: ContextoRecalculo): Promise<void> {
    const proyectoId = contexto.proyecto.id;

    await contexto.tx.$executeRaw`SELECT pg_advisory_xact_lock(1301)`;

    const asignacionesProyecto = await contexto.tx.asignacion.findMany({
      where: {
        tareaId: { in: contexto.tareas.map((t) => t.id) },
        profesionalId: { not: null },
      },
      select: { profesionalId: true },
    });

    const alertasPrevias = await contexto.tx.alerta.findMany({
      where: { proyectoId, tipo: TipoAlerta.SOBREASIGNACION, activa: true },
      select: { entidadId: true },
    });

    const profesionalIds = [
      ...new Set(
        [
          ...asignacionesProyecto.map((a) => a.profesionalId),
          ...alertasPrevias.map((a) => a.entidadId),
        ].filter((id): id is number => id !== null),
      ),
    ];

    let conflictos: ConflictoSobreasignacion[] = [];
    const mapaProfesionales = new Map<number, string>();
    const mapaTareasInfo = new Map<
      number,
      { id: number; codigo: string; nombre: string; proyectoId: number }
    >();

    const proyectosAfectados = new Set<number>([proyectoId]);

    if (profesionalIds.length > 0) {
      const asignacionesActivas = await contexto.tx.asignacion.findMany({
        where: {
          profesionalId: { in: profesionalIds },
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
              nombre: true,
              proyectoId: true,
              inicioPlan: true,
              finPlan: true,
              porcentajeAvance: true,
            },
          },
          profesional: { select: { id: true, nombre: true } },
        },
      });

      for (const asig of asignacionesActivas) {
        if (asig.profesional) {
          mapaProfesionales.set(asig.profesional.id, asig.profesional.nombre);
        }
        mapaTareasInfo.set(asig.tarea.id, {
          id: asig.tarea.id,
          codigo: asig.tarea.codigo,
          nombre: asig.tarea.nombre,
          proyectoId: asig.tarea.proyectoId,
        });
        proyectosAfectados.add(asig.tarea.proyectoId);
      }

      const alertasRelacionadas = await contexto.tx.alerta.findMany({
        where: {
          tipo: TipoAlerta.SOBREASIGNACION,
          activa: true,
          entidadId: { in: profesionalIds },
          proyecto: { estado: { not: EstadoProyecto.CERRADO } },
        },
        select: { proyectoId: true },
      });
      for (const a of alertasRelacionadas) proyectosAfectados.add(a.proyectoId);

      const calendarios = new Map<number, CalendarioLaboral>();
      for (const pId of proyectosAfectados) {
        calendarios.set(
          pId,
          pId === proyectoId
            ? contexto.calendario
            : await cargarCalendarioLaboral(contexto.tx, pId),
        );
      }

      const tareasMap = new Map<number, TareaCarga>();
      for (const asig of asignacionesActivas) {
        if (!tareasMap.has(asig.tarea.id)) {
          const cal = calendarios.get(asig.tarea.proyectoId) ?? contexto.calendario;
          tareasMap.set(asig.tarea.id, {
            id: asig.tarea.id,
            codigo: asig.tarea.codigo,
            proyectoId: asig.tarea.proyectoId,
            inicioPlan: asig.tarea.inicioPlan ? dateAFechaIso(asig.tarea.inicioPlan) : null,
            finPlan: asig.tarea.finPlan ? dateAFechaIso(asig.tarea.finPlan) : null,
            porcentajeAvance: Number(asig.tarea.porcentajeAvance),
            esHabil: (fechaIso: string) => esHabil(fechaIso, cal),
          });
        }
      }

      const asignacionesCarga: AsignacionCarga[] = asignacionesActivas.map((a) => ({
        profesionalId: a.profesionalId!,
        tareaId: a.tareaId,
        dedicacion: a.dedicacion ? Number(a.dedicacion) : 0,
      }));

      conflictos = detectarSobreasignaciones(asignacionesCarga, [...tareasMap.values()]);
    }

    for (const pId of proyectosAfectados) {
      const alertasActivasDb = await contexto.tx.alerta.findMany({
        where: {
          proyectoId: pId,
          tipo: TipoAlerta.SOBREASIGNACION,
          activa: true,
          entidadId: { in: profesionalIds },
        },
      });

      const conflictosParaProyecto = conflictos.filter((c) => c.proyectoIds.includes(pId));
      const clavesDetectadas = new Set<string>();

      for (const c of conflictosParaProyecto) {
        const clave = claveSobreasignacion(c);
        clavesDetectadas.add(clave);

        const nombreProf =
          mapaProfesionales.get(c.profesionalId) ?? `Profesional ${c.profesionalId}`;
        const desdeFmt = formatearFechaChilena(c.desde);
        const hastaFmt = formatearFechaChilena(c.hasta);
        const maximoFmt = Math.round(c.dedicacionMaxima);
        const mensaje = `Sobreasignación de ${nombreProf} entre el ${desdeFmt} y el ${hastaFmt} (máx. ${maximoFmt} %).`;

        const tareasDetalle = c.tareaIds
          .map((id) => mapaTareasInfo.get(id))
          .filter((t): t is NonNullable<typeof t> => t !== undefined);

        const detalle = {
          profesional: { id: c.profesionalId, nombre: nombreProf },
          desde: c.desde,
          hasta: c.hasta,
          dedicacionMaxima: c.dedicacionMaxima,
          tareas: tareasDetalle,
        };

        const existente = alertasActivasDb.find((a) => a.clave === clave);
        if (existente) {
          await contexto.tx.alerta.update({
            where: { id: existente.id },
            data: { mensaje, detalle },
          });
        } else {
          await contexto.tx.alerta.create({
            data: {
              proyectoId: pId,
              tipo: TipoAlerta.SOBREASIGNACION,
              severidad: SeveridadAlerta.ADVERTENCIA,
              clave,
              mensaje,
              detalle,
              entidad: 'Profesional',
              entidadId: c.profesionalId,
              activa: true,
            },
          });
        }
      }

      for (const a of alertasActivasDb) {
        if (!clavesDetectadas.has(a.clave)) {
          await contexto.tx.alerta.update({
            where: { id: a.id },
            data: { activa: false, cerradaEn: new Date() },
          });
        }
      }
    }

    const clavePresupuesto = `PRESUPUESTO:${proyectoId}`;
    const excedePresupuesto = contexto.costos?.excedePresupuesto ?? false;

    const alertaPresupuestoActiva = await contexto.tx.alerta.findFirst({
      where: {
        proyectoId,
        clave: clavePresupuesto,
        activa: true,
      },
    });

    if (excedePresupuesto) {
      const mensaje = 'El costo planificado supera el presupuesto asignado.';
      const detalle = contexto.costos
        ? {
            presupuesto: contexto.costos.presupuesto,
            costoPlan: contexto.costos.costoPlan,
            diferenciaMonto: contexto.costos.diferenciaMonto,
            diferenciaPorcentaje: contexto.costos.diferenciaPorcentaje,
          }
        : Prisma.JsonNull;

      if (alertaPresupuestoActiva) {
        await contexto.tx.alerta.update({
          where: { id: alertaPresupuestoActiva.id },
          data: { mensaje, detalle },
        });
      } else {
        await contexto.tx.alerta.create({
          data: {
            proyectoId,
            tipo: TipoAlerta.PRESUPUESTO,
            severidad: SeveridadAlerta.ADVERTENCIA,
            clave: clavePresupuesto,
            mensaje,
            detalle,
            entidad: 'Proyecto',
            entidadId: proyectoId,
            activa: true,
          },
        });
      }
    } else if (alertaPresupuestoActiva) {
      await contexto.tx.alerta.update({
        where: { id: alertaPresupuestoActiva.id },
        data: { activa: false, cerradaEn: new Date() },
      });
    }
  }
}
