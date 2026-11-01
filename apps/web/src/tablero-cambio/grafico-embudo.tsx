import { useEffect, useRef } from 'react';
import { Box, Card, Stack, Title } from '@mantine/core';
import * as echarts from 'echarts/core';
import { FunnelChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
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
  FunnelChart,
  CanvasRenderer,
]);

interface GraficoEmbudoProps {
  embudo: TableroCambio['embudo'];
}

export function GraficoEmbudo({ embudo }: GraficoEmbudoProps) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const instanciaRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!contenedorRef.current) return;

    if (!instanciaRef.current) {
      instanciaRef.current = echarts.init(contenedorRef.current);
    }
    const chart = instanciaRef.current;

    const maxAlcanzaron = Math.max(...embudo.map((e) => e.alcanzaron), 1);

    const opcion: echarts.EChartsCoreOption = {
      tooltip: {
        trigger: 'item',
        formatter: (params: unknown) => {
          const p = params as { name: string; value: number; data: { enEtapa: number } };
          return `<strong>${p.name}</strong><br/>Alcanzaron: ${p.value}<br/>En esta etapa ahora: ${p.data.enEtapa}`;
        },
      },
      series: [
        {
          name: 'Embudo de etapas',
          type: 'funnel',
          left: '5%',
          top: 20,
          bottom: 20,
          width: '90%',
          min: 0,
          max: maxAlcanzaron,
          minSize: '10%',
          maxSize: '100%',
          sort: 'none',
          gap: 2,
          label: {
            show: true,
            position: 'inside',
            formatter: (params: unknown) => {
              const p = params as { name: string; value: number };
              return `${p.name}: ${p.value}`;
            },
            color: '#fff',
            textBorderColor: 'rgba(0,0,0,0.45)',
            textBorderWidth: 2,
            fontSize: 11,
          },
          itemStyle: {
            borderColor: '#fff',
            borderWidth: 1,
          },
          data: embudo.map((e) => ({
            name: `${e.numero}. ${e.nombre}`,
            value: e.alcanzaron,
            enEtapa: e.enEtapa,
          })),
        },
      ],
    };

    chart.setOption(opcion);

    const redimensionar = () => chart.resize();
    window.addEventListener('resize', redimensionar);

    return () => {
      window.removeEventListener('resize', redimensionar);
    };
  }, [embudo]);

  useEffect(() => {
    return () => {
      if (instanciaRef.current) {
        instanciaRef.current.dispose();
        instanciaRef.current = null;
      }
    };
  }, []);

  return (
    <Card withBorder padding="md" radius="md">
      <Stack gap="sm">
        <Title order={4}>Embudo de avance de etapas</Title>
        <Box ref={contenedorRef} style={{ width: '100%', height: 400 }} />
      </Stack>
    </Card>
  );
}
