import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  calcularHorasPlan,
  consolidarCostos,
  CostoExcedeMaximoError,
  resumirCostos,
  sumarMontos,
  type AsignacionCosto,
  type CostosTarea,
  type NodoCosto,
} from '@autofix/core';
import { ExcepcionApi } from '../comun/errores/excepcion-api';
import type { ContextoRecalculo, PasoRecalculo } from './recalculo.tipos';

@Injectable()
export class PasoCostos implements PasoRecalculo {
  readonly nombre = 'costos';

  async ejecutar(contexto: ContextoRecalculo): Promise<void> {
    const presupuesto = Number(contexto.proyecto.presupuesto);
    if (contexto.tareas.length === 0) {
      contexto.costos = resumirCostos(presupuesto, { costoPlan: 0, costoReal: 0 });
      return;
    }

    const tareaIds = contexto.tareas.map((t) => t.id);
    const mapaTareas = new Map(contexto.tareas.map((t) => [t.id, t]));

    const asignacionesDb = await contexto.tx.asignacion.findMany({
      where: { tareaId: { in: tareaIds } },
      include: {
        profesional: { select: { id: true, horasDiarias: true, tarifaHora: true } },
        recurso: { select: { id: true, costoUnitario: true } },
      },
    });

    let huboCambiosAsignaciones = false;
    const asignacionesParaCalculo: AsignacionCosto[] = [];

    for (const asig of asignacionesDb) {
      let horasPlan = asig.horasPlan !== null ? Number(asig.horasPlan) : null;

      if (asig.profesionalId !== null && !asig.horasPlanManual && asig.profesional) {
        const tarea = mapaTareas.get(asig.tareaId);
        const duracion = tarea ? tarea.duracionDias : 0;
        const horasDiarias = Number(asig.profesional.horasDiarias);
        const dedicacion = asig.dedicacion !== null ? Number(asig.dedicacion) : 0;
        const horasCalculadas = calcularHorasPlan(duracion, horasDiarias, dedicacion);

        if (horasPlan !== horasCalculadas) {
          horasPlan = horasCalculadas;
          huboCambiosAsignaciones = true;
          await contexto.tx.asignacion.update({
            where: { id: asig.id },
            data: { horasPlan: new Prisma.Decimal(horasCalculadas) },
          });
        }
      }

      asignacionesParaCalculo.push({
        tareaId: asig.tareaId,
        horasPlan,
        horasReales: asig.horasReales !== null ? Number(asig.horasReales) : null,
        tarifaAplicada: asig.tarifaAplicada !== null ? Number(asig.tarifaAplicada) : null,
        cantidadPlan: asig.cantidadPlan !== null ? Number(asig.cantidadPlan) : null,
        cantidadReal: asig.cantidadReal !== null ? Number(asig.cantidadReal) : null,
        costoUnitarioAplicado:
          asig.costoUnitarioAplicado !== null ? Number(asig.costoUnitarioAplicado) : null,
      });
    }

    const nodos: NodoCosto[] = contexto.tareas.map((t) => ({ id: t.id, padreId: t.padreId }));
    let resultadoCostos: { porTarea: Map<number, CostosTarea>; proyecto: CostosTarea };
    try {
      resultadoCostos = consolidarCostos(nodos, asignacionesParaCalculo);
    } catch (error) {
      if (error instanceof CostoExcedeMaximoError) {
        throw new ExcepcionApi(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'COSTO_EXCEDE_MAXIMO',
          'El costo calculado supera el máximo permitido.',
          error.tareaId ? [{ campo: 'costo', mensaje: `Tarea ${error.tareaId}` }] : undefined,
        );
      }
      throw error;
    }

    const costoPlanAnterior = sumarMontos(
      contexto.tareas.filter((t) => t.padreId === null).map((t) => Number(t.costoPlan)),
    );

    let huboCambiosTareas = false;
    for (const t of contexto.tareas) {
      const calculados = resultadoCostos.porTarea.get(t.id) ?? { costoPlan: 0, costoReal: 0 };
      const planActual = Number(t.costoPlan);
      const realActual = Number(t.costoReal);

      if (planActual !== calculados.costoPlan || realActual !== calculados.costoReal) {
        huboCambiosTareas = true;
        await contexto.tx.tarea.update({
          where: { id: t.id },
          data: {
            costoPlan: new Prisma.Decimal(calculados.costoPlan),
            costoReal: new Prisma.Decimal(calculados.costoReal),
          },
        });
      }
    }

    contexto.tareas = contexto.tareas.map((t) => {
      const calculados = resultadoCostos.porTarea.get(t.id);
      if (!calculados) return t;
      return {
        ...t,
        costoPlan: new Prisma.Decimal(calculados.costoPlan),
        costoReal: new Prisma.Decimal(calculados.costoReal),
      };
    });

    const resumen = resumirCostos(presupuesto, resultadoCostos.proyecto);
    contexto.costos = resumen;

    if (huboCambiosAsignaciones || huboCambiosTareas) {
      contexto.huboCambios = true;
    }

    contexto.detalle = {
      ...contexto.detalle,
      costoPlanAnterior,
      costoPlanNuevo: resumen.costoPlan,
    };
  }
}
