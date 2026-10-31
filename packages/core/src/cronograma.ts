import {
  anteriorHabil,
  diasHabilesEntre,
  siguienteHabil,
  sumarDiasHabiles,
  type CalendarioLaboral,
} from './calendario';
import { calcularFinPlan } from './planificacion';

export const TIPOS_DEPENDENCIA = ['FS', 'SS', 'FF', 'SF'] as const;
export type TipoDependencia = (typeof TIPOS_DEPENDENCIA)[number];

export interface TareaCronograma {
  id: number;
  codigo: string;
  padreId: number | null;
  duracionDias: number;
  fechaFija: string | null;
  inicioReal: string | null;
  finReal: string | null;
}

export interface DependenciaCronograma {
  predecesoraId: number;
  sucesoraId: number;
  tipo: TipoDependencia;
  desfaseDias: number;
}

export interface ResultadoTareaCronograma {
  id: number;
  codigo: string;
  inicioTemprano: string;
  finTemprano: string;
  inicioTardio: string;
  finTardio: string;
  holgura: number;
  esCritica: boolean;
}

export interface ResultadoCronograma {
  finProyecto: string | null;
  tareas: ResultadoTareaCronograma[];
}

export class CicloDetectadoError extends Error {
  readonly ciclo: string[];

  constructor(ciclo: string[]) {
    super(`Ciclo detectado: ${ciclo.join(' → ')}`);
    this.name = 'CicloDetectadoError';
    this.ciclo = ciclo;
  }
}

export class DependenciaInvalidaError extends Error {
  readonly dependencia: DependenciaCronograma;

  constructor(mensaje: string, dependencia: DependenciaCronograma) {
    super(mensaje);
    this.name = 'DependenciaInvalidaError';
    this.dependencia = dependencia;
  }
}

interface NodoCronograma {
  tarea: TareaCronograma;
  entrantes: DependenciaCronograma[];
  salientes: DependenciaCronograma[];
  inicioTemprano: string;
  finTemprano: string;
  inicioTardio: string;
  finTardio: string;
}

type Nodos = Map<number, NodoCronograma>;

export function compararCodigos(a: string, b: string): number {
  const x = a.split('.').map(Number);
  const y = b.split('.').map(Number);
  const largo = Math.max(x.length, y.length);
  for (let i = 0; i < largo; i += 1) {
    const diferencia = (x[i] ?? -1) - (y[i] ?? -1);
    if (diferencia !== 0) return diferencia;
  }
  return 0;
}

const mayor = (a: string, b: string): string => (a > b ? a : b);
const menor = (a: string, b: string): string => (a < b ? a : b);

const finDesde = (inicio: string, duracion: number, calendario: CalendarioLaboral): string =>
  sumarDiasHabiles(inicio, Math.max(duracion - 1, 0), calendario);

const inicioDesde = (fin: string, duracion: number, calendario: CalendarioLaboral): string =>
  sumarDiasHabiles(fin, -Math.max(duracion - 1, 0), calendario);

const pasoFs = (sucesora: TareaCronograma): number => (sucesora.duracionDias === 0 ? 0 : 1);

function obtener(nodos: Nodos, id: number): NodoCronograma {
  const nodo = nodos.get(id);
  if (!nodo) throw new RangeError(`La tarea ${id} no forma parte del cronograma.`);
  return nodo;
}

function validar(
  tareas: readonly TareaCronograma[],
  dependencias: readonly DependenciaCronograma[],
  nodos: Nodos,
): void {
  for (const tarea of tareas) {
    if (!Number.isInteger(tarea.duracionDias) || tarea.duracionDias < 0) {
      throw new RangeError(`La duración de la tarea ${tarea.codigo} no es válida.`);
    }
  }
  const ids = new Set(tareas.map((t) => t.id));
  const pares = new Set<string>();
  for (const d of dependencias) {
    if (d.predecesoraId === d.sucesoraId) {
      throw new DependenciaInvalidaError('Una tarea no puede depender de sí misma.', d);
    }
    if (!ids.has(d.predecesoraId) || !ids.has(d.sucesoraId)) {
      throw new DependenciaInvalidaError(
        'La dependencia hace referencia a una tarea inexistente.',
        d,
      );
    }
    if (!nodos.has(d.predecesoraId) || !nodos.has(d.sucesoraId)) {
      throw new DependenciaInvalidaError(
        'Las dependencias solo se admiten entre tareas sin subtareas.',
        d,
      );
    }
    if (!Number.isInteger(d.desfaseDias)) {
      throw new DependenciaInvalidaError(
        'El desfase debe ser un número entero de días hábiles.',
        d,
      );
    }
    const par = `${d.predecesoraId}-${d.sucesoraId}`;
    if (pares.has(par)) {
      throw new DependenciaInvalidaError('La dependencia entre esas tareas está repetida.', d);
    }
    pares.add(par);
  }
}

