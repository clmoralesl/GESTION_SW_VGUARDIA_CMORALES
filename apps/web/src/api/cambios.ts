import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CategoriaCambio,
  EntradaActualizarAccionCorrectiva,
  EntradaActualizarEtapa,
  EntradaActualizarSolicitud,
  EntradaCrearAccionCorrectiva,
  EntradaCrearImpacto,
  EntradaCrearSolicitud,
  EntradaOmitirEtapa,
  EntradaRechazarSolicitud,
  EstadoAccion,
  EstadoEtapa,
  EstadoSolicitud,
  NivelRiesgo,
  PrioridadSolicitud,
  ResultadoSimulacion,
  Rol,
  TipoImpacto,
} from '@autofix/core';
import { leerRol } from '../sesion/almacenamiento';
import { API_URL, ErrorSolicitud, solicitar } from './cliente-api';

export interface DetalleAccionCorrectiva {
  id: number;
  etapaId: number;
  descripcion: string;
  responsable: string;
  fechaCompromiso: string;
  fechaCierre: string | null;
  estado: EstadoAccion;
}

export interface DetalleEvidencia {
  id: number;
  etapaId: number;
  nombreArchivo: string;
  tipoMime: string;
  tamanoBytes: number;
  subidoPor: Rol;
  subidoEn: string;
}

export interface DetalleEtapaCambio {
  id: number;
  solicitudId: number;
  numero: number;
  nombre: string;
  responsable: string | null;
  estado: EstadoEtapa;
  fechaInicio: string | null;
  fechaFin: string | null;
  fechaIniciada: string | null;
  fechaCompletada: string | null;
  duracionRealDias: number | null;
  comentario: string | null;
  porcentajeAdopcion: number | null;
  evidencias: DetalleEvidencia[];
  acciones: DetalleAccionCorrectiva[];
}

export interface DetalleSolicitudCambio {
  id: number;
  proyectoId: number;
  codigo: string;
  titulo: string;
  descripcion: string;
  justificacion: string;
  solicitante: string;
  responsable: string;
  prioridad: PrioridadSolicitud;
  categoria: CategoriaCambio;
  probabilidadRiesgo: number;
  impactoRiesgo: number;
  nivelRiesgo: NivelRiesgo;
  estado: EstadoSolicitud;
  etapaActual: number;
  motivoRechazo: string | null;
  fechaRegistro: string;
  fechaDecision: string | null;
  fechaCierre: string | null;
  actualizadoEn: string;
  etapas: DetalleEtapaCambio[];
}

export function useSolicitudesCambio(proyectoId: number | null) {
  const ruta = `/proyectos/${proyectoId}/solicitudes-cambio`;

  return useQuery<DetalleSolicitudCambio[]>({
    queryKey: ['solicitudes-cambio', proyectoId],
    queryFn: ({ signal }) => solicitar<DetalleSolicitudCambio[]>(ruta, { signal }),
    enabled: proyectoId !== null && !Number.isNaN(proyectoId) && proyectoId > 0,
    staleTime: 15_000,
  });
}

export function useSolicitudCambio(id: number | null) {
  return useQuery<DetalleSolicitudCambio>({
    queryKey: ['solicitud-cambio', id],
    queryFn: ({ signal }) =>
      solicitar<DetalleSolicitudCambio>(`/solicitudes-cambio/${id}`, { signal }),
    enabled: id !== null && !Number.isNaN(id) && id > 0,
    staleTime: 10_000,
  });
}

export function useCrearSolicitudCambio(proyectoId: number) {
  const queryClient = useQueryClient();
  return useMutation<DetalleSolicitudCambio, ErrorSolicitud, EntradaCrearSolicitud>({
    mutationFn: (datos) =>
      solicitar<DetalleSolicitudCambio>(`/proyectos/${proyectoId}/solicitudes-cambio`, {
        method: 'POST',
        body: JSON.stringify(datos),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitudes-cambio', proyectoId] });
      notifications.show({
        color: 'green',
        title: 'Solicitud creada',
        message: 'La solicitud de cambio fue registrada exitosamente con sus 10 etapas.',
      });
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        title: 'No se pudo crear la solicitud',
        message: error.message,
      });
    },
  });
}

