import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  ResultadoValidacionLibro,
  ErrorValidacionCarga,
  AdvertenciaCarga,
  ResumenHojaValidacion,
} from '@autofix/core';
import { API_URL, ErrorSolicitud, solicitar } from './cliente-api';
import { leerRol } from '../sesion/almacenamiento';

export type {
  ResultadoValidacionLibro,
  ErrorValidacionCarga,
  AdvertenciaCarga,
  ResumenHojaValidacion,
};

export interface ResultadoVistaPrevia extends ResultadoValidacionLibro {
  destino: {
    proyectoId: number | null;
    tieneDatos: boolean;
  };
}

export interface ResultadoConfirmacionImportacion {
  proyectoId: number;
  conteos: {
    tareas: number;
    dependencias: number;
    asignaciones: number;
    hitos: number;
    solicitudes: number;
  };
}

export async function descargarPlantilla(): Promise<void> {
  const respuesta = await fetch(`${API_URL}/importaciones/plantilla`, {
    headers: {
      'X-Rol': leerRol(),
    },
  });
  if (!respuesta.ok) {
    throw new Error('Error al descargar la plantilla de carga.');
  }
  const blob = await respuesta.blob();
  const url = window.URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = 'plantilla_carga_autofix.xlsx';
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  window.URL.revokeObjectURL(url);
}

export async function exportarProyecto(proyectoId: number, nombreSugerido?: string): Promise<void> {
  const respuesta = await fetch(`${API_URL}/proyectos/${proyectoId}/exportacion`, {
    headers: {
      'X-Rol': leerRol(),
    },
  });
  if (!respuesta.ok) {
    throw new Error('Error al exportar el proyecto.');
  }

  let nombreArchivo = nombreSugerido ?? `proyecto_${proyectoId}.xlsx`;
  const disposition = respuesta.headers.get('Content-Disposition');
  if (disposition) {
    const match = /filename\*?=['"]?(?:UTF-\d['"]*)?([^;\r\n"']*)['"]?/i.exec(disposition);
    if (match && match[1]) {
      nombreArchivo = decodeURIComponent(match[1]);
    }
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

export async function obtenerVistaPrevia(
  archivo: File,
  proyectoId?: number,
): Promise<ResultadoVistaPrevia> {
  const formData = new FormData();
  formData.append('archivo', archivo);
  const ruta =
    proyectoId !== undefined && !isNaN(proyectoId)
      ? `/importaciones/vista-previa?proyectoId=${proyectoId}`
      : '/importaciones/vista-previa';
  return solicitar<ResultadoVistaPrevia>(ruta, {
    method: 'POST',
    body: formData,
  });
}

export async function confirmarImportacion(
  archivo: File,
  proyectoId?: number,
  reemplazar?: boolean,
): Promise<ResultadoConfirmacionImportacion> {
  const formData = new FormData();
  formData.append('archivo', archivo);
  const params = new URLSearchParams();
  if (proyectoId !== undefined && !isNaN(proyectoId)) {
    params.set('proyectoId', String(proyectoId));
  }
  if (reemplazar) {
    params.set('reemplazar', 'true');
  }
  const query = params.toString() ? `?${params.toString()}` : '';
  return solicitar<ResultadoConfirmacionImportacion>(`/importaciones${query}`, {
    method: 'POST',
    body: formData,
  });
}

export function useVistaPrevia() {
  return useMutation<ResultadoVistaPrevia, ErrorSolicitud, { archivo: File; proyectoId?: number }>({
    mutationFn: ({ archivo, proyectoId }) => obtenerVistaPrevia(archivo, proyectoId),
  });
}

export function useConfirmarImportacion() {
  const queryClient = useQueryClient();
  return useMutation<
    ResultadoConfirmacionImportacion,
    ErrorSolicitud,
    { archivo: File; proyectoId?: number; reemplazar?: boolean }
  >({
    mutationFn: ({ archivo, proyectoId, reemplazar }) =>
      confirmarImportacion(archivo, proyectoId, reemplazar),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}
