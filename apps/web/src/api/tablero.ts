import { useQuery } from '@tanstack/react-query';
import type { ConsultaTablero, TableroProyecto } from '@autofix/core';
import { solicitar } from './cliente-api';

function armarQueryString(filtros: ConsultaTablero): string {
  const params = new URLSearchParams();
  if (filtros.etapaId !== undefined) params.set('etapaId', String(filtros.etapaId));
  if (filtros.profesionalId !== undefined)
    params.set('profesionalId', String(filtros.profesionalId));
  if (filtros.desde !== undefined && filtros.desde !== '') params.set('desde', filtros.desde);
  if (filtros.hasta !== undefined && filtros.hasta !== '') params.set('hasta', filtros.hasta);
  const q = params.toString();
  return q ? `?${q}` : '';
}

export function useTablero(proyectoId: number | null, filtros: ConsultaTablero = {}) {
  const queryStr = armarQueryString(filtros);
  return useQuery<TableroProyecto>({
    queryKey: ['tablero', proyectoId, filtros],
    queryFn: ({ signal }) =>
      solicitar<TableroProyecto>(`/proyectos/${proyectoId}/tablero${queryStr}`, { signal }),
    enabled: Boolean(proyectoId),
    staleTime: 10_000,
  });
}
