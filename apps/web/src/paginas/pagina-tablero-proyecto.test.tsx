import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider, useMutation } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TableroProyecto } from '@autofix/core';
import { clienteConsultas } from '../api/cliente-consultas';
import { CLAVE_PROYECTO, CLAVE_ROL } from '../sesion/almacenamiento';
import { ProveedorSesion } from '../sesion/proveedor-sesion';
import { PaginaTableroProyecto } from './pagina-tablero-proyecto';

vi.mock('echarts/core', () => ({
  use: vi.fn(),
  init: vi.fn().mockReturnValue({
    setOption: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
  }),
}));

const mockNavigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('PaginaTableroProyecto', () => {
  const tableroMock: TableroProyecto = {
    proyectoId: 1,
    fechaCorte: '2026-11-16',
    tarjetas: {
      avance: { real: 14.29, plan: 81.87, semaforo: null, variacion: 5.72 },
      spi: { valor: 0.2496, semaforo: 'ROJO', variacion: 0.09 },
      cpi: { valor: 0.8, semaforo: 'ROJO', variacion: 0.28 },
      costo: {
        costoReal: 275000,
        presupuesto: 45000000,
        porcentaje: 0.61,
        semaforo: 'ROJO',
        variacion: 65.97,
      },
    },
    curvaS: {
      origen: 'LINEA_BASE',
      puntos: [
        { fecha: '2026-11-02', pv: 48000, ev: 48000, ac: 48000 },
        { fecha: '2026-11-16', pv: 881375, ev: 220000, ac: 275000 },
      ],
    },
    hitos: {
      cumplidos: 1,
      total: 3,
      items: [
        { id: 1, nombre: 'Acta de inicio aprobada', fecha: '2026-10-30', estado: 'CUMPLIDO' },
        {
          id: 2,
          nombre: 'Procesos del taller levantados',
          fecha: '2026-11-06',
          estado: 'ATRASADO',
        },
        {
          id: 3,
          nombre: 'Diseño de la solución aprobado',
          fecha: '2026-11-20',
          estado: 'EN_RIESGO',
        },
      ],
    },
    costoPorEtapa: [
      {
        etapaId: 1,
        codigo: '1',
        nombre: 'Levantamiento y diseño',
        costoPlan: 776500,
        costoReal: 275000,
      },
    ],
    carga: [
      {
        profesionalId: 4,
        nombre: 'Valentina Muñoz',
        ocupacionMaxima: 120,
        diaPico: '2026-11-12',
        sobreasignado: true,
      },
    ],
    atrasadas: [
      {
        tareaId: 4,
        codigo: '1.1.2',
        nombre: 'Mapeo del flujo de órdenes de trabajo',
        diasAtraso: 4,
        responsable: 'Jefe de Taller',
      },
    ],
    alertas: [
      {
        id: 1,
        tipo: 'SOBREASIGNACION',
        severidad: 'ADVERTENCIA',
        mensaje: 'Sobreasignación de Valentina Muñoz',
        creadaEn: '2026-11-01T10:00:00Z',
        entidad: 'Profesional',
        entidadId: 4,
      },
    ],
    opciones: {
      etapas: [{ id: 1, codigo: '1', nombre: 'Levantamiento y diseño' }],
      profesionales: [{ id: 4, nombre: 'Valentina Muñoz' }],
    },
  };

  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem(CLAVE_PROYECTO, '1');
    localStorage.setItem(CLAVE_ROL, 'JP');

    fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/proyectos/1/tablero')) {
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
          json: () =>
            Promise.resolve({
              id: 1,
              nombre: 'AutoFix · Implementación',
              estado: 'EN_CURSO',
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });
    });

    vi.stubGlobal('fetch', fetchMock);
  });

  const renderConProveedores = (cliente = new QueryClient()) => {
    return render(
      <QueryClientProvider client={cliente}>
        <MantineProvider>
          <MemoryRouter>
            <ProveedorSesion>
              <PaginaTableroProyecto />
            </ProveedorSesion>
          </MemoryRouter>
        </MantineProvider>
      </QueryClientProvider>,
    );
  };

  it('renderiza tarjetas, gráficos y tablas con los datos del tablero', async () => {
    renderConProveedores();

    await waitFor(() => {
      expect(screen.getByText('Tablero de comando')).toBeInTheDocument();
    });

    expect(
      screen.getByText('AutoFix · Implementación · Indicadores y seguimiento integral'),
    ).toBeInTheDocument();
    expect(screen.getByText('0.2496')).toBeInTheDocument();
    expect(screen.getByText('0.8')).toBeInTheDocument();
    expect(screen.getByText('14.29%')).toBeInTheDocument();
    expect(screen.getByText('Curva S del proyecto')).toBeInTheDocument();
    expect(screen.getByText('EV y AC estimados por reparto lineal')).toBeInTheDocument();
    expect(screen.getByText('Costo plan vs real por etapa')).toBeInTheDocument();
    expect(screen.getByText('% de ocupación (pico diario)')).toBeInTheDocument();
    expect(screen.getByText('Hitos del proyecto')).toBeInTheDocument();
    expect(screen.getByText('1 / 3 cumplidos')).toBeInTheDocument();
    expect(screen.getByText('Mapeo del flujo de órdenes de trabajo')).toBeInTheDocument();
    expect(screen.getByText('Sobreasignación de Valentina Muñoz')).toBeInTheDocument();
  });

  it('cambiar un filtro de fecha altera la consulta', async () => {
    renderConProveedores();

    await waitFor(() => {
      expect(screen.getByText('Tablero de comando')).toBeInTheDocument();
    });

    const inputs = screen.getAllByDisplayValue('');
    const inputDesde = inputs.find((i) => i.getAttribute('type') === 'date');
    if (inputDesde) {
      fireEvent.change(inputDesde, { target: { value: '2026-11-02' } });
      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining('desde=2026-11-02'),
          expect.anything(),
        );
      });
    }
  });

  it('al hacer clic en una tarea atrasada navega a /gantt?tarea=<id>', async () => {
    renderConProveedores();

    await waitFor(() => {
      expect(screen.getByText('Mapeo del flujo de órdenes de trabajo')).toBeInTheDocument();
    });

    const filaAtrasada = screen.getByRole('button', {
      name: /Ver tarea 1.1.2 en Gantt/i,
    });
    fireEvent.click(filaAtrasada);

    expect(mockNavigate).toHaveBeenCalledWith('/gantt?tarea=4');
  });

  it('una mutación exitosa invalida la consulta del tablero', async () => {
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
});
