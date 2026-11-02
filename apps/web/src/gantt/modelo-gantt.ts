import {
  calendarioLaboralDe,
  diasCorridosEntre,
  diasDeAtraso,
  esHabil,
  estaAtrasada,
  sumarDiasCorridos,
  type CalendarioLaboral,
  type CalendarioProyecto,
  type DependenciaTarea,
  type EstadoHito,
  type HitoConEstado,
  type LineaBaseGantt,
  type TareaArbol,
  type TipoDependencia,
} from '@autofix/core';
import { COLOR_ESTADO_HITO } from '../hitos/estado-hito';
import { filasVisibles } from '../tareas/filas-visibles';
import {
  ALTO_FILA,
  bordesBarra,
  calcularRango,
  crearEscala,
  PX_POR_DIA,
  type BordesBarra,
  type Escala,
  type NivelZoom,
} from './escala';
import { rutaFlecha, trazoSvg, type Punto } from './flechas';

export interface FilaGantt {
  tarea: TareaArbol;
  indice: number;
  y: number;
  esResumen: boolean;
  barra: BordesBarra | null;
  lineaBase: BordesBarra | null;
  lineaBaseFechas?: { inicioPlan: string; finPlan: string } | null;
  avance: number;
  esCritica: boolean;
  estaAtrasada: boolean;
  diasAtraso: number;
}

export interface FlechaGantt {
  id: number;
  tipo: TipoDependencia;
  predecesoraId: number;
  sucesoraId: number;
  desfaseDias: number;
  puntos: Punto[];
  trazo: string;
  esCritica: boolean;
}

export interface HitoGantt {
  id: number;
  nombre: string;
  fechaObjetivo: string;
  estado: EstadoHito;
  color: string;
  x: number;
  filaIndex: number | null;
  tareaCodigo: string | null;
}

export interface DiaNoHabilGantt {
  x: number;
  ancho: number;
  feriado: string | null;
}

export interface ModeloGantt {
  escala: Escala;
  filas: FilaGantt[];
  flechas: FlechaGantt[];
  hitos: HitoGantt[];
  hoy: string;
  xHoy: number;
  diasNoHabiles: DiaNoHabilGantt[];
  tieneFilaHitosProyecto: boolean;
}

export interface OpcionesConstruirModeloGantt {
  tareas: readonly TareaArbol[];
  colapsadas: ReadonlySet<number>;
  dependencias: readonly DependenciaTarea[];
  hitos: readonly HitoConEstado[];
  lineaBase: LineaBaseGantt | null;
  calendario: CalendarioProyecto | CalendarioLaboral;
  hoy: string;
  zoom: NivelZoom;
  rutaCriticaActiva: boolean;
}

