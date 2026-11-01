import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ActualizarKpi,
  AmbitoKpi,
  CrearKpi,
  KpiDetalleRespuesta,
  KpiMedicionRespuesta,
  KpiProyectoResumen,
  ResultadoVariablesKpi,
} from '@autofix/core';
import { ErrorSolicitud, solicitar } from './cliente-api';

export interface ValidarFormulaResultado {
  valida: boolean;
  valor: number | null;
  variables: string[];
  errores: Array<{
    codigo: string;
    mensaje: string;
    fila?: number;
    columna?: number;
  }>;
}

export function useKpis() {
  return useQuery<KpiDetalleRespuesta[]>({
    queryKey: ['kpis'],
    queryFn: ({ signal }) => solicitar<KpiDetalleRespuesta[]>('/kpi', { signal }),
    staleTime: 30_000,
  });
}

export function useKpisProyecto(proyectoId: number | null, ambito: AmbitoKpi = 'PROYECTO') {
  return useQuery<KpiProyectoResumen[]>({
    queryKey: ['kpis-proyecto', proyectoId, ambito],
    queryFn: ({ signal }) =>
      solicitar<KpiProyectoResumen[]>(`/proyectos/${proyectoId}/kpi?ambito=${ambito}`, { signal }),
    enabled: Boolean(proyectoId),
    staleTime: 10_000,
  });
}

export function useMedicionesKpi(proyectoId: number | null, kpiId: number | null, limite = 100) {
  return useQuery<KpiMedicionRespuesta[]>({
    queryKey: ['mediciones-kpi', proyectoId, kpiId, limite],
    queryFn: ({ signal }) =>
      solicitar<KpiMedicionRespuesta[]>(
        `/proyectos/${proyectoId}/kpi/${kpiId}/mediciones?limite=${limite}`,
        { signal },
      ),
    enabled: Boolean(proyectoId && kpiId),
    staleTime: 10_000,
  });
}

export function useVariablesKpi(proyectoId?: number | null, fechaCorte?: string | null) {
  const parametros = new URLSearchParams();
  if (proyectoId) {
    parametros.set('proyectoId', String(proyectoId));
  }
  if (fechaCorte) {
    parametros.set('fechaCorte', fechaCorte);
  }
  const consulta = parametros.toString();
  const ruta = consulta ? `/variables-kpi?${consulta}` : '/variables-kpi';

  return useQuery<ResultadoVariablesKpi>({
    queryKey: ['variables-kpi', proyectoId, fechaCorte],
    queryFn: ({ signal }) => solicitar<ResultadoVariablesKpi>(ruta, { signal }),
    staleTime: 30_000,
  });
}

export function useValidarFormula(
  formula: string,
  proyectoId?: number | null,
  fechaCorte?: string | null,
  ambito?: AmbitoKpi,
) {
  return useQuery<ValidarFormulaResultado>({
    queryKey: ['validar-formula', formula, proyectoId, fechaCorte, ambito],
    queryFn: ({ signal }) =>
      solicitar<ValidarFormulaResultado>('/kpi/validar-formula', {
        signal,
        method: 'POST',
        body: JSON.stringify({
          formula,
          proyectoId: proyectoId ?? undefined,
          fechaCorte: fechaCorte ?? undefined,
          ambito: ambito ?? undefined,
        }),
      }),
    enabled: Boolean(formula.trim()),
    staleTime: 5_000,
    meta: { silenciarError: true },
  });
}

export function useCrearKpi() {
  const queryClient = useQueryClient();
  return useMutation<KpiDetalleRespuesta, ErrorSolicitud, CrearKpi>({
    mutationFn: (datos) =>
      solicitar<KpiDetalleRespuesta>('/kpi', {
        method: 'POST',
        body: JSON.stringify(datos),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kpis'] });
      queryClient.invalidateQueries({ queryKey: ['kpis-proyecto'] });
      notifications.show({
        color: 'green',
        title: 'KPI creado',
        message: 'El KPI fue registrado exitosamente.',
      });
    },
  });
}

export function useActualizarKpi() {
  const queryClient = useQueryClient();
  return useMutation<KpiDetalleRespuesta, ErrorSolicitud, { id: number; datos: ActualizarKpi }>({
    mutationFn: ({ id, datos }) =>
      solicitar<KpiDetalleRespuesta>(`/kpi/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(datos),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kpis'] });
      queryClient.invalidateQueries({ queryKey: ['kpis-proyecto'] });
      notifications.show({
        color: 'green',
        title: 'KPI actualizado',
        message: 'El KPI fue actualizado exitosamente.',
      });
    },
  });
}

export function useEliminarKpi() {
  const queryClient = useQueryClient();
  return useMutation<void, ErrorSolicitud, number>({
    mutationFn: (id) =>
      solicitar<void>(`/kpi/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kpis'] });
      queryClient.invalidateQueries({ queryKey: ['kpis-proyecto'] });
      notifications.show({
        color: 'green',
        title: 'KPI eliminado',
        message: 'El KPI fue eliminado exitosamente.',
      });
    },
  });
}
