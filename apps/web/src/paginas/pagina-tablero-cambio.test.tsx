import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider, useMutation } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TableroCambio } from '@autofix/core';
import { clienteConsultas } from '../api/cliente-consultas';
import { CLAVE_PROYECTO, CLAVE_ROL } from '../sesion/almacenamiento';
import { ProveedorSesion } from '../sesion/proveedor-sesion';
import { PaginaTableroCambio } from './pagina-tablero-cambio';

vi.mock('echarts/core', () => ({
  use: vi.fn(),
  init: vi.fn().mockReturnValue({
    setOption: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
  }),
}));

describe('PaginaTableroCambio (B8)', () => {
  const tableroMock: TableroCambio = {
    corte: '2026-11-16',
    resumen: {
      total: 5,
      abiertas: 3,
      aprobadas: 2,
      rechazadas: 1,
      tasaAprobacion: 66.67,
      tiempoCicloPromedio: 29,
      adopcionPromedio: 85,
    },
    embudo: [
      { numero: 1, nombre: 'Identificar necesidad', alcanzaron: 5, enEtapa: 1 },
      { numero: 2, nombre: 'Analizar y evaluar', alcanzaron: 4, enEtapa: 1 },
      { numero: 3, nombre: 'Evaluación riesgos', alcanzaron: 3, enEtapa: 0 },
      { numero: 4, nombre: 'Planificación', alcanzaron: 2, enEtapa: 1 },
      { numero: 5, nombre: 'Comunicación', alcanzaron: 1, enEtapa: 0 },
      { numero: 6, nombre: 'Implementación', alcanzaron: 1, enEtapa: 0 },
      { numero: 7, nombre: 'Seguimiento', alcanzaron: 1, enEtapa: 0 },
      { numero: 8, nombre: 'Resultados corto plazo', alcanzaron: 1, enEtapa: 0 },
      { numero: 9, nombre: 'Acciones correctivas', alcanzaron: 1, enEtapa: 0 },
      { numero: 10, nombre: 'Adoptar cambio', alcanzaron: 1, enEtapa: 0 },
    ],
    tiemposPorEtapa: [
      { numero: 1, nombre: 'Identificar necesidad', muestras: 3, promedioDias: 3 },
      { numero: 2, nombre: 'Analizar y evaluar', muestras: 3, promedioDias: 3 },
      { numero: 3, nombre: 'Evaluación riesgos', muestras: 2, promedioDias: 3 },
      { numero: 4, nombre: 'Planificación', muestras: 0, promedioDias: null },
      { numero: 5, nombre: 'Comunicación', muestras: 1, promedioDias: 3 },
      { numero: 6, nombre: 'Implementación', muestras: 1, promedioDias: 3 },
      { numero: 7, nombre: 'Seguimiento', muestras: 1, promedioDias: 3 },
      { numero: 8, nombre: 'Resultados corto plazo', muestras: 0, promedioDias: null },
      { numero: 9, nombre: 'Acciones correctivas', muestras: 1, promedioDias: 3 },
      { numero: 10, nombre: 'Adoptar cambio', muestras: 1, promedioDias: 3 },
    ],
    matrizRiesgo: [
      {
        probabilidad: 3,
        impacto: 4,
        nivel: 'ALTO',
        prioridadMaxima: 'ALTA',
        solicitudes: [{ solicitudId: 2, codigo: 'SC-002', prioridad: 'ALTA' }],
      },
    ],
    adopcion: {
      items: [
        {
          solicitudId: 5,
          codigo: 'SC-005',
          titulo: 'Protocolo sanitización',
          porcentaje: 85,
        },
      ],
      promedio: 85,
    },
    kpis: [
      {
        kpiId: 101,
        codigo: 'CAMBIO_TASA_APROBACION',
        nombre: 'Tasa de aprobación de cambios',
        unidad: 'PORCENTAJE',
        meta: 80,
        valor: 66.6667,
        semaforo: 'AMARILLO',
        historial: [{ medidoEn: '2026-11-16T12:00:00.000Z', valor: 66.6667, semaforo: 'AMARILLO' }],
      },
      {
        kpiId: 102,
        codigo: 'CAMBIO_INDICE_ADOPCION',
        nombre: 'Índice de adopción del cambio',
        unidad: 'PORCENTAJE',
        meta: 80,
        valor: 85,
        semaforo: 'VERDE',
        historial: [{ medidoEn: '2026-11-16T12:00:00.000Z', valor: 85, semaforo: 'VERDE' }],
      },
    ],
    alertas: {
      etapasVencidas: [
        {
          etapaId: 101,
          solicitudId: 1,
          codigo: 'SC-001',
          numero: 1,
          fechaFin: '2026-10-30',
        },
      ],
      riesgosAltos: [
        {
          solicitudId: 2,
          codigo: 'SC-002',
          titulo: 'Integración pasarela',
          nivel: 'ALTO',
          prioridad: 'ALTA',
        },
      ],
      kpiEnRojo: [],
    },
    opciones: {
      responsables: ['Carlos Morales', 'Valeria Guardia'],
    },
  };

  const proyectoMock = {
    id: 1,
    nombre: 'AutoFix · Taller Central',
    descripcion: 'Proyecto central',
    estado: 'EN_CURSO',
  };

  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(CLAVE_PROYECTO, '1');
    localStorage.setItem(CLAVE_ROL, 'JP');

    fetchMock = vi.fn().mockImplementation((input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/proyectos/1/tablero-cambio')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(tableroMock),
        });
      }
      if (url.includes('/proyectos/1')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(proyectoMock),
        });
      }
      return Promise.reject(new Error(`Ruta no mockeada: ${url}`));
    });

    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  function renderConProveedores() {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });

    return render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <MantineProvider>
            <ProveedorSesion>
              <PaginaTableroCambio />
            </ProveedorSesion>
          </MantineProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    );
  }

  it('renderiza tarjetas, gráficos, grilla de kpi y alertas con datos simulados', async () => {
    renderConProveedores();

    await waitFor(() => {
      expect(screen.getByText('Total solicitudes')).toBeInTheDocument();
    });

    expect(screen.getByText('Tablero de gestión del cambio')).toBeInTheDocument();
    expect(screen.getByText('Solicitudes abiertas')).toBeInTheDocument();
    expect(screen.getByText('66.67%')).toBeInTheDocument();
    expect(screen.getByText('29 días')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();

    expect(screen.getByText('Embudo de avance de etapas')).toBeInTheDocument();
    expect(screen.getByText('Matriz de riesgo 5×5 (Probabilidad × Impacto)')).toBeInTheDocument();
    expect(screen.getByText('Tiempo promedio por etapa')).toBeInTheDocument();
    expect(screen.getByText('Adopción por solicitud cerrada')).toBeInTheDocument();

    expect(screen.getByText('Indicadores de gestión del cambio (12 KPI)')).toBeInTheDocument();
    expect(screen.getByText('CAMBIO_TASA_APROBACION')).toBeInTheDocument();
    expect(screen.getByText('CAMBIO_INDICE_ADOPCION')).toBeInTheDocument();

    expect(screen.getByText('Panel de alertas de gestión del cambio')).toBeInTheDocument();
    expect(screen.getByText('Etapas vencidas (1)')).toBeInTheDocument();
    expect(screen.getByText('Riesgos altos (1)')).toBeInTheDocument();

    const insigniasSc002 = screen.getAllByRole('link', { name: 'SC-002' });
    expect(insigniasSc002.length).toBeGreaterThanOrEqual(1);
    expect(insigniasSc002[0]).toHaveAttribute('href', '/cambios/2');
  });

  it('permite acceso con rol CC y mantiene renderizado', async () => {
    localStorage.setItem(CLAVE_ROL, 'CC');
    renderConProveedores();

    await waitFor(() => {
      expect(screen.getByText('Total solicitudes')).toBeInTheDocument();
    });

    expect(screen.getByText('Tablero de gestión del cambio')).toBeInTheDocument();
  });

  it('cambiar un filtro de fecha altera la consulta', async () => {
    renderConProveedores();

    await waitFor(() => {
      expect(screen.getByText('Total solicitudes')).toBeInTheDocument();
    });

    const inputs = screen.getAllByDisplayValue('');
    const inputDesde = inputs.find((i) => i.getAttribute('type') === 'date');
    if (inputDesde) {
      fireEvent.change(inputDesde, { target: { value: '2026-11-01' } });
      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining('desde=2026-11-01'),
          expect.anything(),
        );
      });
    }
  });

  it('la clave del tablero queda invalidada tras una mutación exitosa', async () => {
    const invalidarEspia = vi.spyOn(clienteConsultas, 'invalidateQueries');

    function ComponentePruebaMutacion() {
      const mutacion = useMutation({
        mutationFn: async () => 'ok',
      });
      return (
        <button onClick={() => mutacion.mutate()} type="button">
          Mutar
        </button>
      );
    }

    render(
      <QueryClientProvider client={clienteConsultas}>
        <MantineProvider>
          <ComponentePruebaMutacion />
        </MantineProvider>
      </QueryClientProvider>,
    );

    const botonMutar = screen.getByRole('button', { name: 'Mutar' });
    fireEvent.click(botonMutar);

    await waitFor(() => {
      expect(invalidarEspia).toHaveBeenCalledWith({ queryKey: ['tablero'] });
    });
  });

  it('AJ1 regresion: rango Desde > Hasta mantiene la barra visible, muestra error en Hasta y no llama a la API', async () => {
    renderConProveedores();

    await waitFor(() => {
      expect(screen.getByText('Tablero de gestión del cambio')).toBeInTheDocument();
    });

    const inputDesde = screen.getByLabelText('Desde');
    const inputHasta = screen.getByLabelText('Hasta');

    fireEvent.change(inputDesde, { target: { value: '2026-11-10' } });
    fireEvent.change(inputHasta, { target: { value: '2026-11-01' } });

    expect(screen.getByLabelText('Desde')).toBeInTheDocument();
    expect(
      screen.getByText('La fecha final debe ser igual o posterior a la inicial.'),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining('desde=2026-11-10&hasta=2026-11-01'),
      expect.anything(),
    );
  });

  it('AJ2 regresion: KPI con unidad PORCENTAJE se formatea como 66,67% y no muestra la palabra PORCENTAJE', async () => {
    renderConProveedores();

    await waitFor(() => {
      expect(screen.getByText('Total solicitudes')).toBeInTheDocument();
    });

    expect(screen.getByText('66,67%')).toBeInTheDocument();
    expect(screen.queryByText(/PORCENTAJE/)).not.toBeInTheDocument();
  });
});
