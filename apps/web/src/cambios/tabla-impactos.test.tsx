import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DetalleImpacto } from '../api/cambios';
import { CLAVE_PROYECTO, CLAVE_ROL } from '../sesion/almacenamiento';
import { ProveedorSesion } from '../sesion/proveedor-sesion';
import { TablaImpactos } from './tabla-impactos';

describe('TablaImpactos', () => {
  const impactosMock: DetalleImpacto[] = [
    {
      id: 1,
      solicitudId: 2,
      tipo: 'DURACION',
      tareaId: 10,
      datos: { duracionDias: 5 },
      descripcion: 'Ampliacion de plazo',
      aplicado: false,
    },
    {
      id: 2,
      solicitudId: 2,
      tipo: 'PRESUPUESTO',
      tareaId: null,
      datos: { presupuesto: 50000000 },
      descripcion: 'Ajuste de financiamiento',
      aplicado: false,
    },
  ];

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(CLAVE_ROL, 'JP');
    localStorage.setItem(CLAVE_PROYECTO, '1');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/solicitudes-cambio/2/impactos')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(impactosMock),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ tareas: [] }),
        });
      }),
    );
  });

  const renderComponente = (
    solicitudEstado: 'EN_EVALUACION' | 'APROBADA',
    etapa3Completada: boolean,
  ) => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return render(
      <QueryClientProvider client={queryClient}>
        <ProveedorSesion>
          <MantineProvider>
            <TablaImpactos
              solicitudId={2}
              proyectoId={1}
              solicitudEstado={solicitudEstado}
              etapa3Completada={etapa3Completada}
            />
          </MantineProvider>
        </ProveedorSesion>
      </QueryClientProvider>,
    );
  };

  it('renderiza la lista de impactos y boton de eliminar con aria-label', async () => {
    renderComponente('EN_EVALUACION', false);
    expect(await screen.findByText('Duración')).toBeDefined();
    expect(screen.getByText('Presupuesto')).toBeDefined();
    const botonesEliminar = screen.getAllByRole('button', { name: 'Eliminar impacto' });
    expect(botonesEliminar.length).toBe(2);
    expect(screen.getByRole('button', { name: 'Agregar impacto' })).toBeDefined();
  });

  it('deshabilita agregar y eliminar cuando la etapa 3 ya esta completada', async () => {
    renderComponente('APROBADA', true);
    expect(await screen.findByText('Duración')).toBeDefined();
    const botonAgregar = screen.getByRole('button', { name: 'Agregar impacto' });
    expect(botonAgregar.hasAttribute('disabled')).toBe(true);
    const botonesEliminar = screen.getAllByRole('button', { name: 'Eliminar impacto' });
    for (const b of botonesEliminar) {
      expect(b.hasAttribute('disabled')).toBe(true);
    }
  });
});
