import { useQuery } from '@tanstack/react-query';
import type { ConsultaBitacora, ParametrosPaginacion, RespuestaBitacora } from '@autofix/core';
import { solicitar } from './cliente-api';

function construirParametrosBitacora(consulta: Partial<ConsultaBitacora>): string {
  const params = new URLSearchParams();
  if (consulta.proyectoId !== undefined && consulta.proyectoId !== null) {
    params.set('proyectoId', String(consulta.proyectoId));
  }
  if (consulta.entidad) {
    params.set('entidad', consulta.entidad);
  }
  if (consulta.entidadId !== undefined && consulta.entidadId !== null) {
    params.set('entidadId', String(consulta.entidadId));
  }
  if (consulta.rol) {
    params.set('rol', consulta.rol);
  }
  if (consulta.accion) {
    params.set('accion', consulta.accion);
  }
  if (consulta.desde) {
    params.set('desde', consulta.desde);
  }
  if (consulta.hasta) {
    params.set('hasta', consulta.hasta);
  }
  if (consulta.pagina) {
    params.set('pagina', String(consulta.pagina));
  }
  if (consulta.tamanoPagina) {
    params.set('tamanoPagina', String(consulta.tamanoPagina));
  }
  const str = params.toString();
  return str ? `?${str}` : '';
}

export function useBitacora(consulta: Partial<ConsultaBitacora>) {
  const queryStr = construirParametrosBitacora(consulta);
  return useQuery<RespuestaBitacora>({
    queryKey: ['bitacora', consulta],
    queryFn: ({ signal }) => solicitar<RespuestaBitacora>(`/bitacora${queryStr}`, { signal }),
    staleTime: 10_000,
  });
}

export function useHistorialSolicitud(
  solicitudId: number | null,
  paginacion: Partial<ParametrosPaginacion> = {},
) {
  const params = new URLSearchParams();
  if (paginacion.pagina) params.set('pagina', String(paginacion.pagina));
  if (paginacion.tamanoPagina) params.set('tamanoPagina', String(paginacion.tamanoPagina));
  const queryStr = params.toString() ? `?${params.toString()}` : '';

  return useQuery<RespuestaBitacora>({
    queryKey: ['historial-solicitud', solicitudId, paginacion],
    queryFn: ({ signal }) =>
      solicitar<RespuestaBitacora>(`/solicitudes-cambio/${solicitudId}/historial${queryStr}`, {
        signal,
      }),
    enabled: solicitudId !== null && !Number.isNaN(solicitudId) && solicitudId > 0,
    staleTime: 10_000,
  });
}

export function useHistorialTarea(
  tareaId: number | null,
  paginacion: Partial<ParametrosPaginacion> = {},
) {
  const params = new URLSearchParams();
  params.set('entidad', 'Tarea');
  if (tareaId) params.set('entidadId', String(tareaId));
  if (paginacion.pagina) params.set('pagina', String(paginacion.pagina));
  if (paginacion.tamanoPagina) params.set('tamanoPagina', String(paginacion.tamanoPagina));
  const queryStr = `?${params.toString()}`;

  return useQuery<RespuestaBitacora>({
    queryKey: ['historial-tarea', tareaId, paginacion],
    queryFn: ({ signal }) => solicitar<RespuestaBitacora>(`/bitacora${queryStr}`, { signal }),
    enabled: tareaId !== null && !Number.isNaN(tareaId) && tareaId > 0,
    staleTime: 10_000,
  });
}
