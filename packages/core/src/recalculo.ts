import type { CalendarioLaboral } from './calendario';
import { consolidarArbol, type DatosConsolidables } from './consolidacion';
import { calcularCronograma, compararCodigos, type DependenciaCronograma } from './cronograma';
import type { ListaHitos } from './hitos';
import type { ResumenCostos } from './costos';
import type { ArbolTareas } from './tareas';

export interface TareaPlanificacion {
  id: number;
  codigo: string;
  padreId: number | null;
  duracionDias: number;
  fechaFija: string | null;
  inicioReal: string | null;
  finReal: string | null;
  porcentajeAvance: number;
}

export interface PlanificacionTarea extends TareaPlanificacion {
  inicioPlan: string;
  finPlan: string;
  inicioTardio: string;
  finTardio: string;
  holguraDias: number;
  esCritica: boolean;
}

export interface Planificacion {
  finProyecto: string | null;
  tareas: PlanificacionTarea[];
}

export interface FechasPlanTarea {
  id: number;
  codigo: string;
  tieneHijas: boolean;
  inicioPlan: string | null;
  finPlan: string | null;
}

export interface TareaAfectada {
  id: number;
  codigo: string;
  inicioAnterior: string;
  inicioNuevo: string;
  finAnterior: string;
  finNuevo: string;
}

export interface ResultadoRecalculo {
  arbol: ArbolTareas;
  tareasAfectadas: TareaAfectada[];
  hitos: ListaHitos;
  costos?: ResumenCostos | null;
}

export function planificarProyecto(
  tareas: readonly TareaPlanificacion[],
  dependencias: readonly DependenciaCronograma[],
  calendario: CalendarioLaboral,
  inicioProyecto: string,
): Planificacion {
  const conHijas = new Set(tareas.map((t) => t.padreId).filter((id): id is number => id !== null));
  const entrada = tareas.map((t) => (conHijas.has(t.id) ? { ...t, fechaFija: null } : t));
  const cronograma = calcularCronograma(entrada, dependencias, calendario, inicioProyecto);
  const porId = new Map(cronograma.tareas.map((r) => [r.id, r]));
  const resultado = (id: number) => {
    const r = porId.get(id);
    if (!r) throw new RangeError(`La tarea ${id} no tiene resultado de cronograma.`);
    return r;
  };
  const datos: DatosConsolidables[] = entrada.map((t) => {
    const hoja = !conHijas.has(t.id);
    return {
      id: t.id,
      padreId: t.padreId,
      duracionDias: t.duracionDias,
      inicioPlan: hoja ? resultado(t.id).inicioTemprano : null,
      finPlan: hoja ? resultado(t.id).finTemprano : null,
      inicioReal: t.inicioReal,
      finReal: t.finReal,
      porcentajeAvance: t.porcentajeAvance,
    };
  });
  const consolidadas = new Map(consolidarArbol(datos, calendario).map((c) => [c.id, c]));
  return {
    finProyecto: cronograma.finProyecto,
    tareas: entrada.map((t) => {
      const r = resultado(t.id);
      const c = consolidadas.get(t.id);
      if (!c) throw new RangeError(`La tarea ${t.codigo} no se pudo consolidar.`);
      return {
        ...t,
        duracionDias: c.duracionDias,
        inicioReal: c.inicioReal,
        finReal: c.finReal,
        porcentajeAvance: c.porcentajeAvance,
        inicioPlan: r.inicioTemprano,
        finPlan: r.finTemprano,
        inicioTardio: r.inicioTardio,
        finTardio: r.finTardio,
        holguraDias: r.holgura,
        esCritica: r.esCritica,
      };
    }),
  };
}

export function compararFechas(
  antes: readonly FechasPlanTarea[],
  despues: readonly FechasPlanTarea[],
): TareaAfectada[] {
  const previas = new Map(antes.map((t) => [t.id, t]));
  return despues
    .flatMap((t) => {
      const previa = previas.get(t.id);
      if (t.tieneHijas || !previa) return [];
      const { inicioPlan: inicioAnterior, finPlan: finAnterior } = previa;
      const { inicioPlan: inicioNuevo, finPlan: finNuevo } = t;
      if (!inicioAnterior || !finAnterior || !inicioNuevo || !finNuevo) return [];
      if (inicioAnterior === inicioNuevo && finAnterior === finNuevo) return [];
      return [{ id: t.id, codigo: t.codigo, inicioAnterior, inicioNuevo, finAnterior, finNuevo }];
    })
    .sort((a, b) => compararCodigos(a.codigo, b.codigo));
}

export function resumirTareasAfectadas(tareasAfectadas: readonly TareaAfectada[]): string {
  const total = tareasAfectadas.length;
  if (total === 0) return 'Sin cambios en el cronograma.';
  return total === 1 ? '1 tarea reprogramada' : `${total} tareas reprogramadas`;
}
