import { useEffect, useRef } from 'react';
import { Box, Card, Stack, Text, Title } from '@mantine/core';
import * as echarts from 'echarts/core';
import { BarChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { formatearMonto, type TableroProyecto } from '@autofix/core';

echarts.use([
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  BarChart,
  CanvasRenderer,
]);

interface GraficoCostoEtapaProps {
  costos: TableroProyecto['costoPorEtapa'];
}

export function GraficoCostoEtapa({ costos }: GraficoCostoEtapaProps) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const instanciaRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!contenedorRef.current || costos.length === 0) return;

    if (!instanciaRef.current) {
      instanciaRef.current = echarts.init(contenedorRef.current);
    }
    const chart = instanciaRef.current;

    const etapas = costos.map((c) => `${c.codigo}. ${c.nombre}`);
    const seriePlan = costos.map((c) => c.costoPlan);
    const serieReal = costos.map((c) => c.costoReal);

    const opcion: echarts.EChartsCoreOption = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: unknown) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          const items = params as Array<{
            axisValue?: string;
            seriesName?: string;
            value?: number | null;
            color?: string;
          }>;
          let res = `<div style="font-weight:600;margin-bottom:4px;">${items[0]?.axisValue ?? ''}</div>`;
          for (const item of items) {
            const val = formatearMonto(item.value ?? 0);
            res += `<div style="display:flex;align-items:center;gap:8px;">
              <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background-color:${item.color ?? '#888'};"></span>
              <span>${item.seriesName ?? ''}:</span>
              <strong>${val}</strong>
            </div>`;
          }
          return res;
        },
      },
      legend: {
        data: ['Costo Plan', 'Costo Real'],
        top: 0,
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '15%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: etapas,
        axisLabel: {
          interval: 0,
          rotate: etapas.length > 3 ? 15 : 0,
        },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (v: number) => formatearMonto(v),
        },
      },
      series: [
        {
          name: 'Costo Plan',
          type: 'bar',
          data: seriePlan,
          itemStyle: { color: '#228be6' },
        },
        {
          name: 'Costo Real',
          type: 'bar',
          data: serieReal,
          itemStyle: { color: '#fa5252' },
        },
      ],
    };

    chart.setOption(opcion);

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [costos]);

  return (
    <Card withBorder padding="md" radius="md">
      <Stack gap="xs">
        <Title order={5}>Costo plan vs real por etapa</Title>

        {costos.length === 0 ? (
          <Box p="xl" ta="center">
            <Text c="dimmed">Sin datos de costos para la selección</Text>
          </Box>
        ) : (
          <div ref={contenedorRef} style={{ width: '100%', height: 320 }} />
        )}
      </Stack>
    </Card>
  );
}
