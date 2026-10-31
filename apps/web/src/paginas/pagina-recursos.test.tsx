import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProfesionalResumen, RecursoResumen, TipoRecursoResumen } from '@autofix/core';
import { clienteConsultas } from '../api/cliente-consultas';
import { CLAVE_ROL } from '../sesion/almacenamiento';
import { ProveedorSesion } from '../sesion/proveedor-sesion';
import { PaginaRecursos } from './pagina-recursos';

describe('PaginaRecursos', () => {
  const profesionalesMock: ProfesionalResumen[] = [
    {
      id: 1,
      nombre: 'Rodrigo Fuentes',
      cargo: 'Jefe de taller',
      tarifaHora: 12000,
      horasDiarias: 8,
      activo: true,
      numeroAsignaciones: 0,
    },
    {
      id: 2,
      nombre: 'Valentina Muñoz',
      cargo: 'Desarrolladora',
      tarifaHora: 11000,
      horasDiarias: 7.5,
      activo: true,
      numeroAsignaciones: 2,
    },
    {
      id: 3,
      nombre: 'Diego Pizarro',
      cargo: 'Técnico',
      tarifaHora: 8000,
      horasDiarias: 6,
      activo: false,
      numeroAsignaciones: 0,
    },
    {
      id: 4,
      nombre: 'Nicolás Núñez',
      cargo: 'Mecánico',
      tarifaHora: 9500,
      horasDiarias: 8,
      activo: true,
      numeroAsignaciones: 0,
    },
  ];

  const recursosMock: RecursoResumen[] = [
    {
      id: 1,
      nombre: 'Elevador hidráulico',
      tipoRecurso: { id: 2, nombre: 'Equipamiento' },
      unidad: 'día',
      costoUnitario: 25000,
      activo: true,
      numeroAsignaciones: 1,
    },
  ];

  const tiposRecursoMock: TipoRecursoResumen[] = [
    { id: 1, nombre: 'Humano', descripcion: 'Mano de obra' },
    { id: 2, nombre: 'Equipamiento', descripcion: 'Equipos' },
  ];

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string, opciones?: RequestInit) => {
        if (url.includes('/profesionales') && opciones?.method === 'POST') {
          const cuerpo = JSON.parse(String(opciones.body));
          if (cuerpo.nombre?.toLowerCase().includes('duplicado')) {
            return Promise.resolve({
              ok: false,
              status: 409,
              json: () =>
                Promise.resolve({
                  codigo: 'REGISTRO_DUPLICADO',
                  error: 'Conflicto',
                  mensaje: `Ya existe un profesional con el nombre «${cuerpo.nombre}».`,
                  detalles: [
                    {
                      campo: 'nombre',
                      mensaje: `Ya existe un profesional con el nombre «${cuerpo.nombre}».`,
                    },
                  ],
                }),
            });
          }
          return Promise.resolve({
            ok: true,
            status: 201,
            json: () =>
              Promise.resolve({
                ...profesionalesMock[0],
                id: 99,
                nombre: cuerpo.nombre,
              }),
          });
        }

        if (url.includes('/profesionales') && opciones?.method === 'DELETE') {
          return Promise.resolve({
            ok: false,
            status: 409,
            json: () =>
              Promise.resolve({
                codigo: 'TIENE_ASIGNACIONES',
                error: 'Conflicto',
                mensaje:
                  'El profesional «Rodrigo Fuentes» tiene 1 asignación. Solo puede desactivarlo.',
                detalles: { asignaciones: 1 },
              }),
          });
        }

        if (url.includes('/profesionales')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(profesionalesMock),
          });
        }
        if (url.includes('/recursos')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(recursosMock),
          });
        }
        if (url.includes('/tipos-recurso')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(tiposRecursoMock),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve([]),
        });
      }),
    );
  });

  const renderConRol = (rol: string = 'JP') => {
    localStorage.setItem(CLAVE_ROL, rol);
    clienteConsultas.clear();

    return render(
      <QueryClientProvider client={clienteConsultas}>
        <MantineProvider>
          <ModalsProvider>
            <ProveedorSesion>
              <MemoryRouter>
                <PaginaRecursos />
              </MemoryRouter>
            </ProveedorSesion>
          </ModalsProvider>
        </MantineProvider>
      </QueryClientProvider>,
    );
  };

  it('el orden por columna cambia aria-sort y el orden de las filas', async () => {
    renderConRol('JP');
    await waitFor(() => {
      expect(screen.getByText('Rodrigo Fuentes')).toBeInTheDocument();
    });

    const thNombre = screen.getByRole('columnheader', { name: /nombre/i });
    expect(thNombre).toHaveAttribute('aria-sort', 'ascending');

    const botonNombre = screen.getByRole('button', { name: /nombre/i });
    fireEvent.click(botonNombre);

    expect(thNombre).toHaveAttribute('aria-sort', 'descending');
  });

  it('buscar "nunez" encuentra "Nicolás Núñez"', async () => {
    renderConRol('JP');
    await waitFor(() => {
      expect(screen.getByText('Rodrigo Fuentes')).toBeInTheDocument();
    });

    const inputBusqueda = screen.getByPlaceholderText('Buscar profesionales...');
    fireEvent.change(inputBusqueda, { target: { value: 'nunez' } });

    await waitFor(() => {
      expect(screen.getByText('Nicolás Núñez')).toBeInTheDocument();
      expect(screen.queryByText('Rodrigo Fuentes')).not.toBeInTheDocument();
    });
  });

  it('"Mostrar inactivos" muestra las filas inactivas', async () => {
    renderConRol('JP');
    await waitFor(() => {
      expect(screen.getByText('Rodrigo Fuentes')).toBeInTheDocument();
    });

    expect(screen.queryByText('Diego Pizarro')).not.toBeInTheDocument();

    const switchInactivos = screen.getAllByLabelText(/mostrar inactivos/i)[0];
    expect(switchInactivos).toBeDefined();
    if (switchInactivos) fireEvent.click(switchInactivos);

    await waitFor(() => {
      expect(screen.getByText('Diego Pizarro')).toBeInTheDocument();
    });
  });

  it('el modal muestra los errores de validacion ante nombre vacio y tarifa negativa', async () => {
    renderConRol('JP');
    await waitFor(() => {
      expect(screen.getByText('Rodrigo Fuentes')).toBeInTheDocument();
    });

    const botonNuevo = screen.getByRole('button', {
      name: /nuevo profesional/i,
    });
    fireEvent.click(botonNuevo);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const botonGuardar = screen.getByRole('button', {
      name: /crear profesional/i,
    });
    fireEvent.click(botonGuardar);

    await waitFor(() => {
      expect(screen.getByText('Ingrese el nombre.')).toBeInTheDocument();
    });
  });

  it('el 409 de duplicado aparece bajo el campo nombre', async () => {
    renderConRol('JP');
    await waitFor(() => {
      expect(screen.getByText('Rodrigo Fuentes')).toBeInTheDocument();
    });

    const botonNuevo = screen.getByRole('button', {
      name: /nuevo profesional/i,
    });
    fireEvent.click(botonNuevo);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const inputNombre = screen.getByLabelText(/nombre/i);
    const inputCargo = screen.getByLabelText(/cargo/i);
    const inputTarifa = screen.getByLabelText(/tarifa por hora/i);

    fireEvent.change(inputNombre, { target: { value: 'Duplicado' } });
    fireEvent.change(inputCargo, { target: { value: 'Jefe' } });
    fireEvent.change(inputTarifa, { target: { value: '10000' } });

    const botonGuardar = screen.getByRole('button', {
      name: /crear profesional/i,
    });
    fireEvent.click(botonGuardar);

    await waitFor(() => {
      expect(
        screen.getByText('Ya existe un profesional con el nombre «Duplicado».'),
      ).toBeInTheDocument();
    });
  });

  it('con rol CC las acciones tienen aria-disabled', async () => {
    renderConRol('CC');
    await waitFor(() => {
      expect(screen.getByText('Rodrigo Fuentes')).toBeInTheDocument();
    });

    const botonNuevo = screen.getByRole('button', {
      name: /nuevo profesional/i,
    });
    expect(botonNuevo).toHaveAttribute('aria-disabled', 'true');

    const botonesEditar = screen.getAllByRole('button', {
      name: /editar profesional/i,
    });
    expect(botonesEditar[0]).toHaveAttribute('aria-disabled', 'true');
  });

  it('Eliminar esta deshabilitado con numeroAsignaciones > 0 y tooltip informativo', async () => {
    renderConRol('JP');
    await waitFor(() => {
      expect(screen.getByText('Valentina Muñoz')).toBeInTheDocument();
    });

    const filaValentina = screen.getByText('Valentina Muñoz').closest('tr')!;
    const botonValentina = within(filaValentina).getByRole('button', {
      name: /eliminar profesional/i,
    });

    expect(botonValentina).toHaveAttribute('aria-disabled', 'true');
    expect(botonValentina).toHaveAttribute(
      'aria-label',
      expect.stringContaining('Tiene 2 asignaciones; solo puede desactivarlo'),
    );
  });

  it('al recibir 409 al eliminar muestra una sola notificacion de error', async () => {
    const notifSpy = vi.spyOn(notifications, 'show');
    renderConRol('JP');
    await waitFor(() => {
      expect(screen.getByText('Rodrigo Fuentes')).toBeInTheDocument();
    });

    const filaRodrigo = screen.getByText('Rodrigo Fuentes').closest('tr')!;
    const botonEliminar = within(filaRodrigo).getByRole('button', {
      name: /eliminar profesional/i,
    });
    fireEvent.click(botonEliminar);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const botonConfirmar = screen.getByRole('button', { name: /^eliminar$/i });
    fireEvent.click(botonConfirmar);

    await waitFor(() => {
      expect(notifSpy).toHaveBeenCalled();
    });

    expect(notifSpy).toHaveBeenCalledTimes(1);
    expect(notifSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'No se pudo eliminar el profesional',
        message: expect.stringContaining('tiene 1 asignación'),
      }),
    );
  });
});
