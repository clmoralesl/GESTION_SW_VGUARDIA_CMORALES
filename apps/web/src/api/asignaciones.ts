import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ActualizarAsignacion,
  AsignacionResumen,
  CrearAsignacion,
  ResumenCostos,
} from '@autofix/core';
import { ErrorSolicitud, solicitar } from './cliente-api';

export interface AlertaResumen {
  id: number;
  proyectoId: number;
  tipo: string;
  severidad: string;
  clave: string;
  mensaje: string;
  detalle: unknown;
  entidad: string | null;
  entidadId: number | null;
  activa: boolean;
  creadaEn: string;
  cerradaEn: string | null;
}

export interface CeldaCargaRecurso {
  semana: string;
  porcentaje: number;
  sobreasignada: boolean;
}

export interface ProfesionalCarga {
  id: number;
  nombre: string;
  activo: boolean;
  celdas: CeldaCargaRecurso[];
}

export interface RespuestaCarga {
  semanas: string[];
  profesionales: ProfesionalCarga[];
}

export interface RespuestaMutacionAsignacion {
  asignacion: AsignacionResumen;
  costos: ResumenCostos | null;
}

export function useAsignaciones(tareaId: number | null) {
  return useQuery<AsignacionResumen[]>({
    queryKey: ['asignaciones', tareaId],
    queryFn: ({ signal }) =>
      solicitar<AsignacionResumen[]>(`/tareas/${tareaId}/asignaciones`, { signal }),
    enabled: tareaId !== null && !Number.isNaN(tareaId) && tareaId > 0,
    staleTime: 10_000,
  });
}

export function useCostosProyecto(proyectoId: number | null) {
  return useQuery<ResumenCostos>({
    queryKey: ['costos', proyectoId],
    queryFn: ({ signal }) =>
      solicitar<ResumenCostos>(`/proyectos/${proyectoId}/costos`, { signal }),
    enabled: proyectoId !== null && !Number.isNaN(proyectoId) && proyectoId > 0,
    staleTime: 10_000,
  });
}

export function useAlertasProyecto(proyectoId: number | null, activas: boolean = true) {
  return useQuery<AlertaResumen[]>({
    queryKey: ['alertas', proyectoId, activas],
    queryFn: ({ signal }) =>
      solicitar<AlertaResumen[]>(`/proyectos/${proyectoId}/alertas?activas=${activas}`, { signal }),
    enabled: proyectoId !== null && !Number.isNaN(proyectoId) && proyectoId > 0,
    staleTime: 10_000,
  });
}

export function useCargaRecursos(desde: string, hasta: string) {
  return useQuery<RespuestaCarga>({
    queryKey: ['carga-recursos', desde, hasta],
    queryFn: ({ signal }) =>
      solicitar<RespuestaCarga>(`/carga-recursos?desde=${desde}&hasta=${hasta}`, { signal }),
    enabled: Boolean(desde && hasta && desde <= hasta),
    staleTime: 30_000,
  });
}

export function useCrearAsignacion(tareaId: number, proyectoId?: number) {
  const queryClient = useQueryClient();
  return useMutation<RespuestaMutacionAsignacion, ErrorSolicitud, CrearAsignacion>({
    mutationFn: (datos) =>
      solicitar<RespuestaMutacionAsignacion>(`/tareas/${tareaId}/asignaciones`, {
        method: 'POST',
        body: JSON.stringify(datos),
      }),
    meta: { silenciarError: true },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asignaciones', tareaId] });
      if (proyectoId) {
        queryClient.invalidateQueries({ queryKey: ['costos', proyectoId] });
        queryClient.invalidateQueries({ queryKey: ['alertas', proyectoId] });
        queryClient.invalidateQueries({ queryKey: ['proyectos', proyectoId] });
        queryClient.invalidateQueries({ queryKey: ['tareas', proyectoId] });
      }
      queryClient.invalidateQueries({ queryKey: ['carga-recursos'] });
      notifications.show({
        color: 'green',
        title: 'Asignación creada',
        message: 'La asignación fue registrada exitosamente.',
      });
    },
  });
}

export function useActualizarAsignacion(tareaId: number, proyectoId?: number) {
  const queryClient = useQueryClient();
  return useMutation<
    RespuestaMutacionAsignacion,
    ErrorSolicitud,
    { asignacionId: number; datos: ActualizarAsignacion }
  >({
    mutationFn: ({ asignacionId, datos }) =>
      solicitar<RespuestaMutacionAsignacion>(`/asignaciones/${asignacionId}`, {
        method: 'PATCH',
        body: JSON.stringify(datos),
      }),
    meta: { silenciarError: true },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asignaciones', tareaId] });
      if (proyectoId) {
        queryClient.invalidateQueries({ queryKey: ['costos', proyectoId] });
        queryClient.invalidateQueries({ queryKey: ['alertas', proyectoId] });
        queryClient.invalidateQueries({ queryKey: ['proyectos', proyectoId] });
        queryClient.invalidateQueries({ queryKey: ['tareas', proyectoId] });
      }
      queryClient.invalidateQueries({ queryKey: ['carga-recursos'] });
      notifications.show({
        color: 'green',
        title: 'Asignación actualizada',
        message: 'La asignación fue actualizada exitosamente.',
      });
    },
  });
}

export function useEliminarAsignacion(tareaId: number, proyectoId?: number) {
  const queryClient = useQueryClient();
  return useMutation<void, ErrorSolicitud, number>({
    mutationFn: (asignacionId) =>
      solicitar<void>(`/asignaciones/${asignacionId}`, {
        method: 'DELETE',
      }),
    meta: { silenciarError: true },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asignaciones', tareaId] });
      if (proyectoId) {
        queryClient.invalidateQueries({ queryKey: ['costos', proyectoId] });
        queryClient.invalidateQueries({ queryKey: ['alertas', proyectoId] });
        queryClient.invalidateQueries({ queryKey: ['proyectos', proyectoId] });
        queryClient.invalidateQueries({ queryKey: ['tareas', proyectoId] });
      }
      queryClient.invalidateQueries({ queryKey: ['carga-recursos'] });
      notifications.show({
        color: 'green',
        title: 'Asignación eliminada',
        message: 'La asignación fue eliminada exitosamente.',
      });
    },
  });
}