export function useActualizarSolicitudCambio(solicitudId: number, proyectoId?: number) {
  const queryClient = useQueryClient();
  return useMutation<DetalleSolicitudCambio, ErrorSolicitud, EntradaActualizarSolicitud>({
    mutationFn: (datos) =>
      solicitar<DetalleSolicitudCambio>(`/solicitudes-cambio/${solicitudId}`, {
        method: 'PATCH',
        body: JSON.stringify(datos),
      }),
    onSuccess: (resultado) => {
      queryClient.setQueryData(['solicitud-cambio', solicitudId], resultado);
      if (proyectoId) {
        queryClient.invalidateQueries({ queryKey: ['solicitudes-cambio', proyectoId] });
      }
      notifications.show({
        color: 'green',
        title: 'Solicitud actualizada',
        message: 'Los datos de la solicitud fueron actualizados.',
      });
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        title: 'No se pudo actualizar la solicitud',
        message: error.message,
      });
    },
  });
}

export function useActualizarEtapa(solicitudId: number) {
  const queryClient = useQueryClient();
  return useMutation<
    DetalleEtapaCambio,
    ErrorSolicitud,
    { numero: number; datos: EntradaActualizarEtapa }
  >({
    mutationFn: ({ numero, datos }) =>
      solicitar<DetalleEtapaCambio>(`/solicitudes-cambio/${solicitudId}/etapas/${numero}`, {
        method: 'PATCH',
        body: JSON.stringify(datos),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitud-cambio', solicitudId] });
      notifications.show({
        color: 'green',
        title: 'Etapa actualizada',
        message: 'Los datos de la etapa fueron actualizados exitosamente.',
      });
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        title: 'No se pudo actualizar la etapa',
        message: error.message,
      });
    },
  });
}

export function useIniciarEtapa(solicitudId: number) {
  const queryClient = useQueryClient();
  return useMutation<DetalleSolicitudCambio, ErrorSolicitud, number>({
    mutationFn: (numero) =>
      solicitar<DetalleSolicitudCambio>(
        `/solicitudes-cambio/${solicitudId}/etapas/${numero}/iniciar`,
        { method: 'POST' },
      ),
    onSuccess: (resultado) => {
      queryClient.setQueryData(['solicitud-cambio', solicitudId], resultado);
      queryClient.invalidateQueries({ queryKey: ['solicitudes-cambio'] });
      notifications.show({
        color: 'green',
        title: 'Etapa iniciada',
        message: 'La etapa se encuentra en curso.',
      });
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        title: 'No se pudo iniciar la etapa',
        message: error.message,
      });
    },
  });
}

export function useCompletarEtapa(solicitudId: number) {
  const queryClient = useQueryClient();
  return useMutation<DetalleSolicitudCambio, ErrorSolicitud, number>({
    mutationFn: (numero) =>
      solicitar<DetalleSolicitudCambio>(
        `/solicitudes-cambio/${solicitudId}/etapas/${numero}/completar`,
        { method: 'POST' },
      ),
    onSuccess: (resultado) => {
      queryClient.setQueryData(['solicitud-cambio', solicitudId], resultado);
      queryClient.invalidateQueries({ queryKey: ['solicitudes-cambio'] });
      notifications.show({
        color: 'green',
        title: 'Etapa completada',
        message: 'La etapa fue completada exitosamente.',
      });
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        title: 'No se pudo completar la etapa',
        message: error.message,
      });
    },
  });
}

export function useOmitirEtapa(solicitudId: number) {
  const queryClient = useQueryClient();
  return useMutation<
    DetalleSolicitudCambio,
    ErrorSolicitud,
    { numero: number; datos: EntradaOmitirEtapa }
  >({
    mutationFn: ({ numero, datos }) =>
      solicitar<DetalleSolicitudCambio>(
        `/solicitudes-cambio/${solicitudId}/etapas/${numero}/omitir`,
        {
          method: 'POST',
          body: JSON.stringify(datos),
        },
      ),
    onSuccess: (resultado) => {
      queryClient.setQueryData(['solicitud-cambio', solicitudId], resultado);
      queryClient.invalidateQueries({ queryKey: ['solicitudes-cambio'] });
      notifications.show({
        color: 'yellow',
        title: 'Etapa omitida',
        message: 'La etapa fue marcada como omitida.',
      });
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        title: 'No se pudo omitir la etapa',
        message: error.message,
      });
    },
  });
}

export async function descargarEvidencia(
  evidenciaId: number,
  nombreArchivo: string,
): Promise<void> {
  const respuesta = await fetch(`${API_URL}/evidencias/${evidenciaId}/descarga`, {
    headers: {
      'X-Rol': leerRol(),
    },
  });
  if (!respuesta.ok) {
    throw new Error('Error al descargar el archivo de evidencia.');
  }
  const blob = await respuesta.blob();
  const url = window.URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  window.URL.revokeObjectURL(url);
}

