import { redondear } from './numeros';
import { redondearMonto, sumarMontos } from './montos';
import { PRESUPUESTO_MAXIMO } from './proyectos';

export class CostoExcedeMaximoError extends Error {
  readonly tareaId: number | null;
  constructor(tareaId: number | null) {
    super('El costo calculado supera el máximo permitido.');
    this.name = 'CostoExcedeMaximoError';
    this.tareaId = tareaId;
  }
}

export interface AsignacionCosto {
  tareaId: number;
  horasPlan: number | null;
  horasReales: number | null;
  tarifaAplicada: number | null;
  cantidadPlan: number | null;
  cantidadReal: number | null;
  costoUnitarioAplicado: number | null;
}

export interface CostosTarea {
  costoPlan: number;
  costoReal: number;
}

const producto = (a: number | null, b: number | null) => redondearMonto((a ?? 0) * (b ?? 0));

const verificar = (monto: number, tareaId: number | null) => {
  if (!Number.isFinite(monto) || monto > PRESUPUESTO_MAXIMO)
    throw new CostoExcedeMaximoError(tareaId);
  return monto;
};

export function calcularCostosTarea(asignaciones: readonly AsignacionCosto[]): CostosTarea {
  const tareaId = asignaciones[0]?.tareaId ?? null;
  const total = (horas: 'horasPlan' | 'horasReales', cantidad: 'cantidadPlan' | 'cantidadReal') =>
    verificar(
      sumarMontos(
        asignaciones.flatMap((a) => [
          producto(a[horas], a.tarifaAplicada),
          producto(a[cantidad], a.costoUnitarioAplicado),
        ]),
      ),
      tareaId,
    );
  return {
    costoPlan: total('horasPlan', 'cantidadPlan'),
    costoReal: total('horasReales', 'cantidadReal'),
  };
}

export interface NodoCosto {
  id: number;
  padreId: number | null;
}

export function consolidarCostos(
  tareas: readonly NodoCosto[],
  asignaciones: readonly AsignacionCosto[],
): { porTarea: Map<number, CostosTarea>; proyecto: CostosTarea } {
  const hijos = new Map<number | null, NodoCosto[]>();
  for (const t of tareas) hijos.set(t.padreId, [...(hijos.get(t.padreId) ?? []), t]);
  const porHoja = new Map<number, AsignacionCosto[]>();
  for (const a of asignaciones) porHoja.set(a.tareaId, [...(porHoja.get(a.tareaId) ?? []), a]);
  const sumar = (partes: CostosTarea[], id: number | null): CostosTarea => ({
    costoPlan: verificar(sumarMontos(partes.map((c) => c.costoPlan)), id),
    costoReal: verificar(sumarMontos(partes.map((c) => c.costoReal)), id),
  });
  const porTarea = new Map<number, CostosTarea>();
  const calcular = (t: NodoCosto): CostosTarea => {
    const propias = (hijos.get(t.id) ?? []).map(calcular);
    const costos =
      propias.length === 0 ? calcularCostosTarea(porHoja.get(t.id) ?? []) : sumar(propias, t.id);
    porTarea.set(t.id, costos);
    return costos;
  };
  const raices = (hijos.get(null) ?? []).map(calcular);
  return { porTarea, proyecto: sumar(raices, null) };
}

export function calcularHorasPlan(
  duracionDias: number,
  horasDiarias: number,
  dedicacion: number,
): number {
  return redondear((duracionDias * horasDiarias * dedicacion) / 100, 2);
}

export interface ResumenCostos {
  presupuesto: number;
  costoPlan: number;
  costoReal: number;
  diferenciaMonto: number;
  diferenciaPorcentaje: number | null;
  excedePresupuesto: boolean;
}

export function resumirCostos(presupuesto: number, costos: CostosTarea): ResumenCostos {
  const diferenciaMonto = redondearMonto(presupuesto - costos.costoPlan);
  return {
    presupuesto,
    ...costos,
    diferenciaMonto,
    diferenciaPorcentaje:
      presupuesto > 0 ? redondear((diferenciaMonto / presupuesto) * 100, 2) : null,
    excedePresupuesto: presupuesto > 0 && costos.costoPlan > presupuesto,
  };
}
