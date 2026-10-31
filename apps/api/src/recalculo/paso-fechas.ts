import { Injectable } from '@nestjs/common';
import { Prisma, type Tarea } from '@prisma/client';
import {
  compararFechas,
  dateAFechaIso,
  fechaIsoADate,
  planificarProyecto,
  type FechasPlanTarea,
  type PlanificacionTarea,
  type TareaPlanificacion,
} from '@autofix/core';
import type { ContextoRecalculo, PasoRecalculo } from './recalculo.tipos';
import { escribirPlanificacion } from './escritura-planificacion';
import { traducirErrorCronograma } from './errores-cronograma';

const aIso = (fecha: Date | null) => (fecha ? dateAFechaIso(fecha) : null);

function cambiaCronograma(nueva: PlanificacionTarea, vieja: Tarea): boolean {
  return (
    nueva.duracionDias !== vieja.duracionDias ||
    nueva.inicioPlan !== aIso(vieja.inicioPlan) ||
    nueva.finPlan !== aIso(vieja.finPlan) ||
    nueva.inicioTardio !== aIso(vieja.inicioTardio) ||
    nueva.finTardio !== aIso(vieja.finTardio) ||
    nueva.holguraDias !== vieja.holguraDias ||
    nueva.esCritica !== vieja.esCritica
  );
}

function cambiaFila(nueva: PlanificacionTarea, vieja: Tarea): boolean {
  return (
    cambiaCronograma(nueva, vieja) ||
    nueva.inicioReal !== aIso(vieja.inicioReal) ||
    nueva.finReal !== aIso(vieja.finReal) ||
    nueva.fechaFija !== aIso(vieja.fechaFija) ||
    nueva.porcentajeAvance !== Number(vieja.porcentajeAvance)
  );
}

@Injectable()
export class PasoFechas implements PasoRecalculo {
  readonly nombre = 'fechas';

  async ejecutar(contexto: ContextoRecalculo): Promise<void> {
    if (contexto.tareas.length === 0) return;

    const padresConHijas = new Set(
      contexto.tareas.map((t) => t.padreId).filter((id): id is number => id !== null),
    );

    const tareasEntrada: TareaPlanificacion[] = contexto.tareas.map((t) => ({
      id: t.id,
      codigo: t.codigo,
      padreId: t.padreId,
      duracionDias: t.duracionDias,
      fechaFija: t.fechaFija ? dateAFechaIso(t.fechaFija) : null,
      inicioReal: t.inicioReal ? dateAFechaIso(t.inicioReal) : null,
      finReal: t.finReal ? dateAFechaIso(t.finReal) : null,
      porcentajeAvance: Number(t.porcentajeAvance),
    }));

    let plan;
    try {
      plan = planificarProyecto(
        tareasEntrada,
        contexto.dependencias,
        contexto.calendario,
        dateAFechaIso(contexto.proyecto.fechaInicio),
      );
    } catch (error) {
      traducirErrorCronograma(error);
    }

    const mapaTareasAntes = new Map(contexto.tareas.map((t) => [t.id, t]));

    const antesFechas: FechasPlanTarea[] = contexto.tareas.map((t) => ({
      id: t.id,
      codigo: t.codigo,
      tieneHijas: padresConHijas.has(t.id),
      inicioPlan: t.inicioPlan ? dateAFechaIso(t.inicioPlan) : null,
      finPlan: t.finPlan ? dateAFechaIso(t.finPlan) : null,
    }));

    const despuesFechas: FechasPlanTarea[] = plan.tareas.map((t) => ({
      id: t.id,
      codigo: t.codigo,
      tieneHijas: padresConHijas.has(t.id),
      inicioPlan: t.inicioPlan,
      finPlan: t.finPlan,
    }));

    const filasQueCambian: PlanificacionTarea[] = plan.tareas.filter((tNueva) => {
      const tVieja = mapaTareasAntes.get(tNueva.id);
      if (!tVieja) return true;
      return cambiaFila(tNueva, tVieja);
    });

    await escribirPlanificacion(contexto.tx, filasQueCambian);

    contexto.tareasAfectadas = compararFechas(antesFechas, despuesFechas);

    const huboCambiosCronograma = filasQueCambian.some((tNueva) => {
      const tVieja = mapaTareasAntes.get(tNueva.id);
      if (!tVieja) return true;
      return cambiaCronograma(tNueva, tVieja);
    });

    contexto.huboCambios = contexto.huboCambios || huboCambiosCronograma;

    const finesHojasAntes = antesFechas
      .filter((t) => !t.tieneHijas && t.finPlan !== null)
      .map((t) => t.finPlan as string);
    const finProyectoAnterior =
      finesHojasAntes.length > 0 ? finesHojasAntes.reduce((max, f) => (f > max ? f : max)) : null;

    contexto.detalle = {
      ...contexto.detalle,
      finProyectoAnterior,
      finProyectoNuevo: plan.finProyecto,
      filasActualizadas: filasQueCambian.length,
    };

    const mapaPlan = new Map(plan.tareas.map((p) => [p.id, p]));
    contexto.tareas = contexto.tareas.map((t): Tarea => {
      const p = mapaPlan.get(t.id);
      if (!p) return t;
      return {
        ...t,
        duracionDias: p.duracionDias,
        inicioPlan: fechaIsoADate(p.inicioPlan),
        finPlan: fechaIsoADate(p.finPlan),
        inicioReal: p.inicioReal ? fechaIsoADate(p.inicioReal) : null,
        finReal: p.finReal ? fechaIsoADate(p.finReal) : null,
        fechaFija: p.fechaFija ? fechaIsoADate(p.fechaFija) : null,
        porcentajeAvance: new Prisma.Decimal(p.porcentajeAvance),
        inicioTardio: fechaIsoADate(p.inicioTardio),
        finTardio: fechaIsoADate(p.finTardio),
        holguraDias: p.holguraDias,
        esCritica: p.esCritica,
      };
    });
  }
}
