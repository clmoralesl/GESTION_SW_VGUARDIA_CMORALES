import { useMemo } from 'react';
import { useComputedColorScheme, useMantineTheme, type MantineTheme } from '@mantine/core';
import type { EstadoHito } from '@autofix/core';

export interface PaletaGantt {
  fondo: string;
  fondoGrilla: string;
  fondoEncabezado: string;
  fondoNoHabil: string;
  borde: string;
  bordeEncabezado: string;
  texto: string;
  textoAtenuado: string;
  barraNormal: string;
  barraNormalAvance: string;
  barraAtrasada: string;
  barraAtrasadaAvance: string;
  barraResumen: string;
  barraResumenAvance: string;
  barraLineaBase: string;
  contornoCritica: string;
  lineaHoy: string;
  flecha: string;
  flechaCritica: string;
  hitos: Record<EstadoHito, string>;
}

export function resolverPaletaGantt(theme: MantineTheme, esquema: 'light' | 'dark'): PaletaGantt {
  const esOscuro = esquema === 'dark';
  return {
    fondo: esOscuro ? theme.colors.dark[7] : '#ffffff',
    fondoGrilla: esOscuro ? theme.colors.dark[8] : '#fafbfc',
    fondoEncabezado: esOscuro ? theme.colors.dark[6] : '#f1f3f5',
    fondoNoHabil: esOscuro ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
    borde: esOscuro ? theme.colors.dark[4] : theme.colors.gray[3],
    bordeEncabezado: esOscuro ? theme.colors.dark[4] : theme.colors.gray[4],
    texto: esOscuro ? theme.colors.dark[0] : theme.black,
    textoAtenuado: esOscuro ? theme.colors.dark[2] : theme.colors.gray[6],
    barraNormal: esOscuro ? theme.colors.blue[7] : theme.colors.blue[6],
    barraNormalAvance: esOscuro ? theme.colors.blue[9] : theme.colors.blue[8],
    barraAtrasada: esOscuro ? theme.colors.red[7] : theme.colors.red[6],
    barraAtrasadaAvance: esOscuro ? theme.colors.red[9] : theme.colors.red[8],
    barraResumen: esOscuro ? theme.colors.gray[4] : theme.colors.gray[8],
    barraResumenAvance: esOscuro ? theme.colors.gray[2] : theme.colors.gray[9],
    barraLineaBase: esOscuro ? theme.colors.gray[6] : theme.colors.gray[5],
    contornoCritica: esOscuro ? theme.colors.orange[5] : theme.colors.orange[8],
    lineaHoy: esOscuro ? theme.colors.red[5] : theme.colors.red[6],
    flecha: esOscuro ? theme.colors.gray[4] : theme.colors.gray[7],
    flechaCritica: esOscuro ? theme.colors.orange[5] : theme.colors.orange[8],
    hitos: {
      CUMPLIDO: esOscuro ? theme.colors.green[5] : theme.colors.green[6],
      EN_RIESGO: esOscuro ? theme.colors.yellow[5] : theme.colors.yellow[6],
      ATRASADO: esOscuro ? theme.colors.red[5] : theme.colors.red[6],
      PENDIENTE: esOscuro ? theme.colors.gray[5] : theme.colors.gray[6],
    },
  };
}

export function usePaletaGantt(): PaletaGantt {
  const theme = useMantineTheme();
  const esquema = useComputedColorScheme('light');
  return useMemo(() => resolverPaletaGantt(theme, esquema), [theme, esquema]);
}
