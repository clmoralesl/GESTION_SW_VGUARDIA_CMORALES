import { memo } from 'react';
import { formatearFecha, type TareaArbol } from '@autofix/core';
import { ALTO_FILA } from './escala';
import type { FilaGantt } from './modelo-gantt';
import type { PaletaGantt } from './paleta-gantt';

export type ModoArrastre = 'mover' | 'estirar';

interface BarraTareaProps {
  fila: FilaGantt;
  lineaBaseActiva: boolean;
  rutaCriticaActiva: boolean;
  puedeEditar: boolean;
  motivoBloqueo?: string | null;
  alIniciarArrastre: (e: React.PointerEvent, tarea: TareaArbol, modo: ModoArrastre) => void;
  paleta: PaletaGantt;
}

export const BarraTarea = memo(function BarraTarea({
  fila,
  lineaBaseActiva,
  rutaCriticaActiva,
  puedeEditar,
  motivoBloqueo,
  alIniciarArrastre,
  paleta,
}: BarraTareaProps) {
  const {
    tarea,
    barra,
    lineaBase,
    lineaBaseFechas,
    esResumen,
    esCritica,
    estaAtrasada,
    avance,
    y,
  } = fila;

  if (!barra) return null;

  const ancho = Math.max(1, barra.xFin - barra.xInicio);
  const anchoAvance = Math.max(0, Math.min(ancho, (ancho * avance) / 100));

  const puedeMover =
    puedeEditar && !esResumen && tarea.inicioReal === null && tarea.finReal === null;
  const puedeEstirar =
    puedeEditar && !esResumen && tarea.duracionDias > 0 && tarea.finReal === null;

  const textoAria = `${tarea.codigo} ${tarea.nombre}, del ${formatearFecha(tarea.inicioPlan)} al ${formatearFecha(tarea.finPlan)}, avance ${Math.round(avance)}%, ${esCritica ? 'crítica' : 'no crítica'}`;
  const textoAriaLineaBase = lineaBaseFechas
    ? `Línea base ${tarea.codigo}: del ${formatearFecha(lineaBaseFechas.inicioPlan)} al ${formatearFecha(lineaBaseFechas.finPlan)}`
    : `Línea base: ${tarea.codigo}`;

  const sufijoBloqueo = !puedeEditar && motivoBloqueo ? `\nBloqueado: ${motivoBloqueo}` : '';
  const tituloTooltip = `${tarea.codigo} ${tarea.nombre}\nInicio: ${formatearFecha(tarea.inicioPlan)} | Fin: ${formatearFecha(tarea.finPlan)}\nDuración: ${tarea.duracionDias} d | Avance: ${avance}%\n${esCritica ? 'Crítica' : 'Holgura: ' + tarea.holguraDias + ' d'}${estaAtrasada ? '\nAtrasada: ' + fila.diasAtraso + ' días' : ''}${sufijoBloqueo}`;

  if (esResumen) {
    const alto = ALTO_FILA * 0.4;
    const yBarra = y + (ALTO_FILA - alto) / 2;
    const hTriangulo = 5;

    return (
      <g
        data-testid={`barra-resumen-${tarea.codigo}`}
        aria-label={textoAria}
        opacity={rutaCriticaActiva && !esCritica ? 0.4 : 1}
      >
        <title>{tituloTooltip}</title>
        <path
          d={`M ${barra.xInicio} ${yBarra} L ${barra.xFin} ${yBarra} L ${barra.xFin} ${yBarra + alto} L ${barra.xFin - hTriangulo} ${yBarra + alto - 2} L ${barra.xInicio + hTriangulo} ${yBarra + alto - 2} L ${barra.xInicio} ${yBarra + alto} Z`}
          fill={paleta.barraResumen}
        />
        {anchoAvance > 0 && (
          <rect
            x={barra.xInicio}
            y={yBarra}
            width={anchoAvance}
            height={alto - 2}
            fill={paleta.barraResumenAvance}
          />
        )}
        <text
          x={barra.xFin + 6}
          y={yBarra + alto - 1}
          fontSize={10}
          fill={paleta.textoAtenuado}
          fontWeight={600}
        >
          {`${Math.round(avance)}%`}
        </text>

        {lineaBaseActiva && lineaBase && (
          <rect
            x={lineaBase.xInicio}
            y={y + ALTO_FILA - 5}
            width={Math.max(1, lineaBase.xFin - lineaBase.xInicio)}
            height={4}
            fill={paleta.barraLineaBase}
            rx={1}
            data-testid={`linea-base-${tarea.codigo}`}
            aria-label={textoAriaLineaBase}
          >
            <title>{`Línea base: ${tarea.codigo}`}</title>
          </rect>
        )}
      </g>
    );
  }

  if (tarea.duracionDias === 0) {
    const r = 5;
    const cy = y + ALTO_FILA / 2;
    const puntos = `${barra.xInicio},${cy - r} ${barra.xInicio + r},${cy} ${barra.xInicio},${cy + r} ${barra.xInicio - r},${cy}`;

    return (
      <g
        data-testid={`barra-tarea-${tarea.codigo}`}
        aria-label={textoAria}
        opacity={rutaCriticaActiva && !esCritica ? 0.4 : 1}
      >
        <title>{tituloTooltip}</title>
        <polygon
          points={puntos}
          fill={paleta.barraNormal}
          stroke={paleta.fondo}
          strokeWidth={1}
          style={{ cursor: puedeMover ? 'ew-resize' : 'default' }}
          data-arrastrable={puedeMover ? 'true' : undefined}
          onPointerDown={(e) => {
            if (puedeMover) alIniciarArrastre(e, tarea, 'mover');
          }}
        />
      </g>
    );
  }

  const alto = ALTO_FILA * 0.6;
  const yBarra = y + (ALTO_FILA - alto) / 2;
  const colorBase = estaAtrasada ? paleta.barraAtrasada : paleta.barraNormal;
  const colorAvance = estaAtrasada ? paleta.barraAtrasadaAvance : paleta.barraNormalAvance;
  const strokeCritica = esCritica && rutaCriticaActiva ? paleta.contornoCritica : 'none';
  const strokeWidth = esCritica && rutaCriticaActiva ? 2 : 0;

  return (
    <g
      data-testid={`barra-tarea-${tarea.codigo}`}
      aria-label={textoAria}
      opacity={rutaCriticaActiva && !esCritica ? 0.4 : 1}
    >
      <title>{tituloTooltip}</title>

      <rect
        x={barra.xInicio}
        y={yBarra}
        width={ancho}
        height={alto}
        fill={colorBase}
        rx={3}
        stroke={strokeCritica}
        strokeWidth={strokeWidth}
        style={{ cursor: puedeMover ? 'grab' : 'default' }}
        data-arrastrable={puedeMover ? 'true' : undefined}
        onPointerDown={(e) => {
          if (puedeMover) alIniciarArrastre(e, tarea, 'mover');
        }}
      />

      {estaAtrasada && (
        <rect
          x={barra.xInicio}
          y={yBarra}
          width={ancho}
          height={alto}
          fill="url(#trama-atraso)"
          rx={3}
          pointerEvents="none"
        />
      )}

      {anchoAvance > 0 && (
        <rect
          x={barra.xInicio}
          y={yBarra}
          width={anchoAvance}
          height={alto}
          fill={colorAvance}
          rx={3}
          pointerEvents="none"
        />
      )}

      {puedeEstirar && (
        <rect
          x={barra.xFin - 8}
          y={yBarra}
          width={10}
          height={alto}
          fill="transparent"
          style={{ cursor: 'col-resize' }}
          data-asa-estirar="true"
          data-arrastrable="true"
          onPointerDown={(e) => {
            e.stopPropagation();
            alIniciarArrastre(e, tarea, 'estirar');
          }}
        />
      )}

      <text x={barra.xFin + 6} y={yBarra + alto / 2 + 4} fontSize={10} fill={paleta.textoAtenuado}>
        {`${Math.round(avance)}%`}
      </text>

      {lineaBaseActiva && lineaBase && (
        <rect
          x={lineaBase.xInicio}
          y={y + ALTO_FILA - 5}
          width={Math.max(1, lineaBase.xFin - lineaBase.xInicio)}
          height={4}
          fill={paleta.barraLineaBase}
          rx={1}
          data-testid={`linea-base-${tarea.codigo}`}
          aria-label={textoAriaLineaBase}
        >
          <title>{`Línea base: ${tarea.codigo}`}</title>
        </rect>
      )}
    </g>
  );
});
