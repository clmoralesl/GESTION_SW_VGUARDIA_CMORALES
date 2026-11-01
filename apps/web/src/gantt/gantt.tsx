import { useCallback, useEffect, useRef, useState } from 'react';
import { sumarDiasHabiles, type CalendarioLaboral, type TareaArbol } from '@autofix/core';
import { duracionAlEstirar, inicioAlMover } from './arrastre';
import { BarraTarea, type ModoArrastre } from './barra-tarea';
import { EncabezadoTiempo } from './encabezado-tiempo';
import { ALTO_FILA, bordesBarra, type NivelZoom } from './escala';
import { ANCHO_GRILLA } from './exportar';
import { FlechaDependencia } from './flecha-dependencia';
import { GrillaGantt } from './grilla-gantt';
import type { ModeloGantt } from './modelo-gantt';
import type { PaletaGantt } from './paleta-gantt';
import { RomboHito } from './rombo-hito';

export interface PrevisionArrastre {
  inicioPlan: string;
  finPlan: string;
  esInvalido: boolean;
}

interface GanttProps {
  modelo: ModeloGantt;
  colapsadas: ReadonlySet<number>;
  alAlternarColapso: (tareaId: number) => void;
  alSeleccionarTarea: (tarea: TareaArbol) => void;
  lineaBaseActiva: boolean;
  rutaCriticaActiva: boolean;
  puedeEditar: boolean;
  ocupado?: boolean;
  motivoBloqueo?: string | null;
  alMoverTarea: (tarea: TareaArbol, fechaPropuesta: string) => void;
  alEstirarTarea: (tarea: TareaArbol, nuevaDuracion: number) => void;
  prever?: (
    tarea: TareaArbol,
    cambios: { fechaPropuesta?: string; nuevaDuracion?: number },
  ) => PrevisionArrastre;
  calendario: CalendarioLaboral;
  paleta: PaletaGantt;
  zoom: NivelZoom;
  anchoGrilla?: number;
  contenedorRef?: React.RefObject<HTMLDivElement | null>;
  svgRef?: React.RefObject<SVGSVGElement | null>;
  tareaSeleccionadaId?: number | null;
}

interface EstadoArrastre {
  tarea: TareaArbol;
  modo: ModoArrastre;
  origenX: number;
  deltaPx: number;
  inicioOriginal: string;
  finOriginal: string;
  pointerId: number;
  target: Element;
}

interface FantasmaArrastre {
  x: number;
  ancho: number;
  y: number;
  texto: string;
  esInvalido?: boolean;
}

