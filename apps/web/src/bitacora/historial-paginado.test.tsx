import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RespuestaBitacora } from '@autofix/core';
import { ProveedorSesion } from '../sesion/proveedor-sesion';
import { HistorialSolicitudPanel, HistorialTareaPanel } from './historial-paginado';

const respuesta: RespuestaBitacora = {
  registros: [
    {
      id: 40,
      proyectoId: 1,
      fecha: '2026-11-02T10:00:00.000Z',
      rol: 'CC',
      entidad: 'Tarea',
      entidadId: 6,
      accion: 'ACTUALIZAR',
      campo: 'duracionDias',
      valorAnterior: 5,
      valorNuevo: 8,
      origen: {
        tipo: 'APROBACION',
        etiqueta: 'Aprobación SC-002',
        solicitudCambioId: 2,
        detalle: null,
      },
    },
  ],
  total: 30,
  pagina: 1,
  tamanoPagina: 25,
  totalPaginas: 2,
};

function envolver(contenido: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MantineProvider>
      <QueryClientProvider client={queryClient}>
        <ProveedorSesion>
          <MemoryRouter>{contenido}</MemoryRouter>
        </ProveedorSesion>
      </QueryClientProvider>
    </MantineProvider>,
  );
}

describe('Pestañas Historial paginadas', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(respuesta) }),
        ),
    );
  });

  it('el historial de solicitud muestra la entidad, el total y el paginador', async () => {
    envolver(<HistorialSolicitudPanel solicitudId={2} />);

    expect(await screen.findByText('Página 1 de 2 (30 registros en total)')).toBeDefined();
    expect(screen.getByText('Entidad')).toBeDefined();
    expect(screen.getByText('Tarea #6')).toBeDefined();
    expect(screen.getByRole('button', { name: '2' })).toBeDefined();
  });

  it('el historial de tarea oculta la entidad y tambien pagina', async () => {
    envolver(<HistorialTareaPanel tareaId={6} />);

    expect(await screen.findByText('Página 1 de 2 (30 registros en total)')).toBeDefined();
    expect(screen.queryByText('Entidad')).toBeNull();
    expect(screen.getByRole('button', { name: '2' })).toBeDefined();
  });
});
