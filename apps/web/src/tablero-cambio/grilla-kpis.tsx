import { useEffect, useRef } from 'react';
import { Badge, Box, Card, Group, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { TableroCambio, UnidadKpi } from '@autofix/core';
import { formatearValorKpi, obtenerColorSemaforo } from '../kpi/formato-kpi';

echarts.use([GridComponent, TooltipComponent, LineChart, CanvasRenderer]);

interface MiniGraficoHistorialProps {
  historial: { medidoEn: string; valor: number | null }[];
  unidad: UnidadKpi;
}

function MiniGraficoHistorial({ historial, unidad }: MiniGraficoHistorialProps) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!ref.current || historial.length === 0) return;
    if (!chartRef.current) {
      chartRef.current = echarts.init(ref.current);
    }
    const chart = chartRef.current;

    const opcion: echarts.EChartsCoreOption = {
      grid: { left: 4, right: 4, top: 4, bottom: 4 },
      xAxis: {
        type: 'category',
        show: false,
        data: historial.map((h) => h.medidoEn),
      },
      yAxis: {
        type: 'value',
        show: false,
      },
      tooltip: {
        trigger: 'axis',
        formatter: (params: unknown) => {
          const list = params as { dataIndex: number }[] | undefined;
          const primerElem = list?.[0];
          if (!primerElem) return '';
          const idx = primerElem.dataIndex;
          const h = historial[idx];
          const fecha = h?.medidoEn ? h.medidoEn.slice(0, 10) : '';
          const valorFmt = formatearValorKpi(h?.valor, unidad);
          return `${fecha}: <strong>${valorFmt}</strong>`;
        },
      },
      series: [
        {
          type: 'line',
          data: historial.map((h) => h.valor),
          showSymbol: false,
          smooth: true,
          lineStyle: { width: 2, color: '#228be6' },
          areaStyle: { color: 'rgba(34, 139, 230, 0.15)' },
        },
      ],
    };

    chart.setOption(opcion);

    const redimensionar = () => chart.resize();
    window.addEventListener('resize', redimensionar);
    return () => window.removeEventListener('resize', redimensionar);
  }, [historial, unidad]);

  useEffect(() => {
    return () => {
      if (chartRef.current) {
        chartRef.current.dispose();
        chartRef.current = null;
      }
    };
  }, []);

  if (historial.length === 0) {
    return (
      <Box style={{ height: 45, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Text size="xs" c="dimmed">
          Sin historial
        </Text>
      </Box>
    );
  }

  return <Box ref={ref} style={{ width: '100%', height: 45 }} />;
}

interface GrillaKpisProps {
  kpis: TableroCambio['kpis'];
}

export function GrillaKpis({ kpis }: GrillaKpisProps) {
  return (
    <Card withBorder padding="md" radius="md">
      <Stack gap="md">
        <Group justify="space-between">
          <Title order={4}>Indicadores de gestión del cambio (12 KPI)</Title>
          <Badge variant="light" color="blue" size="sm">
            {kpis.length} indicadores
          </Badge>
        </Group>

        <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="sm">
          {kpis.map((k) => (
            <Card key={k.kpiId} withBorder padding="xs" radius="sm">
              <Stack gap={4}>
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  <Badge size="xs" variant="outline" color="gray">
                    {k.codigo}
                  </Badge>
                  {k.semaforo ? (
                    <Badge
                      size="xs"
                      color={obtenerColorSemaforo(k.semaforo)}
                      style={{ flexShrink: 0 }}
                    >
                      {k.semaforo}
                    </Badge>
                  ) : (
                    <Badge size="xs" color="gray" variant="light" style={{ flexShrink: 0 }}>
                      N/D
                    </Badge>
                  )}
                </Group>

                <Text size="xs" fw={600} lineClamp={1} title={k.nombre}>
                  {k.nombre}
                </Text>

                <Group justify="space-between" align="baseline">
                  <Text size="md" fw={700}>
                    {formatearValorKpi(k.valor, k.unidad)}
                  </Text>
                  {k.meta !== null ? (
                    <Text size="10px" c="dimmed">
                      Meta: {formatearValorKpi(k.meta, k.unidad)}
                    </Text>
                  ) : null}
                </Group>

                <MiniGraficoHistorial historial={k.historial} unidad={k.unidad} />
              </Stack>
            </Card>
          ))}
        </SimpleGrid>

        <Text size="xs" c="dimmed" ta="center">
          Los indicadores de cambio reflejan mediciones del proyecto completo y no dependen de los
          filtros.
        </Text>
      </Stack>
    </Card>
  );
}
