import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RegistroBitacora, RespuestaBitacora } from '@autofix/core';
import { TablaHistorial } from '../bitacora/tabla-historial';
import { ProveedorSesion } from '../sesion/proveedor-sesion';
import { PaginaBitacora } from './pagina-bitacora';

const mockRegistros: RegistroBitacora[] = [
  {
    id: 1,
    proyectoId: 1,
    fecha: '2026-11-02T10:00:00.000Z',
    rol: 'JP',
    entidad: 'Tarea',
    entidadId: 5,
    accion: 'ACTUALIZAR',
    campo: 'configuracion',
    valorAnterior: { duracionDias: 3, costo: 1000 },
    valorNuevo: { duracionDias: 5, costo: 1500 },
    origen: {
      tipo: 'APROBACION',
      etiqueta: 'Aprobación SC-002',
      solicitudCambioId: 2,
      detalle: 'Aprobado en comité',
    },
  },
  {
    id: 2,
    proyectoId: 1,
    fecha: '2026-11-02T11:00:00.000Z',
    rol: 'JP',
    entidad: 'Tarea',
    entidadId: 5,
    accion: 'RECALCULAR',
    campo: null,
    valorAnterior: null,
    valorNuevo: 'Recálculo automático',
    origen: {
      tipo: 'RECALCULO',
      etiqueta: 'Recálculo',
      solicitudCambioId: null,
      detalle: 'Propagación de holguras',
    },
  },
];

const mockRespuesta: RespuestaBitacora = {
  registros: mockRegistros,
  total: 50,
  pagina: 3,
  tamanoPagina: 25,
  totalPaginas: 2,
};

function UbicacionActual() {
  const location = useLocation();
  return <div data-testid="ubicacion-actual">{location.search}</div>;
}

function crearEntorno(rutaInicial = '/bitacora') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <MantineProvider>
      <QueryClientProvider client={queryClient}>
        <ProveedorSesion>
          <MemoryRouter initialEntries={[rutaInicial]}>
            <UbicacionActual />
            <Routes>
              <Route path="/bitacora" element={<PaginaBitacora />} />
            </Routes>
          </MemoryRouter>
        </ProveedorSesion>
      </QueryClientProvider>
    </MantineProvider>,
  );
}

describe('Bloque B - Bitácora y trazabilidad', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockRespuesta),
        }),
      ),
    );
  });

  it('la tabla resume objetos sin JSON crudo y permite ver detalles en popover', async () => {
    const user = userEvent.setup();
    render(
      <MantineProvider>
        <MemoryRouter>
          <TablaHistorial registros={mockRegistros} />
        </MemoryRouter>
      </MantineProvider>,
    );

    const badges = screen.getAllByText('2 campos');
    expect(badges.length).toBeGreaterThan(0);

    expect(screen.queryByText(/\{"duracionDias":3/)).toBeNull();
    expect(screen.queryByText(/\{"duracionDias":5/)).toBeNull();

    const primerBadge = badges[0];
    expect(primerBadge).toBeDefined();
    if (primerBadge) {
      await user.click(primerBadge);
    }
    expect(await screen.findByText('duracionDias:')).toBeDefined();
    expect(screen.getByText('3')).toBeDefined();
  });

  it('el enlace aparece solo cuando solicitudCambioId existe', () => {
    render(
      <MantineProvider>
        <MemoryRouter>
          <TablaHistorial registros={mockRegistros} />
        </MemoryRouter>
      </MantineProvider>,
    );

    const enlaceSolicitud = screen.getByRole('link', { name: /Aprobación SC-002/i });
    expect(enlaceSolicitud).toBeDefined();
    expect(enlaceSolicitud.getAttribute('href')).toBe('/cambios/2');

    const badgeRecalculo = screen.getByText('Recálculo');
    expect(badgeRecalculo.closest('a')).toBeNull();
  });

  it('ocultarEntidad omite la columna Entidad en detalle de tarea o solicitud', () => {
    const { rerender } = render(
      <MantineProvider>
        <MemoryRouter>
          <TablaHistorial registros={mockRegistros} ocultarEntidad={false} />
        </MemoryRouter>
      </MantineProvider>,
    );

    expect(screen.getByText('Entidad')).toBeDefined();

    rerender(
      <MantineProvider>
        <MemoryRouter>
          <TablaHistorial registros={mockRegistros} ocultarEntidad={true} />
        </MemoryRouter>
      </MantineProvider>,
    );

    expect(screen.queryByText('Entidad')).toBeNull();
  });

  it('el filtro de rol usa los nombres de rol del dominio', async () => {
    const user = userEvent.setup();
    crearEntorno('/bitacora');

    await user.click(screen.getByRole('textbox', { name: 'Rol' }));

    expect(await screen.findByText('Comité de Cambios (CC)')).toBeDefined();
    expect(screen.getByText('Jefe de Proyecto (JP)')).toBeDefined();
  });

  it('cambiar un filtro vuelve a la pagina 1', async () => {
    crearEntorno('/bitacora?pagina=3');

    const ubicacion = screen.getByTestId('ubicacion-actual');
    expect(ubicacion.textContent).toContain('pagina=3');

    const selectorAlcance = screen.getByRole('radio', { name: 'Todos los proyectos' });
    fireEvent.click(selectorAlcance);

    expect(ubicacion.textContent).toContain('pagina=1');
  });
});