function buscarCiclo(nodos: Nodos, resueltas: ReadonlySet<number>): string[] {
  const codigo = (id: number) => obtener(nodos, id).tarea.codigo;
  const porCodigo = (a: number, b: number) => compararCodigos(codigo(a), codigo(b));
  const estado = new Map<number, 'visitando' | 'terminada'>();
  const camino: number[] = [];

  const visitar = (id: number): number[] | null => {
    estado.set(id, 'visitando');
    camino.push(id);
    const siguientes = obtener(nodos, id)
      .salientes.map((d) => d.sucesoraId)
      .filter((s) => !resueltas.has(s))
      .sort(porCodigo);
    for (const s of siguientes) {
      if (estado.get(s) === 'visitando') return camino.slice(camino.indexOf(s));
      if (!estado.has(s)) {
        const ciclo = visitar(s);
        if (ciclo) return ciclo;
      }
    }
    estado.set(id, 'terminada');
    camino.pop();
    return null;
  };

  const pendientes = [...nodos.keys()].filter((id) => !resueltas.has(id)).sort(porCodigo);
  for (const id of pendientes) {
    if (estado.has(id)) continue;
    const ciclo = visitar(id);
    if (!ciclo) continue;
    const posicion = ciclo.reduce(
      (mejor, actual, i) => (porCodigo(actual, ciclo[mejor] ?? actual) < 0 ? i : mejor),
      0,
    );
    const rotado = [...ciclo.slice(posicion), ...ciclo.slice(0, posicion)];
    return [...rotado, ...rotado.slice(0, 1)].map(codigo);
  }
  return [];
}

function ordenarTopologicamente(nodos: Nodos): number[] {
  const pendientes = new Map([...nodos].map(([id, nodo]) => [id, nodo.entrantes.length]));
  const cola = [...nodos.keys()].filter((id) => pendientes.get(id) === 0);
  const orden: number[] = [];
  for (const id of cola) {
    orden.push(id);
    for (const d of obtener(nodos, id).salientes) {
      const restantes = (pendientes.get(d.sucesoraId) ?? 0) - 1;
      pendientes.set(d.sucesoraId, restantes);
      if (restantes === 0) cola.push(d.sucesoraId);
    }
  }
  if (orden.length < nodos.size) {
    throw new CicloDetectadoError(buscarCiclo(nodos, new Set(orden)));
  }
  return orden;
}

function restriccionHaciaAdelante(
  d: DependenciaCronograma,
  predecesora: Pick<NodoCronograma, 'inicioTemprano' | 'finTemprano'>,
  sucesora: TareaCronograma,
  calendario: CalendarioLaboral,
): string {
  const duracion = sucesora.duracionDias;
  switch (d.tipo) {
    case 'FS':
      return sumarDiasHabiles(
        predecesora.finTemprano,
        pasoFs(sucesora) + d.desfaseDias,
        calendario,
      );
    case 'SS':
      return sumarDiasHabiles(predecesora.inicioTemprano, d.desfaseDias, calendario);
    case 'FF':
      return inicioDesde(
        sumarDiasHabiles(predecesora.finTemprano, d.desfaseDias, calendario),
        duracion,
        calendario,
      );
    case 'SF':
      return inicioDesde(
        sumarDiasHabiles(predecesora.inicioTemprano, d.desfaseDias - 1, calendario),
        duracion,
        calendario,
      );
  }
}

