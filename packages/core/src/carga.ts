const MS = 86_400_000;
const cacheDia = new Map<string, number>();
const aDia = (iso: string): number => {
  let d = cacheDia.get(iso);
  if (d === undefined) {
    d = Math.round(Date.parse(`${iso}T00:00:00Z`) / MS);
    cacheDia.set(iso, d);
  }
  return d;
};
const cacheIso = new Map<number, string>();
const aIso = (d: number): string => {
  let iso = cacheIso.get(d);
  if (!iso) {
    iso = new Date(d * MS).toISOString().slice(0, 10);
    cacheIso.set(d, iso);
  }
  return iso;
};
const LIMITE_CENTESIMAS = 10_000;

export interface TareaCarga {
  id: number;
  codigo: string;
  proyectoId: number;
  inicioPlan: string | null;
  finPlan: string | null;
  porcentajeAvance: number;
  esHabil: (fechaIso: string) => boolean;
}

export interface AsignacionCarga {
  profesionalId: number;
  tareaId: number;
  dedicacion: number;
}

export interface ConflictoSobreasignacion {
  profesionalId: number;
  desde: string;
  hasta: string;
  dedicacionMaxima: number;
  tareaIds: number[];
  proyectoIds: number[];
}

export type CeldaDia = { centesimas: number; tareaIds: Set<number> };
export type CargaDiaria = Map<number, Map<number, CeldaDia>>;

export function calcularCargaDiaria(
  asignaciones: readonly AsignacionCarga[],
  tareas: readonly TareaCarga[],
): CargaDiaria {
  const porId = new Map(tareas.map((t) => [t.id, t]));
  const carga: CargaDiaria = new Map();
  const diasHabiles = new Map<number, number[]>();
  const cacheHabilesPorFn = new Map<(fechaIso: string) => boolean, Map<string, number[]>>();

  const habilesDe = (t: TareaCarga & { inicioPlan: string; finPlan: string }) => {
    let lista = diasHabiles.get(t.id);
    if (!lista) {
      const clave = `${t.inicioPlan}_${t.finPlan}`;
      let porFn = cacheHabilesPorFn.get(t.esHabil);
      if (!porFn) {
        porFn = new Map<string, number[]>();
        cacheHabilesPorFn.set(t.esHabil, porFn);
      }
      lista = porFn.get(clave);
      if (!lista) {
        lista = [];
        const ini = aDia(t.inicioPlan);
        const fin = aDia(t.finPlan);
        for (let d = ini; d <= fin; d += 1) {
          if (t.esHabil(aIso(d))) lista.push(d);
        }
        porFn.set(clave, lista);
      }
      diasHabiles.set(t.id, lista);
    }
    return lista;
  };
  for (const a of asignaciones) {
    const t = porId.get(a.tareaId);
    if (!t || !t.inicioPlan || !t.finPlan || t.porcentajeAvance >= 100) continue;
    let dias = carga.get(a.profesionalId);
    if (!dias) {
      dias = new Map<number, CeldaDia>();
      carga.set(a.profesionalId, dias);
    }
    const centesimas = Math.round(a.dedicacion * 100);
    const listaHabiles = habilesDe(t as TareaCarga & { inicioPlan: string; finPlan: string });
    for (const d of listaHabiles) {
      const celda = dias.get(d);
      if (!celda) {
        dias.set(d, { centesimas, tareaIds: new Set([t.id]) });
      } else {
        celda.centesimas += centesimas;
        celda.tareaIds.add(t.id);
      }
    }
  }
  return carga;
}

export function detectarSobreasignaciones(
  asignaciones: readonly AsignacionCarga[],
  tareas: readonly TareaCarga[],
): ConflictoSobreasignacion[] {
  const porId = new Map(tareas.map((t) => [t.id, t]));
  const conflictos: ConflictoSobreasignacion[] = [];
  for (const [profesionalId, dias] of calcularCargaDiaria(asignaciones, tareas)) {
    let tramo: { desde: number; hasta: number; maximo: number; tareas: Set<number> } | null = null;
    const cerrar = () => {
      if (!tramo) return;
      const tareaIds = [...tramo.tareas].sort((a, b) => a - b);
      conflictos.push({
        profesionalId,
        desde: aIso(tramo.desde),
        hasta: aIso(tramo.hasta),
        dedicacionMaxima: tramo.maximo / 100,
        tareaIds,
        proyectoIds: [...new Set(tareaIds.map((id) => porId.get(id)!.proyectoId))].sort(
          (a, b) => a - b,
        ),
      });
      tramo = null;
    };
    for (const dia of [...dias.keys()].sort((a, b) => a - b)) {
      const celda = dias.get(dia)!;
      if (celda.centesimas <= LIMITE_CENTESIMAS) {
        cerrar();
        continue;
      }
      tramo ??= { desde: dia, hasta: dia, maximo: 0, tareas: new Set() };
      tramo.hasta = dia;
      tramo.maximo = Math.max(tramo.maximo, celda.centesimas);
      for (const id of celda.tareaIds) tramo.tareas.add(id);
    }
    cerrar();
  }
  return conflictos.sort(
    (a, b) => a.profesionalId - b.profesionalId || a.desde.localeCompare(b.desde),
  );
}

export const claveSobreasignacion = (c: ConflictoSobreasignacion) =>
  `SOBREASIGNACION:${c.profesionalId}:${c.desde}:${c.hasta}`;

const lunesDe = (d: number) => d - ((((d + 4) % 7) + 6) % 7);

export interface CeldaCarga {
  semana: string;
  porcentaje: number;
  sobreasignada: boolean;
}

export function cargaSemanal(
  carga: CargaDiaria,
  profesionalId: number,
  desdeIso: string,
  hastaIso: string,
  esHabilBase: (fechaIso: string) => boolean,
): CeldaCarga[] {
  const dias = carga.get(profesionalId) ?? new Map<number, CeldaDia>();
  const celdas: CeldaCarga[] = [];
  for (let lunes = lunesDe(aDia(desdeIso)); lunes <= aDia(hastaIso); lunes += 7) {
    let base = 0;
    let suma = 0;
    let sobreasignada = false;
    for (let d = lunes; d < lunes + 7; d += 1) {
      const celda = dias.get(d);
      if (celda || esHabilBase(aIso(d))) base += 1;
      if (celda) {
        suma += celda.centesimas;
        sobreasignada ||= celda.centesimas > LIMITE_CENTESIMAS;
      }
    }
    celdas.push({
      semana: aIso(lunes),
      porcentaje: base === 0 ? 0 : Math.round(suma / base) / 100,
      sobreasignada,
    });
  }
  return celdas;
}

export function picoCarga(
  carga: CargaDiaria,
  profesionalId: number,
  desdeIso: string,
  hastaIso: string,
): { ocupacionMaxima: number; diaPico: string | null; sobreasignado: boolean } {
  let maximo = 0;
  let diaPico: number | null = null;
  for (const [dia, celda] of carga.get(profesionalId) ?? new Map<number, CeldaDia>()) {
    if (dia < aDia(desdeIso) || dia > aDia(hastaIso)) continue;
    if (celda.centesimas > maximo) {
      maximo = celda.centesimas;
      diaPico = dia;
    }
  }
  return {
    ocupacionMaxima: maximo / 100,
    diaPico: diaPico === null ? null : aIso(diaPico),
    sobreasignado: maximo > LIMITE_CENTESIMAS,
  };
}
