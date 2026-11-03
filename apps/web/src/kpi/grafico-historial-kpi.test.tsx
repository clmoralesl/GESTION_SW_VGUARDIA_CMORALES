import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import * as echarts from 'echarts/core';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { KpiDetalleRespuesta } from '@autofix/core';
import { GraficoHistorialKpi } from './grafico-historial-kpi';

vi.mock('echarts/core', () => ({
  use: vi.fn(),
  init: vi.fn(),
}));

const kpi: KpiDetalleRespuesta = {
  id: 1,
  codigo: 'SPI',
  nombre: 'Índice de desempeño del cronograma',
  descripcion: null,
  ambito: 'PROYECTO',
  formula: 'EV / PV',
  unidad: 'INDICE',
  meta: 1,
  direccion: 'MAYOR_MEJOR',
  esAdicional: false,
  activo: true,
  umbrales: { verde: 0.95, amarillo: 0.85 },
};

const mediciones = [
  { id: 1, kpiId: 1, valor: 0.8, medidoEn: '2026-11-10T12:00:00.000Z', origen: 'RECALCULO' },
  { id: 2, kpiId: 1, valor: 0.9, medidoEn: '2026-11-12T12:00:00.000Z', origen: 'RECALCULO' },
];

function crearCliente() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function envolver(cliente: QueryClient, contenido: ReactNode) {
  return (
    <MantineProvider>
      <QueryClientProvider client={cliente}>{contenido}</QueryClientProvider>
    </MantineProvider>
  );
}

describe('GraficoHistorialKpi', () => {
  const instancias: Array<{
    setOption: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
  }> = [];

  beforeEach(() => {
    instancias.length = 0;
    vi.mocked(echarts.init).mockReset();
    vi.mocked(echarts.init).mockImplementation(() => {
      const instancia = { setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn() };
      instancias.push(instancia);
      return instancia as unknown as ReturnType<typeof echarts.init>;
    });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(mediciones) }),
        ),
    );
  });

  it('vuelve a dibujar el grafico al reabrir el historial con las mediciones en cache', async () => {
    const cliente = crearCliente();
    const props = { alCerrar: vi.fn(), kpi, proyectoId: 1 };
    const { rerender } = render(envolver(cliente, <GraficoHistorialKpi abierto {...props} />));

    await waitFor(() => expect(instancias[0]?.setOption).toHaveBeenCalled());

    rerender(envolver(cliente, <GraficoHistorialKpi abierto={false} {...props} />));
    await waitFor(() => expect(instancias[0]?.dispose).toHaveBeenCalled());

    rerender(envolver(cliente, <GraficoHistorialKpi abierto {...props} />));

    await waitFor(() => expect(instancias[1]?.setOption).toHaveBeenCalled());
    expect(echarts.init).toHaveBeenCalledTimes(2);
  });

  it('muestra la leyenda de la serie, la meta, los umbrales y las zonas', async () => {
    render(
      envolver(
        crearCliente(),
        <GraficoHistorialKpi abierto alCerrar={vi.fn()} kpi={kpi} proyectoId={1} />,
      ),
    );

    expect(await screen.findByText('Valor medido')).toBeDefined();
    expect(screen.getByText('Meta (1,00)')).toBeDefined();
    expect(screen.getByText('Umbral verde (0,95)')).toBeDefined();
    expect(screen.getByText('Umbral amarillo (0,85)')).toBeDefined();
    expect(screen.getByText('Zona verde')).toBeDefined();
    expect(screen.getByText('Zona amarilla')).toBeDefined();
    expect(screen.getByText('Zona roja')).toBeDefined();
  });
});