export function construirModeloGantt(opciones: OpcionesConstruirModeloGantt): ModeloGantt {
  const { tareas, colapsadas, dependencias, hitos, lineaBase, calendario, hoy, zoom } = opciones;

  const pxPorDia = PX_POR_DIA[zoom];

  const todasLasFechas: (string | null)[] = [hoy];
  for (const t of tareas) {
    todasLasFechas.push(t.inicioPlan, t.finPlan);
  }
  for (const h of hitos) {
    todasLasFechas.push(h.fechaObjetivo);
  }
  if (lineaBase) {
    for (const t of lineaBase.tareas) {
      todasLasFechas.push(t.inicioPlan, t.finPlan);
    }
  }

  const rangoCalculado = calcularRango(todasLasFechas);
  const rango = rangoCalculado ?? { inicio: hoy, fin: hoy };
  const escala = crearEscala(rango, pxPorDia);
  const xHoy = escala.xDe(hoy) + escala.pxPorDia / 2;

  const calLaboral: CalendarioLaboral =
    'diasLaborables' in calendario &&
    Array.isArray((calendario as CalendarioProyecto).diasLaborables)
      ? calendarioLaboralDe(calendario as CalendarioProyecto)
      : (calendario as CalendarioLaboral);

  const feriadosMap = new Map<string, string>();
  if ('feriados' in calendario && Array.isArray((calendario as CalendarioProyecto).feriados)) {
    for (const f of (calendario as CalendarioProyecto).feriados) {
      feriadosMap.set(f.fecha, f.descripcion);
    }
  }

  const visibles = filasVisibles(tareas, colapsadas);
  const tieneFilaHitosProyecto = hitos.some((h) => h.tarea === null);
  const filaOffset = tieneFilaHitosProyecto ? 1 : 0;

  const mapaFilas = new Map<number, number>();
  const tareasPorId = new Map<number, TareaArbol>(tareas.map((t) => [t.id, t]));
  const mapaLineaBase = new Map(
    lineaBase?.tareas.filter((t) => t.tareaId !== null).map((t) => [t.tareaId!, t]) ?? [],
  );

  const filas: FilaGantt[] = visibles.map((t, indice) => {
    mapaFilas.set(t.id, indice);
    const y = (indice + filaOffset) * ALTO_FILA;
    const barra =
      t.inicioPlan && t.finPlan
        ? bordesBarra(
            { inicioPlan: t.inicioPlan, finPlan: t.finPlan, duracionDias: t.duracionDias },
            escala,
          )
        : null;

    const lb = mapaLineaBase.get(t.id);
    const lbBarra =
      lb && lb.inicioPlan && lb.finPlan
        ? bordesBarra(
            { inicioPlan: lb.inicioPlan, finPlan: lb.finPlan, duracionDias: lb.duracionDias },
            escala,
          )
        : null;

    return {
      tarea: t,
      indice,
      y,
      esResumen: t.tieneHijas,
      barra,
      lineaBase: lbBarra,
      lineaBaseFechas:
        lb && lb.inicioPlan && lb.finPlan
          ? { inicioPlan: lb.inicioPlan, finPlan: lb.finPlan }
          : null,
      avance: Number(t.porcentajeAvance),
      esCritica: t.esCritica,
      estaAtrasada: estaAtrasada(t, hoy),
      diasAtraso: diasDeAtraso(t, hoy, calLaboral),
    };
  });

  const flechas: FlechaGantt[] = [];
  for (const d of dependencias) {
    const filaPred = mapaFilas.get(d.predecesoraId);
    const filaSuc = mapaFilas.get(d.sucesoraId);
    if (filaPred === undefined || filaSuc === undefined) continue;

    const barraPred = filas[filaPred]?.barra;
    const barraSuc = filas[filaSuc]?.barra;
    if (!barraPred || !barraSuc) continue;

    const esCritica = Boolean(filas[filaPred]?.esCritica && filas[filaSuc]?.esCritica);

    const puntos = rutaFlecha(
      d.tipo,
      barraPred,
      barraSuc,
      filaPred + filaOffset,
      filaSuc + filaOffset,
      ALTO_FILA,
    );
    const trazo = trazoSvg(puntos);
    flechas.push({
      id: d.id,
      tipo: d.tipo,
      predecesoraId: d.predecesoraId,
      sucesoraId: d.sucesoraId,
      desfaseDias: d.desfaseDias,
      puntos,
      trazo,
      esCritica,
    });
  }

  const hitosGantt: HitoGantt[] = [];
  for (const h of hitos) {
    let filaIndex: number | null = null;
    if (h.tarea) {
      let actualId: number | null = h.tarea.id;
      while (actualId !== null) {
        if (mapaFilas.has(actualId)) {
          filaIndex = mapaFilas.get(actualId)!;
          break;
        }
        actualId = tareasPorId.get(actualId)?.padreId ?? null;
      }
    }

    if (filaIndex === null && !tieneFilaHitosProyecto) {
      continue;
    }

    hitosGantt.push({
      id: h.id,
      nombre: h.nombre,
      fechaObjetivo: h.fechaObjetivo,
      estado: h.estado,
      color: COLOR_ESTADO_HITO[h.estado],
      x: escala.xDe(h.fechaObjetivo) + escala.pxPorDia / 2,
      filaIndex,
      tareaCodigo: h.tarea?.codigo ?? null,
    });
  }

  const diasNoHabiles: DiaNoHabilGantt[] = [];
  if (zoom !== 'MES') {
    const totalDias = diasCorridosEntre(rango.inicio, rango.fin);
    for (let i = 0; i <= totalDias; i += 1) {
      const fecha = sumarDiasCorridos(rango.inicio, i);
      if (!esHabil(fecha, calLaboral)) {
        diasNoHabiles.push({
          x: escala.xDe(fecha),
          ancho: escala.pxPorDia,
          feriado: feriadosMap.get(fecha) ?? null,
        });
      }
    }
  }

  return {
    escala,
    filas,
    flechas,
    hitos: hitosGantt,
    hoy,
    xHoy,
    diasNoHabiles,
    tieneFilaHitosProyecto,
  };
}