export function useSubirEvidencia(solicitudId: number) {
  const queryClient = useQueryClient();
  return useMutation<DetalleEvidencia, ErrorSolicitud, { numero: number; archivo: File }>({
    mutationFn: async ({ numero, archivo }) => {
      const formData = new FormData();
      formData.append('archivo', archivo);
      const cabeceras = new Headers();
      cabeceras.set('X-Rol', leerRol());

      const respuesta = await fetch(
        `${API_URL}/solicitudes-cambio/${solicitudId}/etapas/${numero}/evidencias`,
        {
          method: 'POST',
          headers: cabeceras,
          body: formData,
        },
      );

      if (!respuesta.ok) {
        const errorJson = await respuesta.json().catch(() => null);
        throw new ErrorSolicitud(
          respuesta.status,
          errorJson ?? {
            codigo: 'ERROR_SUBIDA',
            error: 'Error',
            mensaje: 'No se pudo subir la evidencia.',
          },
        );
      }
      return respuesta.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitud-cambio', solicitudId] });
      notifications.show({
        color: 'green',
        title: 'Evidencia adjuntada',
        message: 'El archivo fue subido exitosamente.',
      });
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        title: 'Error al adjuntar evidencia',
        message: error.message,
      });
    },
  });
}

export function useEliminarEvidencia(solicitudId: number) {
  const queryClient = useQueryClient();
  return useMutation<void, ErrorSolicitud, number>({
    mutationFn: (evidenciaId) =>
      solicitar<void>(`/evidencias/${evidenciaId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitud-cambio', solicitudId] });
      notifications.show({
        color: 'green',
        title: 'Evidencia eliminada',
        message: 'La evidencia fue eliminada.',
      });
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        title: 'No se pudo eliminar la evidencia',
        message: error.message,
      });
    },
  });
}

export function useCrearAccionCorrectiva(solicitudId: number) {
  const queryClient = useQueryClient();
  return useMutation<DetalleAccionCorrectiva, ErrorSolicitud, EntradaCrearAccionCorrectiva>({
    mutationFn: (datos) =>
      solicitar<DetalleAccionCorrectiva>(
        `/solicitudes-cambio/${solicitudId}/etapas/9/acciones-correctivas`,
        {
          method: 'POST',
          body: JSON.stringify(datos),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitud-cambio', solicitudId] });
      notifications.show({
        color: 'green',
        title: 'Acción correctiva registrada',
        message: 'La acción correctiva fue creada exitosamente.',
      });
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        title: 'No se pudo registrar la acción correctiva',
        message: error.message,
      });
    },
  });
}

export function useActualizarAccionCorrectiva(solicitudId: number) {
  const queryClient = useQueryClient();
  return useMutation<
    DetalleAccionCorrectiva,
    ErrorSolicitud,
    { accionId: number; datos: EntradaActualizarAccionCorrectiva }
  >({
    mutationFn: ({ accionId, datos }) =>
      solicitar<DetalleAccionCorrectiva>(`/acciones-correctivas/${accionId}`, {
        method: 'PATCH',
        body: JSON.stringify(datos),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitud-cambio', solicitudId] });
      notifications.show({
        color: 'green',
        title: 'Acción correctiva actualizada',
        message: 'Los datos de la acción fueron modificados.',
      });
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        title: 'No se pudo actualizar la acción correctiva',
        message: error.message,
      });
    },
  });
}

export interface DetalleImpacto {
  id: number;
  solicitudId: number;
  tipo: TipoImpacto;
  tareaId: number | null;
  datos: Record<string, unknown>;
  descripcion: string | null;
  aplicado: boolean;
}

export function useImpactosCambio(solicitudId: number | null) {
  return useQuery<DetalleImpacto[]>({
    queryKey: ['impactos-cambio', solicitudId],
    queryFn: ({ signal }) =>
      solicitar<DetalleImpacto[]>(`/solicitudes-cambio/${solicitudId}/impactos`, { signal }),
    enabled: solicitudId !== null && !Number.isNaN(solicitudId) && solicitudId > 0,
    staleTime: 10_000,
  });
}

export function useCrearImpactoCambio(solicitudId: number) {
  const queryClient = useQueryClient();
  return useMutation<DetalleImpacto, ErrorSolicitud, EntradaCrearImpacto>({
    mutationFn: (datos) =>
      solicitar<DetalleImpacto>(`/solicitudes-cambio/${solicitudId}/impactos`, {
        method: 'POST',
        body: JSON.stringify(datos),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['impactos-cambio', solicitudId] });
      queryClient.invalidateQueries({ queryKey: ['solicitud-cambio', solicitudId] });
      notifications.show({
        color: 'green',
        title: 'Impacto registrado',
        message: 'El impacto fue agregado a la solicitud.',
      });
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        title: 'No se pudo registrar el impacto',
        message: error.message,
      });
    },
  });
}

export function useEliminarImpactoCambio(solicitudId: number) {
  const queryClient = useQueryClient();
  return useMutation<void, ErrorSolicitud, number>({
    mutationFn: (impactoId) =>
      solicitar<void>(`/impactos-cambio/${impactoId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['impactos-cambio', solicitudId] });
      queryClient.invalidateQueries({ queryKey: ['solicitud-cambio', solicitudId] });
      notifications.show({
        color: 'green',
        title: 'Impacto eliminado',
        message: 'El impacto fue retirado de la solicitud.',
      });
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        title: 'No se pudo eliminar el impacto',
        message: error.message,
      });
    },
  });
}