export function Gantt({
  modelo,
  colapsadas,
  alAlternarColapso,
  alSeleccionarTarea,
  lineaBaseActiva,
  rutaCriticaActiva,
  puedeEditar,
  ocupado = false,
  motivoBloqueo,
  alMoverTarea,
  alEstirarTarea,
  prever,
  calendario,
  paleta,
  zoom,
  anchoGrilla = ANCHO_GRILLA,
  contenedorRef,
  svgRef,
  tareaSeleccionadaId,
}: GanttProps) {
  const estadoArrastreRef = useRef<EstadoArrastre | null>(null);
  const [fantasma, setFantasma] = useState<FantasmaArrastre | null>(null);

  const cancelarArrastre = useCallback(() => {
    estadoArrastreRef.current = null;
    setFantasma(null);
  }, []);

  useEffect(() => {
    cancelarArrastre();
  }, [modelo.escala.pxPorDia, modelo.escala.rango.inicio, cancelarArrastre]);

  const totalFilas = modelo.filas.length + (modelo.tieneFilaHitosProyecto ? 1 : 0);
  const altoSvg = Math.max(ALTO_FILA, totalFilas * ALTO_FILA);

  const handleIniciarArrastre = useCallback(
    (e: React.PointerEvent, tarea: TareaArbol, modo: ModoArrastre) => {
      if (!puedeEditar || ocupado) return;
      if (!tarea.inicioPlan || !tarea.finPlan) return;

      e.preventDefault();
      const target = e.currentTarget;
      try {
        target.setPointerCapture(e.pointerId);
      } catch (_error) {
        void _error;
      }

      estadoArrastreRef.current = {
        tarea,
        modo,
        origenX: e.clientX,
        deltaPx: 0,
        inicioOriginal: tarea.inicioPlan,
        finOriginal: tarea.finPlan,
        pointerId: e.pointerId,
        target,
      };
    },
    [puedeEditar, ocupado],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!estadoArrastreRef.current) return;
      const arrastre = estadoArrastreRef.current;
      const deltaPx = e.clientX - arrastre.origenX;
      arrastre.deltaPx = deltaPx;

      if (Math.abs(deltaPx) < 3) {
        setFantasma(null);
        return;
      }

      const filaObj = modelo.filas.find((f) => f.tarea.id === arrastre.tarea.id);
      const yFila = filaObj ? filaObj.y : 0;

      if (arrastre.modo === 'mover') {
        const fechaPropuesta = inicioAlMover(
          arrastre.inicioOriginal,
          deltaPx,
          modelo.escala.pxPorDia,
          calendario,
        );
        const prev = prever ? prever(arrastre.tarea, { fechaPropuesta }) : null;
        const inicioVisual = prev && !prev.esInvalido ? prev.inicioPlan : fechaPropuesta;
        const finVisual =
          prev && !prev.esInvalido
            ? prev.finPlan
            : sumarDiasHabiles(fechaPropuesta, arrastre.tarea.duracionDias - 1, calendario);
        const bordes = bordesBarra(
          {
            inicioPlan: inicioVisual,
            finPlan: finVisual,
            duracionDias: arrastre.tarea.duracionDias,
          },
          modelo.escala,
        );
        setFantasma({
          x: bordes.xInicio,
          ancho: Math.max(1, bordes.xFin - bordes.xInicio),
          y: yFila,
          texto: fechaPropuesta,
          esInvalido: prev?.esInvalido ?? false,
        });
      } else if (arrastre.modo === 'estirar') {
        const duracionPropuesta = duracionAlEstirar(
          arrastre.inicioOriginal,
          arrastre.finOriginal,
          deltaPx,
          modelo.escala.pxPorDia,
          calendario,
        );
        const prev = prever ? prever(arrastre.tarea, { nuevaDuracion: duracionPropuesta }) : null;
        const inicioVisual = prev ? prev.inicioPlan : arrastre.inicioOriginal;
        const finVisual = prev
          ? prev.finPlan
          : sumarDiasHabiles(arrastre.inicioOriginal, duracionPropuesta - 1, calendario);
        const bordes = bordesBarra(
          {
            inicioPlan: inicioVisual,
            finPlan: finVisual,
            duracionDias: duracionPropuesta,
          },
          modelo.escala,
        );
        setFantasma({
          x: bordes.xInicio,
          ancho: Math.max(1, bordes.xFin - bordes.xInicio),
          y: yFila,
          texto: `${duracionPropuesta} d`,
          esInvalido: false,
        });
      }
    },
    [modelo, calendario, prever],
  );

  const handlePointerUp = useCallback(
    (_e: React.PointerEvent) => {
      void _e;
      if (!estadoArrastreRef.current) return;
      const arrastre = estadoArrastreRef.current;

      try {
        arrastre.target.releasePointerCapture(arrastre.pointerId);
      } catch (_error) {
        void _error;
      }

      setFantasma(null);
      estadoArrastreRef.current = null;

      if (Math.abs(arrastre.deltaPx) < 3) return;

      if (arrastre.modo === 'mover') {
        const fechaPropuesta = inicioAlMover(
          arrastre.inicioOriginal,
          arrastre.deltaPx,
          modelo.escala.pxPorDia,
          calendario,
        );
        if (fechaPropuesta !== arrastre.inicioOriginal) {
          alMoverTarea(arrastre.tarea, fechaPropuesta);
        }
      } else if (arrastre.modo === 'estirar') {
        const duracionPropuesta = duracionAlEstirar(
          arrastre.inicioOriginal,
          arrastre.finOriginal,
          arrastre.deltaPx,
          modelo.escala.pxPorDia,
          calendario,
        );
        if (duracionPropuesta !== arrastre.tarea.duracionDias) {
          alEstirarTarea(arrastre.tarea, duracionPropuesta);
        }
      }
    },
    [modelo, calendario, alMoverTarea, alEstirarTarea],
  );

  return (
    <div
      ref={contenedorRef}
      data-testid="contenedor-gantt"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          cancelarArrastre();
        }
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={cancelarArrastre}
      onLostPointerCapture={cancelarArrastre}
      style={{
        overflow: 'auto',
        maxHeight: 'calc(100vh - 200px)',
        border: `1px solid ${paleta.borde}`,
        borderRadius: 4,
        background: paleta.fondo,
        position: 'relative',
        outline: 'none',
        cursor: ocupado ? 'progress' : 'default',
      }}
    >
      <EncabezadoTiempo
        escala={modelo.escala}
        zoom={zoom}
        paleta={paleta}
        anchoGrilla={anchoGrilla}
      />

      <div style={{ display: 'flex', width: anchoGrilla + modelo.escala.ancho }}>
        <GrillaGantt
          filas={modelo.filas}
          colapsadas={colapsadas}
          alAlternarColapso={alAlternarColapso}
          alSeleccionarTarea={alSeleccionarTarea}
          paleta={paleta}
          anchoGrilla={anchoGrilla}
          tieneFilaHitosProyecto={modelo.tieneFilaHitosProyecto}
          tareaSeleccionadaId={tareaSeleccionadaId}
        />

        <div style={{ width: modelo.escala.ancho, position: 'relative' }}>
          <svg
            ref={svgRef}
            width={modelo.escala.ancho}
            height={altoSvg}
            style={{ display: 'block', overflow: 'visible' }}
          >
            <defs>
              <marker
                id="flecha-punta"
                viewBox="0 0 10 10"
                refX="7"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 8 5 L 0 9 z" fill={paleta.flecha} />
              </marker>
              <marker
                id="flecha-punta-critica"
                viewBox="0 0 10 10"
                refX="7"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 8 5 L 0 9 z" fill={paleta.flechaCritica} />
              </marker>
              <pattern
                id="trama-atraso"
                width="8"
                height="8"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="8"
                  stroke={paleta.fondo}
                  strokeWidth="2"
                  opacity="0.4"
                />
              </pattern>
            </defs>

            <rect x={0} y={0} width={modelo.escala.ancho} height={altoSvg} fill={paleta.fondo} />

            {modelo.diasNoHabiles.map((d, i) => (
              <rect
                key={i}
                x={d.x}
                y={0}
                width={d.ancho}
                height={altoSvg}
                fill={paleta.fondoNoHabil}
              >
                {d.feriado && <title>{d.feriado}</title>}
              </rect>
            ))}

            {modelo.filas.map((f, i) => (
              <line
                key={i}
                x1={0}
                y1={f.y + ALTO_FILA}
                x2={modelo.escala.ancho}
                y2={f.y + ALTO_FILA}
                stroke={paleta.borde}
                strokeWidth={1}
              />
            ))}

            <line
              x1={modelo.xHoy}
              y1={0}
              x2={modelo.xHoy}
              y2={altoSvg}
              stroke={paleta.lineaHoy}
              strokeWidth={2}
              strokeDasharray="4 2"
              data-testid="linea-hoy"
            >
              <title>{`Hoy: ${modelo.hoy}`}</title>
            </line>

            {modelo.flechas.map((flecha) => (
              <FlechaDependencia
                key={flecha.id}
                flecha={flecha}
                esCritica={flecha.esCritica}
                rutaCriticaActiva={rutaCriticaActiva}
                paleta={paleta}
              />
            ))}

            {modelo.filas.map((fila) => (
              <BarraTarea
                key={fila.tarea.id}
                fila={fila}
                lineaBaseActiva={lineaBaseActiva}
                rutaCriticaActiva={rutaCriticaActiva}
                puedeEditar={puedeEditar}
                motivoBloqueo={motivoBloqueo}
                alIniciarArrastre={handleIniciarArrastre}
                paleta={paleta}
              />
            ))}

            {modelo.hitos.map((hito) => {
              const yHito =
                hito.filaIndex === null
                  ? ALTO_FILA / 2
                  : (modelo.filas[hito.filaIndex]?.y ?? 0) + ALTO_FILA / 2;

              return <RomboHito key={hito.id} hito={hito} y={yHito} paleta={paleta} />;
            })}

            {fantasma && (
              <g pointerEvents="none" opacity={0.85}>
                <rect
                  x={fantasma.x}
                  y={fantasma.y + (ALTO_FILA - ALTO_FILA * 0.6) / 2}
                  width={fantasma.ancho}
                  height={ALTO_FILA * 0.6}
                  fill={fantasma.esInvalido ? 'rgba(224, 49, 49, 0.2)' : 'rgba(34, 139, 230, 0.25)'}
                  stroke={fantasma.esInvalido ? '#e03131' : paleta.barraNormal}
                  strokeWidth={fantasma.esInvalido ? 2 : 1.5}
                  strokeDasharray="4 2"
                  rx={3}
                />
                <text
                  x={fantasma.x + fantasma.ancho / 2}
                  y={fantasma.y + ALTO_FILA / 2 + 4}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={600}
                  fill={fantasma.esInvalido ? '#e03131' : paleta.texto}
                >
                  {fantasma.texto}
                </text>
              </g>
            )}
          </svg>
        </div>
      </div>
    </div>
  );
}
