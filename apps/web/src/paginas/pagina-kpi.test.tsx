import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { KpiDetalleRespuesta, KpiProyectoResumen } from '@autofix/core';
import { CLAVE_PROYECTO, CLAVE_ROL } from '../sesion/almacenamiento';
import { ProveedorSesion } from '../sesion/proveedor-sesion';
import { PaginaKpi } from './pagina-kpi';

vi.mock('echarts/core', () => ({
  use: vi.fn(),
  init: vi.fn().mockReturnValue({
    setOption: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
  }),
}));

describe('PaginaKpi', () => {
  const kpisMock: KpiDetalleRespuesta[] = [
    {
      id: 1,
      codigo: 'SPI',
      nombre: 'Índice de desempeño del cronograma',
      descripcion: 'Relación entre el valor ganado y el planificado.',
      ambito: 'PROYECTO',
      formula: 'EV / PV',
      unidad: 'INDICE',
      meta: 1,
      direccion: 'MAYOR_MEJOR',
      esAdicional: false,
      activo: true,
      umbrales: { verde: 0.95, amarillo: 0.85 },
    },
    {
      id: 2,
      codigo: 'AVANCE_REAL_PCT',
      nombre: 'Avance real consolidado',
      descripcion: null,
      ambito: 'PROYECTO',
      formula: 'AVANCE_REAL',
      unidad: 'PORCENTAJE',
      meta: 100,
      direccion: 'MAYOR_MEJOR',
      esAdicional: false,
      activo: true,
      umbrales: { verde: null, amarillo: null },
    },
    {
      id: 3,
      codigo: 'DURACION_REAL',
      nombre: 'Duración real del proyecto',
      descripcion: null,
      ambito: 'PROYECTO',
      formula: 'DURACION_REAL',
      unidad: 'DIAS',
      meta: 30,
      direccion: 'MENOR_MEJOR',
      esAdicional: false,
      activo: true,
      umbrales: { verde: null, amarillo: null },
    },
  ];

  const resumenesMock: KpiProyectoResumen[] = [
    {
      kpiId: 1,
      codigo: 'SPI',
      nombre: 'Índice de desempeño del cronograma',
      descripcion: null,
      ambito: 'PROYECTO',
      unidad: 'INDICE',
      meta: 1,
      direccion: 'MAYOR_MEJOR',
      valor: 0.965,
      semaforo: 'VERDE',
      medidoEn: '2026-11-06T12:00:00Z',
      origen: 'corte=2026-11-16;base=LB1',
      umbrales: { verde: 0.95, amarillo: 0.85 },
    },
    {
      kpiId: 2,
      codigo: 'AVANCE_REAL_PCT',
      nombre: 'Avance real consolidado',
      descripcion: null,
      ambito: 'PROYECTO',
      unidad: 'PORCENTAJE',
      meta: 100,
      direccion: 'MAYOR_MEJOR',
      valor: null,
      semaforo: null,
      medidoEn: null,
      origen: null,
      umbrales: { verde: null, amarillo: null },
    },
    {
      kpiId: 3,
      codigo: 'DURACION_REAL',
      nombre: 'Duración real del proyecto',
      descripcion: null,
      ambito: 'PROYECTO',
      unidad: 'DIAS',
      meta: 30,
      direccion: 'MENOR_MEJOR',
      valor: 15,
      semaforo: null,
      medidoEn: '2026-11-06T12:00:00Z',
      origen: 'corte=2026-11-16;base=LB1',
      umbrales: { verde: null, amarillo: null },
    },
  ];

  beforeEach(() => {
    localStorage.setItem(CLAVE_PROYECTO, '1');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/proyectos/1/kpi')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(resumenesMock),
          });
        }
        if (url.includes('/kpi')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(kpisMock),
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
      }),
    );
  });

  const renderConRol = (rol = 'JP') => {
    localStorage.setItem(CLAVE_ROL, rol);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <MantineProvider>
          <ProveedorSesion>
            <PaginaKpi />
          </ProveedorSesion>
        </MantineProvider>
      </QueryClientProvider>,
    );
  };

  it('renderiza la tabla de KPI con sus valores calculados o N/D y semáforos', async () => {
    renderConRol('JP');

    expect(await screen.findByText('Indicadores Clave de Desempeño (KPI)')).toBeInTheDocument();
    expect(await screen.findByText('SPI')).toBeInTheDocument();
    expect(screen.getByText('AVANCE_REAL_PCT')).toBeInTheDocument();

    expect(screen.getByText('Verde')).toBeInTheDocument();
    expect(screen.getAllByText('N/D').length).toBeGreaterThan(0);
  });

  it('permite al rol JP abrir el modal para crear un nuevo KPI', async () => {
    renderConRol('JP');

    const botonNuevo = await screen.findByRole('button', { name: /Nuevo KPI/i });
    expect(botonNuevo).not.toHaveAttribute('aria-disabled');

    fireEvent.click(botonNuevo);
    expect(await screen.findByText('Nuevo KPI')).toBeInTheDocument();
  });

  it('bloquea la acción de crear KPI para el rol CC', async () => {
    renderConRol('CC');

    const botonNuevo = await screen.findByRole('button', { name: /Nuevo KPI/i });
    expect(botonNuevo).toHaveAttribute('aria-disabled', 'true');
  });

  it('permite filtrar indicadores en la tabla mediante el buscador', async () => {
    renderConRol('JP');

    expect(await screen.findByText('SPI')).toBeInTheDocument();
    expect(screen.getByText('AVANCE_REAL_PCT')).toBeInTheDocument();

    const campoBuscar = screen.getByPlaceholderText(/Buscar por código, nombre o descripción/i);
    fireEvent.change(campoBuscar, { target: { value: 'cronograma' } });

    expect(screen.getByText('SPI')).toBeInTheDocument();
    expect(screen.queryByText('AVANCE_REAL_PCT')).not.toBeInTheDocument();
  });

  it('A5: muestra Sin umbral cuando un indicador tiene valor pero carece de umbrales configurados', async () => {
    renderConRol('JP');

    expect(await screen.findByText('DURACION_REAL')).toBeInTheDocument();
    expect(screen.getByText('Sin umbral')).toBeInTheDocument();
  });

  it('A5: muestra las unidades en espanol y boton de historial accesible', async () => {
    renderConRol('JP');

    expect(await screen.findByText('SPI')).toBeInTheDocument();
    expect(screen.getByText('Índice')).toBeInTheDocument();
    expect(screen.getByText('Porcentaje')).toBeInTheDocument();
    expect(screen.getByText('Días')).toBeInTheDocument();

    const botonesHistorial = screen.getAllByRole('button', { name: /Ver historial del KPI/i });
    expect(botonesHistorial.length).toBeGreaterThan(0);
  });
});
