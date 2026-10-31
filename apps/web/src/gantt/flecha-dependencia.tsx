import { memo } from 'react';
import type { FlechaGantt } from './modelo-gantt';
import type { PaletaGantt } from './paleta-gantt';

interface FlechaDependenciaProps {
  flecha: FlechaGantt;
  esCritica: boolean;
  rutaCriticaActiva: boolean;
  paleta: PaletaGantt;
}

export const FlechaDependencia = memo(function FlechaDependencia({
  flecha,
  esCritica,
  rutaCriticaActiva,
  paleta,
}: FlechaDependenciaProps) {
  const destacada = esCritica && rutaCriticaActiva;
  const color = destacada ? paleta.flechaCritica : paleta.flecha;
  const anchoTrazo = destacada ? 2 : 1.5;
  const markerId = destacada ? 'url(#flecha-punta-critica)' : 'url(#flecha-punta)';

  return (
    <path
      d={flecha.trazo}
      fill="none"
      stroke={color}
      strokeWidth={anchoTrazo}
      markerEnd={markerId}
      data-testid={`flecha-${flecha.predecesoraId}-${flecha.sucesoraId}`}
      opacity={rutaCriticaActiva && !esCritica ? 0.4 : 1}
    />
  );
});
