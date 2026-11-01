import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  esquemaConsultaTableroCambio,
  type ConsultaTableroCambio,
  type TableroCambio,
} from '@autofix/core';
import { solicitar } from './cliente-api';

function armarQueryString(filtros: ConsultaTableroCambio): string {
  const params = new URLSearchParams();
  if (filtros.prioridad) params.set('prioridad', filtros.prioridad);
  if (filtros.categoria) params.set('categoria', filtros.categoria);
  if (filtros.nivelRiesgo) params.set('nivelRiesgo', filtros.nivelRiesgo);
  if (filtros.responsable && filtros.responsable.trim() !== '') {
    params.set('responsable', filtros.responsable.trim());
  }
  if (filtros.desde) params.set('desde', filtros.desde);
  if (filtros.hasta) params.set('hasta', filtros.hasta);
  const q = params.toString();
  return q ? `?${q}` : '';
}

export function useTableroCambio(proyectoId: number | null, filtros: ConsultaTableroCambio = {}) {
  const queryStr = armarQueryString(filtros);
  return useQuery<TableroCambio>({
    queryKey: ['tablero', 'cambio', proyectoId, filtros],
    queryFn: ({ signal }) =>
      solicitar<TableroCambio>(`/proyectos/${proyectoId}/tablero-cambio${queryStr}`, { signal }),
    enabled: Boolean(proyectoId) && esquemaConsultaTableroCambio.safeParse(filtros).success,
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  });
}