function restriccionHaciaAtras(
  d: DependenciaCronograma,
  predecesora: TareaCronograma,
  sucesora: NodoCronograma,
  calendario: CalendarioLaboral,
): string {
  const duracion = predecesora.duracionDias;
  switch (d.tipo) {
    case 'FS':
      return sumarDiasHabiles(
        sucesora.inicioTardio,
        -(pasoFs(sucesora.tarea) + d.desfaseDias),
        calendario,
      );
    case 'SS':
      return finDesde(
        sumarDiasHabiles(sucesora.inicioTardio, -d.desfaseDias, calendario),
        duracion,
        calendario,
      );
    case 'FF':
      return sumarDiasHabiles(sucesora.finTardio, -d.desfaseDias, calendario);
    case 'SF':
      return finDesde(
        sumarDiasHabiles(sucesora.finTardio, 1 - d.desfaseDias, calendario),
        duracion,
        calendario,
      );
  }
}

function calcularHaciaAdelante(
  nodo: NodoCronograma,
  nodos: Nodos,
  calendario: CalendarioLaboral,
  inicioProyecto: string,
): void {
  const { tarea } = nodo;
  if (tarea.inicioReal) {
    nodo.inicioTemprano = tarea.inicioReal;
    nodo.finTemprano =
      tarea.finReal ?? calcularFinPlan(tarea.inicioReal, tarea.duracionDias, calendario);
    return;
  }
  const piso = siguienteHabil(inicioProyecto, calendario);
  let inicio = tarea.fechaFija ? mayor(piso, siguienteHabil(tarea.fechaFija, calendario)) : piso;
  for (const d of nodo.entrantes) {
    inicio = mayor(
      inicio,
      restriccionHaciaAdelante(d, obtener(nodos, d.predecesoraId), tarea, calendario),
    );
  }
  nodo.inicioTemprano = inicio;
  nodo.finTemprano = finDesde(inicio, tarea.duracionDias, calendario);
}

function calcularHaciaAtras(
  nodo: NodoCronograma,
  nodos: Nodos,
  calendario: CalendarioLaboral,
  finProyecto: string,
): void {
  let fin = finProyecto;
  for (const d of nodo.salientes) {
    fin = menor(
      fin,
      restriccionHaciaAtras(d, nodo.tarea, obtener(nodos, d.sucesoraId), calendario),
    );
  }
  nodo.finTardio = fin;
  nodo.inicioTardio = inicioDesde(fin, nodo.tarea.duracionDias, calendario);
}

function resultadoHoja(
  nodo: NodoCronograma,
  calendario: CalendarioLaboral,
): ResultadoTareaCronograma {
  const holgura = diasHabilesEntre(nodo.finTemprano, nodo.finTardio, calendario);
  return {
    id: nodo.tarea.id,
    codigo: nodo.tarea.codigo,
    inicioTemprano: nodo.inicioTemprano,
    finTemprano: nodo.finTemprano,
    inicioTardio: nodo.inicioTardio,
    finTardio: nodo.finTardio,
    holgura,
    esCritica: holgura <= 0,
  };
}

function consolidar(
  tarea: TareaCronograma,
  hijas: readonly ResultadoTareaCronograma[],
): ResultadoTareaCronograma {
  const [primera, ...resto] = hijas;
  if (!primera) throw new RangeError(`La tarea ${tarea.codigo} no tiene subtareas.`);
  return resto.reduce(
    (acumulado, h) => ({
      ...acumulado,
      inicioTemprano: menor(acumulado.inicioTemprano, h.inicioTemprano),
      finTemprano: mayor(acumulado.finTemprano, h.finTemprano),
      inicioTardio: menor(acumulado.inicioTardio, h.inicioTardio),
      finTardio: mayor(acumulado.finTardio, h.finTardio),
      holgura: Math.min(acumulado.holgura, h.holgura),
      esCritica: acumulado.esCritica || h.esCritica,
    }),
    { ...primera, id: tarea.id, codigo: tarea.codigo },
  );
}

