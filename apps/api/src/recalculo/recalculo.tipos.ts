import type { Prisma, Proyecto, Tarea } from '@prisma/client';
import type {
  CalendarioLaboral,
  DependenciaCronograma,
  ListaHitos,
  ResumenCostos,
  Rol,
  TareaAfectada,
} from '@autofix/core';
import type { ValorBitacora } from '../comun/bitacora/diferencias';

export interface OrigenRecalculo {
  rol: Rol;
  descripcion: string;
  tareaId?: number;
  solicitudCambioId?: number;
}

export interface ContextoRecalculo {
  tx: Prisma.TransactionClient;
  proyecto: Proyecto;
  calendario: CalendarioLaboral;
  tareas: Tarea[];
  dependencias: DependenciaCronograma[];
  tareasAfectadas: TareaAfectada[];
  hitos: ListaHitos | null;
  costos: ResumenCostos | null;
  detalle: Record<string, ValorBitacora>;
  huboCambios: boolean;
}

export interface PasoRecalculo {
  readonly nombre: string;
  ejecutar(contexto: ContextoRecalculo): Promise<void>;
}

export const PASOS_RECALCULO = Symbol('PASOS_RECALCULO');
