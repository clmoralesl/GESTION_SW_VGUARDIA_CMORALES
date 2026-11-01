import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DetalleSolicitudCambio } from '../api/cambios';
import { CLAVE_PROYECTO, CLAVE_ROL } from '../sesion/almacenamiento';
import { ProveedorSesion } from '../sesion/proveedor-sesion';
import { PaginaCambios } from './pagina-cambios';

describe('PaginaCambios', () => {
  const solicitudesMock: DetalleSolicitudCambio[] = [
    {
      id: 1,
      proyectoId: 1,
      codigo: 'SC-001',
      titulo: 'Ampliación de cobertura de pruebas unitarias',
      descripcion: 'Aumentar la cobertura del 75% al 90%',
      justificacion: 'Requerimiento de calidad',
      solicitante: 'María Tapia',
      responsable: 'María Tapia',
      prioridad: 'ALTA',
      categoria: 'CALIDAD',
      probabilidadRiesgo: 2,
      impactoRiesgo: 3,
      nivelRiesgo: 'MEDIO',
      estado: 'EN_EVALUACION',
      etapaActual: 2,
      motivoRechazo: null,
      fechaRegistro: '2026-10-31',
      fechaDecision: null,
      fechaCierre: null,
      actualizadoEn: '2026-10-31T20:00:00.000Z',
      etapas: [
        {
          id: 1,
          solicitudId: 1,
          numero: 1,
          nombre: 'Identificación y registro',
          responsable: 'María Tapia',
          estado: 'COMPLETADA',
          fechaInicio: '2026-10-31',
          fechaIniciada: '2026-10-31',
          fechaFin: '2026-10-31',
          fechaCompletada: '2026-10-31',
          duracionRealDias: 0,
          comentario: 'Registrado correctamente',
          porcentajeAdopcion: null,
          evidencias: [],
          acciones: [],
        },
        {
          id: 2,
          solicitudId: 1,
          numero: 2,
          nombre: 'Evaluación inicial del impacto y viabilidad',
          responsable: 'Carlos Morales',
          estado: 'EN_CURSO',
          fechaInicio: '2026-10-31',
          fechaIniciada: '2026-10-31',
          fechaFin: null,
          fechaCompletada: null,
          duracionRealDias: null,
          comentario: null,
          porcentajeAdopcion: null,
          evidencias: [],
          acciones: [],
        },
      ],
    },
  ];

  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/proyectos/1/solicitudes-cambio')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(solicitudesMock),
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

  const renderConRol = (rol = 'JP', conProyecto = true) => {
    if (conProyecto) {
      localStorage.setItem(CLAVE_PROYECTO, '1');
    }
    localStorage.setItem(CLAVE_ROL, rol);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    return render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <MantineProvider>
            <ProveedorSesion>
              <PaginaCambios />
            </ProveedorSesion>
          </MantineProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    );
  };

  it('muestra aviso si no hay proyecto activo seleccionado', () => {
    renderConRol('JP', false);
    expect(screen.getByText('Seleccione un proyecto')).toBeDefined();
  });

  it('renderiza la tabla con las solicitudes del proyecto', async () => {
    renderConRol('JP', true);
    expect(await screen.findByText('SC-001')).toBeDefined();
    expect(screen.getByText('Ampliación de cobertura de pruebas unitarias')).toBeDefined();
    expect(screen.getByText('María Tapia')).toBeDefined();
    expect(screen.getAllByText('EN_EVALUACION').length).toBeGreaterThan(0);
    expect(screen.getByText('Etapa 2')).toBeDefined();
  });

  it('permite abrir el modal de nueva solicitud para rol JP', async () => {
    renderConRol('JP', true);
    expect(await screen.findByText('SC-001')).toBeDefined();
    const botonNueva = screen.getByRole('button', { name: /Nueva solicitud/i });
    expect(botonNueva).toBeDefined();
    fireEvent.click(botonNueva);
    expect(await screen.findByRole('dialog')).toBeDefined();
    expect(screen.getByLabelText(/Título de la solicitud/i)).toBeDefined();
  });
});
