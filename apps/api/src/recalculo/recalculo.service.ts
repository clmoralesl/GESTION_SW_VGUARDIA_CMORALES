import { Inject, Injectable } from '@nestjs/common';
import { Prisma, type Tarea } from '@prisma/client';
import type { ResultadoRecalculo } from '@autofix/core';
import { ArbolTareasService } from '../tareas/arbol-tareas.service';
import { BitacoraService } from '../comun/bitacora/bitacora.service';
import { obtenerProyectoAbierto } from '../proyectos/proyecto-abierto';
import { cargarCalendarioLaboral } from '../calendario/calendario-laboral';
import {
  type ContextoRecalculo,
  type OrigenRecalculo,
  type PasoRecalculo,
  PASOS_RECALCULO,
} from './recalculo.tipos';

export function describirOrigen(
  origen: OrigenRecalculo,
  tareas: readonly Pick<Tarea, 'id' | 'codigo'>[],
): string {
  let texto = origen.descripcion;
  if (origen.tareaId !== undefined) {
    const tarea = tareas.find((t) => t.id === origen.tareaId);
    if (tarea) {
      texto = `${origen.descripcion} ${tarea.codigo}`;
    }
  }
  return texto.slice(0, 200);
}

@Injectable()
export class RecalculoService {
  constructor(
    private readonly arbol: ArbolTareasService,
    private readonly bitacora: BitacoraService,
    @Inject(PASOS_RECALCULO) private readonly pasos: readonly PasoRecalculo[],
  ) {}

  async ejecutar(
    proyectoId: number,
    tx: Prisma.TransactionClient,
    origen: OrigenRecalculo,
  ): Promise<ResultadoRecalculo> {
    const proyecto = await obtenerProyectoAbierto(tx, proyectoId, { bloquear: true });
    await this.arbol.numerar(tx, proyectoId);
    const tareas = await tx.tarea.findMany({ where: { proyectoId } });
    const dependenciasDb = await tx.dependencia.findMany({ where: { proyectoId } });
    const contexto: ContextoRecalculo = {
      tx,
      proyecto,
      calendario: await cargarCalendarioLaboral(tx, proyectoId),
      tareas,
      dependencias: dependenciasDb.map((d) => ({
        predecesoraId: d.predecesoraId,
        sucesoraId: d.sucesoraId,
        tipo: d.tipo,
        desfaseDias: d.desfaseDias,
      })),
      tareasAfectadas: [],
      hitos: null,
      costos: null,
      detalle: {},
      huboCambios: false,
    };
    for (const paso of this.pasos) {
      await paso.ejecutar(contexto);
    }
    if (contexto.huboCambios) {
      await this.bitacora.registrarRecalculo(
        tx,
        { proyectoId, entidad: 'Proyecto', entidadId: proyectoId, rol: origen.rol },
        { tareasAfectadas: contexto.tareasAfectadas, ...contexto.detalle },
        describirOrigen(origen, contexto.tareas),
      );
    }
    return {
      arbol: await this.arbol.cargar(tx, proyectoId),
      tareasAfectadas: contexto.tareasAfectadas,
      hitos: contexto.hitos ?? { proyectoId, fechaCalculo: '', hitos: [] },
      costos: contexto.costos ?? null,
    };
  }
}