export function calcularCronograma(
  tareas: readonly TareaCronograma[],
  dependencias: readonly DependenciaCronograma[],
  calendario: CalendarioLaboral,
  inicioProyecto: string,
): ResultadoCronograma {
  const conHijas = new Set(tareas.map((t) => t.padreId).filter((id): id is number => id !== null));
  const nodos: Nodos = new Map(
    tareas
      .filter((t) => !conHijas.has(t.id))
      .map((t) => [
        t.id,
        {
          tarea: t,
          entrantes: [],
          salientes: [],
          inicioTemprano: '',
          finTemprano: '',
          inicioTardio: '',
          finTardio: '',
        },
      ]),
  );
  validar(tareas, dependencias, nodos);
  if (nodos.size === 0) return { finProyecto: null, tareas: [] };

  for (const d of dependencias) {
    obtener(nodos, d.predecesoraId).salientes.push(d);
    obtener(nodos, d.sucesoraId).entrantes.push(d);
  }

  const orden = ordenarTopologicamente(nodos);
  for (const id of orden) {
    calcularHaciaAdelante(obtener(nodos, id), nodos, calendario, inicioProyecto);
  }

  const finProyecto = [...nodos.values()].reduce((fin, n) => mayor(fin, n.finTemprano), '');
  const limiteTardio = anteriorHabil(finProyecto, calendario);
  for (const id of [...orden].reverse()) {
    calcularHaciaAtras(obtener(nodos, id), nodos, calendario, limiteTardio);
  }

  const resultados = new Map<number, ResultadoTareaCronograma>();
  for (const [id, nodo] of nodos) resultados.set(id, resultadoHoja(nodo, calendario));

  const resolver = (tarea: TareaCronograma): ResultadoTareaCronograma => {
    const conocido = resultados.get(tarea.id);
    if (conocido) return conocido;
    const hijas = tareas.filter((t) => t.padreId === tarea.id).map(resolver);
    const consolidado = consolidar(tarea, hijas);
    resultados.set(tarea.id, consolidado);
    return consolidado;
  };

  return { finProyecto, tareas: tareas.map(resolver) };
}

export type LimitanteInicio =
  | { tipo: 'PROYECTO' }
  | { tipo: 'FECHA_FIJA' }
  | { tipo: 'FECHA_REAL' }
  | { tipo: 'DEPENDENCIA'; dependencia: DependenciaCronograma };

export interface PrevisionInicio {
  inicioPlan: string;
  finPlan: string;
  limitante: LimitanteInicio;
}

export function preverInicioTarea(
  tarea: TareaCronograma,
  entrantes: readonly DependenciaCronograma[],
  fechasPredecesoras: ReadonlyMap<number, { inicioPlan: string; finPlan: string }>,
  calendario: CalendarioLaboral,
  inicioProyecto: string,
): PrevisionInicio {
  if (tarea.inicioReal) {
    return {
      inicioPlan: tarea.inicioReal,
      finPlan: tarea.finReal ?? calcularFinPlan(tarea.inicioReal, tarea.duracionDias, calendario),
      limitante: { tipo: 'FECHA_REAL' },
    };
  }
  let inicio = siguienteHabil(inicioProyecto, calendario);
  let limitante: LimitanteInicio = { tipo: 'PROYECTO' };
  if (tarea.fechaFija) {
    const fija = siguienteHabil(tarea.fechaFija, calendario);
    if (fija > inicio) {
      inicio = fija;
      limitante = { tipo: 'FECHA_FIJA' };
    }
  }
  for (const d of entrantes) {
    const fechas = fechasPredecesoras.get(d.predecesoraId);
    if (!fechas) throw new RangeError(`La tarea ${d.predecesoraId} no forma parte del cronograma.`);
    const valor = restriccionHaciaAdelante(
      d,
      { inicioTemprano: fechas.inicioPlan, finTemprano: fechas.finPlan },
      tarea,
      calendario,
    );
    if (valor > inicio) {
      inicio = valor;
      limitante = { tipo: 'DEPENDENCIA', dependencia: d };
    }
  }
  return {
    inicioPlan: inicio,
    finPlan: finDesde(inicio, tarea.duracionDias, calendario),
    limitante,
  };
}
