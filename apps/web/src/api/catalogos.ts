import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ActualizarProfesional,
  ActualizarRecurso,
  CrearProfesional,
  CrearRecurso,
  ProfesionalResumen,
  RecursoResumen,
  TipoRecursoResumen,
} from '@autofix/core';
import { ErrorSolicitud, solicitar } from './cliente-api';

export function useProfesionales() {
  return useQuery<ProfesionalResumen[]>({
    queryKey: ['profesionales'],
    queryFn: ({ signal }) => solicitar<ProfesionalResumen[]>('/profesionales', { signal }),
    staleTime: 30_000,
  });
}

export function useRecursos() {
  return useQuery<RecursoResumen[]>({
    queryKey: ['recursos'],
    queryFn: ({ signal }) => solicitar<RecursoResumen[]>('/recursos', { signal }),
    staleTime: 30_000,
  });
}

export function useTiposRecurso() {
  return useQuery<TipoRecursoResumen[]>({
    queryKey: ['tipos-recurso'],
    queryFn: ({ signal }) => solicitar<TipoRecursoResumen[]>('/tipos-recurso', { signal }),
    staleTime: 30_000,
  });
}

export function useCrearProfesional() {
  const queryClient = useQueryClient();
  return useMutation<ProfesionalResumen, ErrorSolicitud, CrearProfesional>({
    mutationFn: (datos) =>
      solicitar<ProfesionalResumen>('/profesionales', {
        method: 'POST',
        body: JSON.stringify(datos),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profesionales'] });
      notifications.show({
        color: 'green',
        title: 'Profesional creado',
        message: 'El profesional fue creado exitosamente.',
      });
    },
  });
}

export function useActualizarProfesional() {
  const queryClient = useQueryClient();
  return useMutation<
    ProfesionalResumen,
    ErrorSolicitud,
    { id: number; datos: ActualizarProfesional }
  >({
    mutationFn: ({ id, datos }) =>
      solicitar<ProfesionalResumen>(`/profesionales/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(datos),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profesionales'] });
      notifications.show({
        color: 'green',
        title: 'Profesional actualizado',
        message: 'El profesional fue actualizado exitosamente.',
      });
    },
  });
}

export function useEliminarProfesional() {
  const queryClient = useQueryClient();
  return useMutation<void, ErrorSolicitud, number>({
    meta: { silenciarError: true },
    mutationFn: (id) =>
      solicitar<void>(`/profesionales/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profesionales'] });
      notifications.show({
        color: 'green',
        title: 'Profesional eliminado',
        message: 'El profesional fue eliminado exitosamente.',
      });
    },
    onError: (error) => {
      queryClient.invalidateQueries({ queryKey: ['profesionales'] });
      notifications.show({
        color: 'red',
        title: 'No se pudo eliminar el profesional',
        message: error.cuerpo?.mensaje ?? error.message,
      });
    },
  });
}

export function useCrearRecurso() {
  const queryClient = useQueryClient();
  return useMutation<RecursoResumen, ErrorSolicitud, CrearRecurso>({
    mutationFn: (datos) =>
      solicitar<RecursoResumen>('/recursos', {
        method: 'POST',
        body: JSON.stringify(datos),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recursos'] });
      notifications.show({
        color: 'green',
        title: 'Recurso creado',
        message: 'El recurso fue creado exitosamente.',
      });
    },
  });
}

export function useActualizarRecurso() {
  const queryClient = useQueryClient();
  return useMutation<RecursoResumen, ErrorSolicitud, { id: number; datos: ActualizarRecurso }>({
    mutationFn: ({ id, datos }) =>
      solicitar<RecursoResumen>(`/recursos/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(datos),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recursos'] });
      notifications.show({
        color: 'green',
        title: 'Recurso actualizado',
        message: 'El recurso fue actualizado exitosamente.',
      });
    },
  });
}

export function useEliminarRecurso() {
  const queryClient = useQueryClient();
  return useMutation<void, ErrorSolicitud, number>({
    meta: { silenciarError: true },
    mutationFn: (id) =>
      solicitar<void>(`/recursos/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recursos'] });
      notifications.show({
        color: 'green',
        title: 'Recurso eliminado',
        message: 'El recurso fue eliminado exitosamente.',
      });
    },
    onError: (error) => {
      queryClient.invalidateQueries({ queryKey: ['recursos'] });
      notifications.show({
        color: 'red',
        title: 'No se pudo eliminar el recurso',
        message: error.cuerpo?.mensaje ?? error.message,
      });
    },
  });
}
