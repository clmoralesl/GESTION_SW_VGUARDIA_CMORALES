import { memo } from 'react';
import { ActionIcon, Text } from '@mantine/core';
import { IconChevronDown, IconChevronRight, IconDiamond } from '@tabler/icons-react';
import { formatearFecha, type TareaArbol } from '@autofix/core';
import { ALTO_FILA } from './escala';
import type { FilaGantt } from './modelo-gantt';
import type { PaletaGantt } from './paleta-gantt';

interface GrillaGanttProps {
  filas: readonly FilaGantt[];
  colapsadas: ReadonlySet<number>;
  alAlternarColapso: (tareaId: number) => void;
  alSeleccionarTarea: (tarea: TareaArbol) => void;
  paleta: PaletaGantt;
  anchoGrilla: number;
  tieneFilaHitosProyecto?: boolean;
}

export const GrillaGantt = memo(function GrillaGantt({
  filas,
  colapsadas,
  alAlternarColapso,
  alSeleccionarTarea,
  paleta,
  anchoGrilla,
  tieneFilaHitosProyecto = false,
}: GrillaGanttProps) {
  return (
    <div
      style={{
        width: anchoGrilla,
        minWidth: anchoGrilla,
        maxWidth: anchoGrilla,
        position: 'sticky',
        left: 0,
        zIndex: 10,
        background: paleta.fondo,
        borderRight: `1px solid ${paleta.borde}`,
        userSelect: 'none',
      }}
    >
      {tieneFilaHitosProyecto && (
        <div
          style={{
            height: ALTO_FILA,
            display: 'grid',
            gridTemplateColumns: '70px 190px 60px 70px 70px',
            alignItems: 'center',
            padding: '0 8px',
            fontSize: 12,
            borderBottom: `1px solid ${paleta.borde}`,
            background: paleta.fondoGrilla,
            fontStyle: 'italic',
            color: paleta.textoAtenuado,
          }}
        >
          <div>—</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <IconDiamond size={14} />
            <Text size="xs" c="dimmed">
              Hitos del proyecto
            </Text>
          </div>
          <div style={{ textAlign: 'right' }}>—</div>
          <div style={{ textAlign: 'center' }}>—</div>
          <div style={{ textAlign: 'center' }}>—</div>
        </div>
      )}

      {filas.map((fila) => {
        const { tarea } = fila;
        const estaColapsada = colapsadas.has(tarea.id);
        const indentacion = tarea.nivel === 'ETAPA' ? 0 : tarea.nivel === 'ACTIVIDAD' ? 12 : 24;

        return (
          <div
            key={tarea.id}
            tabIndex={0}
            role="button"
            data-testid={`fila-tarea-${tarea.codigo}`}
            onClick={() => alSeleccionarTarea(tarea)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                alSeleccionarTarea(tarea);
              }
            }}
            style={{
              height: ALTO_FILA,
              display: 'grid',
              gridTemplateColumns: '70px 190px 60px 70px 70px',
              alignItems: 'center',
              padding: '0 8px',
              fontSize: 12,
              borderBottom: `1px solid ${paleta.borde}`,
              cursor: 'pointer',
              color: paleta.texto,
              fontWeight: fila.esResumen ? 600 : 400,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {tarea.tieneHijas ? (
                <ActionIcon
                  size="xs"
                  variant="subtle"
                  aria-label={
                    estaColapsada ? `Expandir ${tarea.codigo}` : `Colapsar ${tarea.codigo}`
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    alAlternarColapso(tarea.id);
                  }}
                >
                  {estaColapsada ? <IconChevronRight size={14} /> : <IconChevronDown size={14} />}
                </ActionIcon>
              ) : (
                <span style={{ width: 18 }} />
              )}
              <span>{tarea.codigo}</span>
            </div>

            <div
              style={{
                paddingLeft: indentacion,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={tarea.nombre}
            >
              {tarea.nombre}
            </div>

            <div style={{ textAlign: 'right' }}>{tarea.duracionDias} d</div>

            <div style={{ textAlign: 'center', fontSize: 11, color: paleta.textoAtenuado }}>
              {formatearFecha(tarea.inicioPlan) || '—'}
            </div>

            <div style={{ textAlign: 'center', fontSize: 11, color: paleta.textoAtenuado }}>
              {formatearFecha(tarea.finPlan) || '—'}
            </div>
          </div>
        );
      })}
    </div>
  );
});
