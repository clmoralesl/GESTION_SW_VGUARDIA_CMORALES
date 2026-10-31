import { useEffect, useMemo, useRef } from 'react';
import { Alert, Badge, Box, Card, Center, Group, Loader, Modal, Stack, Text } from '@mantine/core';
import { IconChartLine, IconInfoCircle } from '@tabler/icons-react';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import {
  formatearFechaHora,
  type KpiDetalleRespuesta,
  type KpiProyectoResumen,
} from '@autofix/core';
import { useMedicionesKpi } from '../api/kpi';
import { formatearUnidadKpi, formatearValorKpi } from './formato-kpi';
import type { FilaKpiTabla } from './tabla-kpi';

echarts.use([
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  MarkAreaComponent,
  LineChart,
  CanvasRenderer,
]);

interface GraficoHistorialKpiProps {
  abierto: boolean;
  alCerrar: () => void;
  kpi: KpiProyectoResumen | KpiDetalleRespuesta | FilaKpiTabla | null;
  proyectoId: number | null;
  nombreProyecto?: string;
}

export function GraficoHistorialKpi({
  abierto,
  alCerrar,
  kpi,
  proyectoId,
  nombreProyecto,
}: GraficoHistorialKpiProps) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const instanciaRef = useRef<echarts.ECharts | null>(null);

  const { data: mediciones, isLoading } = useMedicionesKpi(
    proyectoId,
    kpi ? ('kpiId' in kpi ? kpi.kpiId : kpi.id) : null,
    100,
  );

  const datosGrafico = useMemo(() => {
    if (!mediciones || mediciones.length === 0) return { fechas: [], valores: [] };
    const fechas = mediciones.map((m) => formatearFechaHora(m.medidoEn));
    const valores = mediciones.map((m) => m.valor);
    return { fechas, valores };
  }, [mediciones]);

  useEffect(() => {
    if (!abierto || !contenedorRef.current || !kpi || isLoading) return;

    if (!instanciaRef.current) {
      instanciaRef.current = echarts.init(contenedorRef.current);
    }
    const chart = instanciaRef.current;

    const umbralVerde = kpi.umbrales?.verde ?? null;
    const umbralAmarillo = kpi.umbrales?.amarillo ?? null;
    const meta = kpi.meta;
    const esMayorMejor = kpi.direccion === 'MAYOR_MEJOR';

    const candidatos: number[] = [];
    for (const v of datosGrafico.valores) {
      if (v !== null && v !== undefined && !Number.isNaN(v)) {
        candidatos.push(v);
      }
    }
    if (meta !== null && meta !== undefined) candidatos.push(meta);
    if (umbralVerde !== null && umbralVerde !== undefined) candidatos.push(umbralVerde);
    if (umbralAmarillo !== null && umbralAmarillo !== undefined) candidatos.push(umbralAmarillo);

    let minEje: number | undefined = undefined;
    let maxEje: number | undefined = undefined;

    if (candidatos.length > 0) {
      const minVal = Math.min(...candidatos);
      const maxVal = Math.max(...candidatos);
      const rango = maxVal - minVal;
      const margen = rango > 0 ? rango * 0.1 : 1;
      minEje = Number((minVal - margen).toFixed(4));
      maxEje = Number((maxVal + margen).toFixed(4));
    }

    const areas: Array<Array<{ yAxis?: number; itemStyle?: { color: string } }>> = [];

    if (umbralVerde !== null && umbralAmarillo !== null) {
      const limiteSuperior = maxEje;
      const limiteInferior = minEje;
      if (esMayorMejor) {
        areas.push([
          {
            yAxis: umbralVerde,
            itemStyle: { color: 'rgba(40, 167, 69, 0.08)' },
          },
          { yAxis: limiteSuperior },
        ]);
        areas.push([
          {
            yAxis: umbralAmarillo,
            itemStyle: { color: 'rgba(255, 193, 7, 0.08)' },
          },
          { yAxis: umbralVerde },
        ]);
        areas.push([
          { yAxis: limiteInferior, itemStyle: { color: 'rgba(220, 53, 69, 0.08)' } },
          { yAxis: umbralAmarillo },
        ]);
      } else {
        areas.push([
          { yAxis: limiteInferior, itemStyle: { color: 'rgba(40, 167, 69, 0.08)' } },
          { yAxis: umbralVerde },
        ]);
        areas.push([
          {
            yAxis: umbralVerde,
            itemStyle: { color: 'rgba(255, 193, 7, 0.08)' },
          },
          { yAxis: umbralAmarillo },
        ]);
        areas.push([
          {
            yAxis: umbralAmarillo,
            itemStyle: { color: 'rgba(220, 53, 69, 0.08)' },
          },
          { yAxis: limiteSuperior },
        ]);
      }
    }

    const markLines: Array<{ yAxis: number; name: string; lineStyle?: object }> = [];
    if (meta !== null) {
      markLines.push({
        name: 'Meta',
        yAxis: meta,
        lineStyle: { color: '#0d6efd', type: 'dashed', width: 2 },
      });
    }
    if (umbralVerde !== null) {
      markLines.push({
        name: 'Umbral Verde',
        yAxis: umbralVerde,
        lineStyle: { color: '#28a745', type: 'dotted' },
      });
    }
    if (umbralAmarillo !== null) {
      markLines.push({
        name: 'Umbral Amarillo',
        yAxis: umbralAmarillo,
        lineStyle: { color: '#ffc107', type: 'dotted' },
      });
    }

    const opciones: echarts.EChartsCoreOption = {
      tooltip: {
        trigger: 'axis',
        formatter: (params: unknown) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          const primer = params[0] as {
            axisValueLabel: string;
            value: number | null;
          };
          const val = primer.value;
          const texto =
            val !== null && val !== undefined ? formatearValorKpi(val, kpi.unidad) : 'N/D';
          return `${primer.axisValueLabel}<br/><strong>${kpi.codigo}:</strong> ${texto}`;
        },
      },
      grid: {
        top: 40,
        right: 40,
        bottom: 60,
        left: 60,
      },
      xAxis: {
        type: 'category',
        data: datosGrafico.fechas,
        axisLabel: {
          rotate: 30,
          fontSize: 10,
        },
      },
      yAxis: {
        type: 'value',
        scale: true,
        ...(minEje !== undefined ? { min: minEje } : {}),
        ...(maxEje !== undefined ? { max: maxEje } : {}),
        axisLabel: {
          formatter: (v: number) => formatearValorKpi(v, kpi.unidad),
        },
      },
      series: [
        {
          name: kpi.nombre,
          type: 'line',
          data: datosGrafico.valores,
          connectNulls: false,
          smooth: false,
          showSymbol: true,
          symbolSize: 6,
          lineStyle: {
            width: 2.5,
            color: '#1c7ed6',
          },
          itemStyle: {
            color: '#1c7ed6',
          },
          markLine: markLines.length > 0 ? { data: markLines } : undefined,
          markArea: areas.length > 0 ? { data: areas } : undefined,
        },
      ],
    };

    chart.setOption(opciones, true);

    const alRedimensionar = () => chart.resize();
    window.addEventListener('resize', alRedimensionar);

    return () => {
      window.removeEventListener('resize', alRedimensionar);
    };
  }, [abierto, kpi, datosGrafico, isLoading]);

  useEffect(() => {
    return () => {
      if (instanciaRef.current) {
        instanciaRef.current.dispose();
        instanciaRef.current = null;
      }
    };
  }, [abierto]);

  if (!kpi) return null;

  return (
    <Modal
      opened={abierto}
      onClose={alCerrar}
      title={
        <Group gap="xs">
          <IconChartLine size={20} />
          <Text fw={700}>
            Historial de medición: {kpi.codigo} · {kpi.nombre}
          </Text>
        </Group>
      }
      size="xl"
    >
      <Stack gap="sm">
        <Group justify="space-between">
          <Group gap="xs">
            <Badge size="sm" variant="filled">
              {kpi.codigo}
            </Badge>
            <Badge size="sm" variant="light" color="blue">
              {formatearUnidadKpi(kpi.unidad)}
            </Badge>
            <Badge size="sm" variant="outline">
              Dirección: {kpi.direccion === 'MAYOR_MEJOR' ? 'Mayor es mejor' : 'Menor es mejor'}
            </Badge>
            {kpi.meta !== null ? (
              <Badge size="sm" color="cyan" variant="dot">
                Meta: {formatearValorKpi(kpi.meta, kpi.unidad)}
              </Badge>
            ) : null}
          </Group>
          {nombreProyecto ? (
            <Text size="xs" c="dimmed">
              Proyecto: {nombreProyecto}
            </Text>
          ) : null}
        </Group>

        {kpi.descripcion ? (
          <Text size="xs" c="dimmed">
            {kpi.descripcion}
          </Text>
        ) : null}

        {isLoading ? (
          <Center h={320}>
            <Loader size="md" />
          </Center>
        ) : !mediciones || mediciones.length === 0 ? (
          <Alert color="blue" icon={<IconInfoCircle size={16} />}>
            No existen mediciones históricas registradas para este KPI en el proyecto seleccionado.
          </Alert>
        ) : (
          <Card withBorder p="xs">
            <Box ref={contenedorRef} style={{ width: '100%', height: 360 }} />
          </Card>
        )}
      </Stack>
    </Modal>
  );
}
