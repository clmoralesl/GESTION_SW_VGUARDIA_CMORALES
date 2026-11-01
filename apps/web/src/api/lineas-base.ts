import { useQuery } from '@tanstack/react-query';
import type {
  ComparacionLineasBase,
  LineaBaseGantt,
  LineaBaseVigente,
  RespuestaListaLineasBase,
} from '@autofix/core';
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

export function useLineasBase(proyectoId: number | null) {
  return useQuery<RespuestaListaLineasBase>({
    queryKey: ['lineas-base', proyectoId],
    queryFn: ({ signal }) =>
      solicitar<RespuestaListaLineasBase>(`/proyectos/${proyectoId}/lineas-base`, { signal }),
    enabled: proyectoId !== null && !Number.isNaN(proyectoId) && proyectoId > 0,
    staleTime: 15_000,
  });
}

export function useLineaBasePorVersion(proyectoId: number | null, version: number | null) {
  return useQuery<LineaBaseGantt>({
    queryKey: ['lineas-base', proyectoId, version],
    queryFn: ({ signal }) =>
      solicitar<LineaBaseGantt>(`/proyectos/${proyectoId}/lineas-base/${version}`, { signal }),
    enabled:
      proyectoId !== null &&
      !Number.isNaN(proyectoId) &&
      proyectoId > 0 &&
      version !== null &&
      !Number.isNaN(version) &&
      version > 0,
    staleTime: 30_000,
  });
}

export function useCompararLineasBase(
  proyectoId: number | null,
  versionA: number | null,
  versionB: number | null,
) {
  return useQuery<ComparacionLineasBase>({
    queryKey: ['lineas-base', proyectoId, 'comparar', versionA, versionB],
    queryFn: ({ signal }) =>
      solicitar<ComparacionLineasBase>(
        `/proyectos/${proyectoId}/lineas-base/comparar?a=${versionA}&b=${versionB}`,
        { signal },
      ),
    enabled:
      proyectoId !== null &&
      !Number.isNaN(proyectoId) &&
      proyectoId > 0 &&
      versionA !== null &&
      !Number.isNaN(versionA) &&
      versionA > 0 &&
      versionB !== null &&
      !Number.isNaN(versionB) &&
      versionB > 0 &&
      versionA !== versionB,
    staleTime: 30_000,
  });
}
