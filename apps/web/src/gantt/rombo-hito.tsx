import { memo } from 'react';
import { formatearFecha } from '@autofix/core';
import type { HitoGantt } from './modelo-gantt';
import type { PaletaGantt } from './paleta-gantt';

interface RomboHitoProps {
  hito: HitoGantt;
  y: number;
  paleta: PaletaGantt;
}

export const RomboHito = memo(function RomboHito({ hito, y, paleta }: RomboHitoProps) {
  const r = 7;
  const puntos = `${hito.x},${y - r} ${hito.x + r},${y} ${hito.x},${y + r} ${hito.x - r},${y}`;
  const color = paleta.hitos[hito.estado] || hito.color;

  return (
    <g data-testid={`rombo-hito-${hito.id}`}>
      <polygon
        points={puntos}
        fill={color}
        stroke={paleta.fondo}
        strokeWidth={1.5}
        style={{ cursor: 'pointer' }}
      >
        <title>{`${hito.nombre} — ${hito.estado} (${formatearFecha(hito.fechaObjetivo)})`}</title>
      </polygon>
    </g>
  );
});
