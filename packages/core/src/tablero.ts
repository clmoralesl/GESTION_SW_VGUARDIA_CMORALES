import { z } from 'zod';
import { esquemaFechaIso } from './fechas';
import type { EstadoHito } from './hitos';
import { redondear } from './numeros';
import type { Semaforo } from './semaforo';

export const esquemaConsultaTablero = z
  .strictObject({
    etapaId: z.coerce.number().int().positive().optional(),
    profesionalId: z.coerce.number().int().positive().optional(),
    desde: esquemaFechaIso.optional(),
    hasta: esquemaFechaIso.optional(),
  })
  .refine((d) => d.desde === undefined || d.hasta === undefined || d.desde <= d.hasta, {
    message: 'La fecha inicial debe ser anterior o igual a la fecha final.',
    path: ['desde'],
  });

export type ConsultaTablero = z.infer<typeof esquemaConsultaTablero>;

export interface TarjetaKpiTablero {
  valor: number | null;
  semaforo: Semaforo | null;
  variacion: number | null;
}

export interface TableroProyecto {
  proyectoId: number;
  fechaCorte: string;
  tarjetas: {
    avance: {
      real: number | null;
      plan: number | null;
      semaforo: Semaforo | null;
      variacion: number | null;
      notaColor?: string | null;
    };
    spi: TarjetaKpiTablero;
    cpi: TarjetaKpiTablero;
    costo: {
      costoReal: number;
      presupuesto: number;
      porcentaje: number | null;
      semaforo: Semaforo | null;
      variacion: number | null;
    };
  };
  curvaS: {
    origen: 'LINEA_BASE' | 'PLAN_ACTUAL';
    puntos: { fecha: string; pv: number; ev: number | null; ac: number | null }[];
  };
  hitos: {
    cumplidos: number;
    total: number;
    items: { id: number; nombre: string; fecha: string; estado: EstadoHito }[];
  };
  costoPorEtapa: {
    etapaId: number;
    codigo: string;
    nombre: string;
    costoPlan: number;
    costoReal: number;
  }[];
  carga: {
    profesionalId: number;
    nombre: string;
    ocupacionMaxima: number;
    diaPico: string | null;
    sobreasignado: boolean;
  }[];
  atrasadas: {
    tareaId: number;
    codigo: string;
    nombre: string;
    diasAtraso: number;
    responsable: string | null;
  }[];
  alertas: {
    id: number;
    tipo: string;
    severidad: string;
    mensaje: string;
    creadaEn: string;
    entidad: string | null;
    entidadId: number | null;
  }[];
  opciones: {
    etapas: { id: number; codigo: string; nombre: string }[];
    profesionales: { id: number; nombre: string }[];
  };
}

export interface NodoFiltro {
  id: number;
  padreId: number | null;
  inicioPlan: string | null;
  finPlan: string | null;
}

export interface FiltrosTablero {
  etapaId?: number;
  profesionalId?: number;
  desde?: string;
  hasta?: string;
}

export function etapaDe(nodos: readonly NodoFiltro[]): Map<number, number> {
  const porId = new Map(nodos.map((n) => [n.id, n]));
  const res = new Map<number, number>();
  for (const n of nodos) {
    let actual = n;
    while (actual.padreId !== null) {
      const padre = porId.get(actual.padreId);
      if (!padre) break;
      actual = padre;
    }
    res.set(n.id, actual.id);
  }
  return res;
}

export function hojasFiltradas(
  nodos: readonly NodoFiltro[],
  asignaciones: readonly { tareaId: number; profesionalId: number | null }[],
  f: FiltrosTablero,
): Set<number> {
  const padres = new Set(nodos.map((n) => n.padreId).filter((x): x is number => x !== null));
  const etapas = etapaDe(nodos);
  const conProfesional =
    f.profesionalId === undefined
      ? null
      : new Set(
          asignaciones.filter((a) => a.profesionalId === f.profesionalId).map((a) => a.tareaId),
        );
  return new Set(
    nodos
      .filter((n) => !padres.has(n.id))
      .filter((n) => f.etapaId === undefined || etapas.get(n.id) === f.etapaId)
      .filter((n) => conProfesional === null || conProfesional.has(n.id))
      .filter((n) => f.hasta === undefined || n.inicioPlan === null || n.inicioPlan <= f.hasta)
      .filter((n) => f.desde === undefined || n.finPlan === null || n.finPlan >= f.desde)
      .map((n) => n.id),
  );
}

export function costoPorEtapa(
  nodos: readonly NodoFiltro[],
  costosHoja: ReadonlyMap<number, { costoPlan: number; costoReal: number }>,
  incluidas: ReadonlySet<number>,
): { etapaId: number; costoPlan: number; costoReal: number }[] {
  const etapas = etapaDe(nodos);
  const acumulado = new Map<number, { costoPlan: number; costoReal: number }>();
  for (const id of incluidas) {
    const e = etapas.get(id);
    if (e === undefined) continue;
    const c = costosHoja.get(id) ?? { costoPlan: 0, costoReal: 0 };
    const prev = acumulado.get(e) ?? { costoPlan: 0, costoReal: 0 };
    acumulado.set(e, {
      costoPlan: redondear(prev.costoPlan + c.costoPlan, 2),
      costoReal: redondear(prev.costoReal + c.costoReal, 2),
    });
  }
  return nodos
    .filter((n) => n.padreId === null && acumulado.has(n.id))
    .map((n) => ({ etapaId: n.id, ...acumulado.get(n.id)! }));
}
