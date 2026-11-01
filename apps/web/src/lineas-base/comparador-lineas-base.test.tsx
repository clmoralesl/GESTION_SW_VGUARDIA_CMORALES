import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComparadorLineasBase } from './comparador-lineas-base';

describe('ComparadorLineasBase', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/proyectos/1/lineas-base/comparar')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                versionA: 1,
                versionB: 2,
                solicitudCambioId: 2,
                filas: [
                  {
                    tareaId: 10,
                    codigo: '1.2.1',
                    nombre: 'Implementación backend',
                    nivel: 'ACTIVIDAD',
                    estado: 'MODIFICADA',
                    duracionDiasA: 5,
                    duracionDiasB: 8,
                    diferenciaDuracionDias: 3,
                    costoPlanA: 500000,
                    costoPlanB: 800000,
                    diferenciaCostoPlan: 300000,
                    inicioPlanA: '2026-11-02',
                    inicioPlanB: '2026-11-02',
                    finPlanA: '2026-11-06',
                    finPlanB: '2026-11-11',
                  },
                ],
                totales: {
                  tareasModificadas: 1,
                  tareasAgregadas: 0,
                  tareasEliminadas: 0,
                  tareasSinCambio: 0,
                  costoPlanA: 500000,
                  costoPlanB: 800000,
                  diferenciaCostoPlan: 300000,
                  fechaFinProyectoA: '2026-11-06',
                  fechaFinProyectoB: '2026-11-11',
                  diferenciaDiasFinProyecto: 3,
                },
              }),
          });
        }
        if (url.includes('/proyectos/1/lineas-base')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                versiones: [
                  {
                    id: 1,
                    version: 1,
                    descripcion: 'Línea base',
                    solicitudCambioId: null,
                    solicitudCodigo: null,
                    fechaFinProyecto: '2026-11-06',
                    costoPlanTotal: 500000,
                    creadoEn: '2026-10-31T20:00:00.000Z',
                  },
                  {
                    id: 2,
                    version: 2,
                    descripcion: 'Aprobacion SC-002',
                    solicitudCambioId: 2,
                    solicitudCodigo: 'SC-002',
                    fechaFinProyecto: '2026-11-11',
                    costoPlanTotal: 800000,
                    creadoEn: '2026-11-01T20:00:00.000Z',
                  },
                ],
              }),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({}),
        });
      }),
    );
  });

  const renderComponente = () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return render(
      <QueryClientProvider client={queryClient}>
        <MantineProvider>
          <ComparadorLineasBase proyectoId={1} />
        </MantineProvider>
      </QueryClientProvider>,
    );
  };

  it('renderiza selectores y tabla comparativa con resumen de diferencias', async () => {
    renderComponente();
    expect(await screen.findByText(/Comparador de Líneas Base/i)).toBeDefined();
    expect(await screen.findByText('1.2.1')).toBeDefined();
    expect(screen.getByText('Implementación backend')).toBeDefined();
    expect(screen.getByText('MODIFICADA')).toBeDefined();
    expect(screen.getByText('Totales del proyecto')).toBeDefined();
  });
});