export function useSimularCambio(solicitudId: number) {
  return useMutation<ResultadoSimulacion, ErrorSolicitud, void>({
    mutationFn: () =>
      solicitar<ResultadoSimulacion>(`/solicitudes-cambio/${solicitudId}/simular`, {
        method: 'POST',
      }),
    meta: { silenciarError: true },
  });
}

export function useAprobarSolicitudCambio(solicitudId: number, proyectoId?: number) {
  const queryClient = useQueryClient();
  return useMutation<ResultadoSimulacion, ErrorSolicitud, void>({
    mutationFn: () =>
      solicitar<ResultadoSimulacion>(`/solicitudes-cambio/${solicitudId}/aprobar`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitudes-cambio'] });
      queryClient.invalidateQueries({ queryKey: ['solicitud-cambio', solicitudId] });
      queryClient.invalidateQueries({ queryKey: ['impactos-cambio', solicitudId] });
      if (proyectoId) {
        queryClient.invalidateQueries({ queryKey: ['proyectos'] });
        queryClient.invalidateQueries({ queryKey: ['proyecto', proyectoId] });
        queryClient.invalidateQueries({ queryKey: ['tareas', proyectoId] });
        queryClient.invalidateQueries({ queryKey: ['arbol-tareas', proyectoId] });
        queryClient.invalidateQueries({ queryKey: ['kpi', proyectoId] });
        queryClient.invalidateQueries({ queryKey: ['kpi-mediciones', proyectoId] });
        queryClient.invalidateQueries({ queryKey: ['lineas-base', proyectoId] });
        queryClient.invalidateQueries({ queryKey: ['dependencias', proyectoId] });
        queryClient.invalidateQueries({ queryKey: ['hitos', proyectoId] });
      }
      notifications.show({
        color: 'green',
        title: 'Solicitud aprobada',
        message: 'La solicitud de cambio fue aprobada y el plan fue actualizado.',
      });
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        title: 'No se pudo aprobar la solicitud',
        message: error.message,
      });
    },
  });
}

export function useRechazarSolicitudCambio(solicitudId: number, proyectoId?: number) {
  const queryClient = useQueryClient();
  return useMutation<DetalleSolicitudCambio, ErrorSolicitud, EntradaRechazarSolicitud>({
    mutationFn: (datos) =>
      solicitar<DetalleSolicitudCambio>(`/solicitudes-cambio/${solicitudId}/rechazar`, {
        method: 'POST',
        body: JSON.stringify(datos),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitudes-cambio'] });
      queryClient.invalidateQueries({ queryKey: ['solicitud-cambio', solicitudId] });
      queryClient.invalidateQueries({ queryKey: ['impactos-cambio', solicitudId] });
      if (proyectoId) {
        queryClient.invalidateQueries({ queryKey: ['proyectos'] });
        queryClient.invalidateQueries({ queryKey: ['proyecto', proyectoId] });
        queryClient.invalidateQueries({ queryKey: ['lineas-base', proyectoId] });
      }
      notifications.show({
        color: 'green',
        title: 'Solicitud rechazada',
        message: 'La solicitud de cambio fue rechazada.',
      });
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        title: 'No se pudo rechazar la solicitud',
        message: error.message,
      });
    },
  });
}
