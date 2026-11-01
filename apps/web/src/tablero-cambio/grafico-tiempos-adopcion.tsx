import { useEffect, useRef } from 'react';
import { Alert, Box, Card, Grid, Stack, Text, Title } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import * as echarts from 'echarts/core';
import { BarChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { TableroCambio } from '@autofix/core';

echarts.use([
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  BarChart,
  CanvasRenderer,
]);

interface GraficoTiemposAdopcionProps {
  tiempos: TableroCambio['tiemposPorEtapa'];
  adopcion: TableroCambio['adopcion'];
}

export function GraficoTiemposAdopcion({ tiempos, adopcion }: GraficoTiemposAdopcionProps) {
  const tiemposRef = useRef<HTMLDivElement>(null);
  const adopcionRef = useRef<HTMLDivElement>(null);

  const chartTiemposRef = useRef<echarts.ECharts | null>(null);
  const chartAdopcionRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!tiemposRef.current) return;
    if (!chartTiemposRef.current) {
      chartTiemposRef.current = echarts.init(tiemposRef.current);
    }
    const chart = chartTiemposRef.current;

    const nombres = tiempos.map((t) => `E${t.numero}`);
    const valores = tiempos.map((t) => t.promedioDias ?? 0);

    const opcion: echarts.EChartsCoreOption = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: unknown) => {
          const list = params as { dataIndex: number }[] | undefined;
          const primerElem = list?.[0];
          if (!primerElem) return '';
          const item = tiempos[primerElem.dataIndex];
          if (!item) return '';
          const texto =
            item.promedioDias !== null
              ? `${item.promedioDias} días (${item.muestras} muestras)`
              : 'Sin datos (0 muestras)';
          return `<strong>Etapa ${item.numero}: ${item.nombre}</strong><br/>Tiempo promedio: ${texto}`;
        },
      },
      grid: { left: 40, right: 20, top: 20, bottom: 30 },
      xAxis: {
        type: 'category',
        data: nombres,
        axisLabel: { interval: 0, fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        name: 'Días',
      },
      series: [
        {
          name: 'Días promedio',
          type: 'bar',
          data: valores.map((v, i) => {
            const item = tiempos[i];
            return {
              value: v,
              itemStyle: {
                color: item?.promedioDias !== null ? '#228be6' : '#e9ecef',
              },
            };
          }),
          label: {
            show: true,
            position: 'top',
            formatter: (params: unknown) => {
              const p = params as { dataIndex: number };
              const item = tiempos[p.dataIndex];
              return item?.promedioDias !== null ? `${item?.promedioDias}d` : 'Sin datos';
            },
            fontSize: 10,
          },
        },
      ],
    };

    chart.setOption(opcion);

    const redimensionar = () => chart.resize();
    window.addEventListener('resize', redimensionar);
    return () => window.removeEventListener('resize', redimensionar);
  }, [tiempos]);

  useEffect(() => {
    if (!adopcionRef.current || adopcion.items.length === 0) return;
    if (!chartAdopcionRef.current) {
      chartAdopcionRef.current = echarts.init(adopcionRef.current);
    }
    const chart = chartAdopcionRef.current;

    const codigos = adopcion.items.map((i) => i.codigo);
    const porcentajes = adopcion.items.map((i) => i.porcentaje);

    const opcion: echarts.EChartsCoreOption = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: unknown) => {
          const list = params as { dataIndex: number }[] | undefined;
          const primerElem = list?.[0];
          if (!primerElem) return '';
          const item = adopcion.items[primerElem.dataIndex];
          if (!item) return '';
          return `<strong>${item.codigo} - ${item.titulo}</strong><br/>Adopción etapa 10: ${item.porcentaje}%`;
        },
      },
      grid: { left: 70, right: 40, top: 20, bottom: 30 },
      xAxis: {
        type: 'value',
        min: 0,
        max: 100,
        axisLabel: { formatter: '{value}%' },
      },
      yAxis: {
        type: 'category',
        data: codigos,
        axisLabel: { fontSize: 11 },
      },
      series: [
        {
          name: 'Adopción',
          type: 'bar',
          data: porcentajes,
          itemStyle: { color: '#40c057' },
          label: {
            show: true,
            position: 'right',
            formatter: '{c}%',
            fontSize: 10,
          },
          markLine:
            adopcion.promedio !== null
              ? {
                  data: [{ xAxis: adopcion.promedio, name: 'Promedio' }],
                  lineStyle: { color: '#fa5252', type: 'dashed', width: 2 },
                  label: {
                    formatter: `Promedio: ${adopcion.promedio}%`,
                    position: 'end',
                  },
                }
              : undefined,
        },
      ],
    };

    chart.setOption(opcion);

    const redimensionar = () => chart.resize();
    window.addEventListener('resize', redimensionar);
    return () => window.removeEventListener('resize', redimensionar);
  }, [adopcion]);

  useEffect(() => {
    return () => {
      if (chartTiemposRef.current) {
        chartTiemposRef.current.dispose();
        chartTiemposRef.current = null;
      }
      if (chartAdopcionRef.current) {
        chartAdopcionRef.current.dispose();
        chartAdopcionRef.current = null;
      }
    };
  }, []);

  return (
    <Grid gutter="md">
      <Grid.Col span={{ base: 12, md: 6 }}>
        <Card withBorder padding="md" radius="md">
          <Stack gap="xs">
            <Title order={4}>Tiempo promedio por etapa</Title>
            <Text size="xs" c="dimmed">
              Días corridos inclusive para etapas completadas
            </Text>
            <Box ref={tiemposRef} style={{ width: '100%', height: 320 }} />
          </Stack>
        </Card>
      </Grid.Col>

      <Grid.Col span={{ base: 12, md: 6 }}>
        <Card withBorder padding="md" radius="md">
          <Stack gap="xs">
            <Title order={4}>Adopción por solicitud cerrada</Title>
            <Text size="xs" c="dimmed">
              Porcentaje registrado en la etapa 10 (con línea de promedio)
            </Text>

            {adopcion.items.length === 0 ? (
              <Box py="xl">
                <Alert
                  icon={<IconInfoCircle size={16} />}
                  title="Sin datos de adopción"
                  color="blue"
                  variant="light"
                >
                  Aún no hay solicitudes cerradas con porcentaje de adopción en este proyecto.
                </Alert>
              </Box>
            ) : (
              <Box ref={adopcionRef} style={{ width: '100%', height: 320 }} />
            )}
          </Stack>
        </Card>
      </Grid.Col>
    </Grid>
  );
}
