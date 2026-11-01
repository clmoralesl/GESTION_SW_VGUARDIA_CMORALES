import { useEffect, useRef } from 'react';
import { Box, Card, Stack, Text, Title } from '@mantine/core';
import * as echarts from 'echarts/core';
import { BarChart } from 'echarts/charts';
import {
  GridComponent,
  MarkLineComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { TableroProyecto } from '@autofix/core';

echarts.use([
  TitleComponent,
  TooltipComponent,
  GridComponent,
  MarkLineComponent,
  BarChart,
  CanvasRenderer,
]);

interface GraficoCargaProfesionalesProps {
  carga: TableroProyecto['carga'];
}

export function GraficoCargaProfesionales({ carga }: GraficoCargaProfesionalesProps) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const instanciaRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!contenedorRef.current || carga.length === 0) return;

    if (!instanciaRef.current) {
      instanciaRef.current = echarts.init(contenedorRef.current);
    }
    const chart = instanciaRef.current;

    const itemsOrdenados = [...carga].reverse();
    const nombres = itemsOrdenados.map((c) => c.nombre);
    const valores = itemsOrdenados.map((c) => ({
      value: c.ocupacionMaxima,
      diaPico: c.diaPico,
      sobreasignado: c.sobreasignado,
      itemStyle: {
        color: c.sobreasignado ? '#fa5252' : '#228be6',
      },
    }));

    const opcion: echarts.EChartsCoreOption = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: unknown) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          const items = params as Array<{
            name?: string;
            value?: number;
            dataIndex?: number;
          }>;
          const item = items[0];
          const raw = item?.dataIndex !== undefined ? itemsOrdenados[item.dataIndex] : undefined;
          const picoInfo = raw?.diaPico ? `Día pico: ${raw.diaPico}` : 'Sin día pico';
          const estado = raw?.sobreasignado
            ? '<span style="color:#fa5252;font-weight:600;">(Sobreasignado)</span>'
            : '';
          return `<div style="font-weight:600;margin-bottom:4px;">${item?.name ?? ''} ${estado}</div>
            <div>Ocupación máxima: <strong>${item?.value ?? 0}%</strong></div>
            <div style="font-size:11px;color:#868e96;">${picoInfo}</div>`;
        },
      },
      grid: {
        left: '3%',
        right: '8%',
        bottom: '3%',
        top: '5%',
        containLabel: true,
      },
      xAxis: {
        type: 'value',
        axisLabel: {
          formatter: '{value}%',
        },
      },
      yAxis: {
        type: 'category',
        data: nombres,
      },
      series: [
        {
          name: 'Ocupación',
          type: 'bar',
          data: valores,
          markLine: {
            silent: true,
            data: [
              {
                xAxis: 100,
                lineStyle: { color: '#fa5252', type: 'dashed', width: 2 },
                label: { formatter: '100%', position: 'end' },
              },
            ],
          },
        },
      ],
    };

    chart.setOption(opcion);

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [carga]);

  return (
    <Card withBorder padding="md" radius="md">
      <Stack gap="xs">
        <Title order={5}>% de ocupación (pico diario)</Title>

        {carga.length === 0 ? (
          <Box p="xl" ta="center">
            <Text c="dimmed">Sin asignaciones de profesionales en la selección</Text>
          </Box>
        ) : (
          <div
            ref={contenedorRef}
            style={{ width: '100%', height: Math.max(220, carga.length * 40) }}
          />
        )}
      </Stack>
    </Card>
  );
}
