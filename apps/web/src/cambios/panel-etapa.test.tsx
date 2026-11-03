import { MantineProvider } from '@mantine/core';
import { DatesProvider } from '@mantine/dates';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DetalleEtapaCambio, DetalleSolicitudCambio } from '../api/cambios';
import { CLAVE_PROYECTO, CLAVE_ROL } from '../sesion/almacenamiento';
import { ProveedorSesion } from '../sesion/proveedor-sesion';
import { PanelEtapa } from './panel-etapa';

function crearEtapa(numero: number, estado: DetalleEtapaCambio['estado']): DetalleEtapaCambio {
  return {
    id: numero,
    solicitudId: 1,
    numero,
    nombre: `Etapa de prueba ${numero}`,
    responsable: null,
    estado,
    fechaInicio: '2026-10-26',
    fechaFin: '2026-10-30',
    fechaIniciada: null,
    fechaCompletada: null,
    duracionRealDias: null,
    comentario: null,
    porcentajeAdopcion: null,
    evidencias: [],
    acciones: [],
  };
}

const solicitud: DetalleSolicitudCambio = {
  id: 1,
  proyectoId: 1,
  codigo: 'SC-001',
  titulo: 'Solicitud de prueba',
  descripcion: 'Descripcion',
  justificacion: 'Justificacion',
  solicitante: 'Jefe de taller',
  responsable: 'Valeria Guardia',
  prioridad: 'MEDIA',
  categoria: 'ALCANCE',
  probabilidadRiesgo: 2,
  impactoRiesgo: 2,
  nivelRiesgo: 'MEDIO',
  estado: 'REGISTRADA',
  etapaActual: 1,
  motivoRechazo: null,
  fechaRegistro: '2026-10-20T00:00:00.000Z',
  fechaDecision: null,
  fechaCierre: null,
  actualizadoEn: '2026-10-20T00:00:00.000Z',
  etapas: [],
};

function renderizar(rol: 'JP' | 'CC', etapa: DetalleEtapaCambio) {
  localStorage.setItem(CLAVE_ROL, rol);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MantineProvider>
      <DatesProvider settings={{ locale: 'es' }}>
        <QueryClientProvider client={queryClient}>
          <ProveedorSesion>
            <PanelEtapa solicitud={solicitud} etapa={etapa} />
          </ProveedorSesion>
        </QueryClientProvider>
      </DatesProvider>
    </MantineProvider>,
  );
}

describe('PanelEtapa', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(CLAVE_PROYECTO, '1');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) }),
        ),
    );
  });

  it('con JP muestra las acciones de la etapa deshabilitadas en lugar de ocultarlas', () => {
    renderizar('JP', crearEtapa(4, 'EN_CURSO'));

    for (const nombre of ['Completar etapa', 'Omitir etapa', 'Editar etapa']) {
      const boton = screen.getByRole('button', { name: nombre });
      expect(boton.getAttribute('aria-disabled')).toBe('true');
    }
  });

  it('con JP muestra deshabilitado el inicio de una etapa pendiente', () => {
    renderizar('JP', crearEtapa(3, 'PENDIENTE'));

    const iniciar = screen.getByRole('button', { name: 'Iniciar etapa' });
    expect(iniciar.getAttribute('aria-disabled')).toBe('true');
  });

  it('con CC las acciones de la etapa quedan habilitadas', () => {
    renderizar('CC', crearEtapa(4, 'EN_CURSO'));

    for (const nombre of ['Completar etapa', 'Omitir etapa', 'Editar etapa']) {
      const boton = screen.getByRole('button', { name: nombre });
      expect(boton.getAttribute('aria-disabled')).toBeNull();
    }
  });

  it('con JP la accion correctiva de la etapa 9 se ve deshabilitada', () => {
    renderizar('JP', crearEtapa(9, 'EN_CURSO'));

    const nueva = screen.getByRole('button', { name: 'Nueva acción correctiva' });
    expect(nueva.getAttribute('aria-disabled')).toBe('true');
  });

  it('el formulario de edicion usa selectores de fecha con las fechas planificadas', async () => {
    const user = userEvent.setup();
    renderizar('CC', crearEtapa(4, 'EN_CURSO'));

    await user.click(screen.getByRole('button', { name: 'Editar etapa' }));

    const inicio = await screen.findByRole<HTMLInputElement>('textbox', {
      name: 'Fecha inicio plan',
    });
    const fin = screen.getByRole<HTMLInputElement>('textbox', { name: 'Fecha fin plan' });
    expect(inicio.value).toBe('26-10-2026');
    expect(fin.value).toBe('30-10-2026');
  });
});
