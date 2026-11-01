import { useEffect, useRef } from 'react';
import { Badge, Box, Card, Group, Stack, Text, Title } from '@mantine/core';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
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
  LineChart,
  CanvasRenderer,
]);

interface GraficoCurvaSProps {
  curvaS: TableroProyecto['curvaS'];
}

export function GraficoCurvaS({ curvaS }: GraficoCurvaSProps) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const instanciaRef = useRef<echarts.ECharts | null>(null);

  const { puntos, origen } = curvaS;

  useEffect(() => {
    if (!contenedorRef.current || puntos.length === 0) return;

    if (!instanciaRef.current) {
      instanciaRef.current = echarts.init(contenedorRef.current);
    }
    const chart = instanciaRef.current;

    const fechas = puntos.map((p) => p.fecha);
    const seriePv = puntos.map((p) => p.pv);
    const serieEv = puntos.map((p) => p.ev);
    const serieAc = puntos.map((p) => p.ac);

    const opcion: echarts.EChartsCoreOption = {
      tooltip: {
        trigger: 'axis',
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
            const val =
              item.value !== null && item.value !== undefined ? formatearMonto(item.value) : 'N/D';
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
        data: ['Valor Planificado (PV)', 'Valor Ganado (EV)', 'Costo Real (AC)'],
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
        boundaryGap: false,
        data: fechas,
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (v: number) => formatearMonto(v),
        },
      },
      series: [
        {
          name: 'Valor Planificado (PV)',
          type: 'line',
          data: seriePv,
          smooth: true,
          connectNulls: false,
          itemStyle: { color: '#1c7ed6' },
          lineStyle: { width: 3 },
        },
        {
          name: 'Valor Ganado (EV)',
          type: 'line',
          data: serieEv,
          smooth: true,
          connectNulls: false,
          itemStyle: { color: '#2f9e44' },
          lineStyle: { width: 3 },
        },
        {
          name: 'Costo Real (AC)',
          type: 'line',
          data: serieAc,
          smooth: true,
          connectNulls: false,
          itemStyle: { color: '#f76707' },
          lineStyle: { width: 3 },
        },
      ],
    };

    chart.setOption(opcion);

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [puntos]);

  return (
    <Card withBorder padding="md" radius="md">
      <Stack gap="xs">
        <Group justify="space-between">
          <div>
            <Title order={5}>Curva S del proyecto</Title>
            <Text size="xs" c="dimmed">
              EV y AC estimados por reparto lineal
            </Text>
          </div>
          <Badge variant="light" color={origen === 'LINEA_BASE' ? 'blue' : 'gray'}>
            Origen: {origen === 'LINEA_BASE' ? 'Línea base' : 'Plan actual'}
          </Badge>
        </Group>

        {puntos.length === 0 ? (
          <Box p="xl" ta="center">
            <Text c="dimmed">Sin datos para la curva S</Text>
          </Box>
        ) : (
          <div ref={contenedorRef} style={{ width: '100%', height: 320 }} />
        )}
      </Stack>
    </Card>
  );
}
