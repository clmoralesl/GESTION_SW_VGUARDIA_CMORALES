import { useQuery } from '@tanstack/react-query';
import type { LineaBaseVigente } from '@autofix/core';
import { solicitar } from './cliente-api';

export function useLineaBaseVigente(proyectoId: number | null) {
  return useQuery<LineaBaseVigente>({
    queryKey: ['lineas-base', proyectoId, 'vigente'],
    queryFn: ({ signal }) =>
      solicitar<LineaBaseVigente>(`/proyectos/${proyectoId}/lineas-base/vigente`, { signal }),
    enabled: proyectoId !== null && !Number.isNaN(proyectoId) && proyectoId > 0,
    staleTime: 30_000,
  });
}
