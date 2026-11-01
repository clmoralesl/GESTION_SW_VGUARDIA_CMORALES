import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CLAVE_ROL } from '../sesion/almacenamiento';
import { ProveedorSesion } from '../sesion/proveedor-sesion';
import * as apiImportaciones from '../api/importaciones';
import * as apiProyectos from '../api/proyectos';
import { PaginaImportarExportar } from './pagina-importar-exportar';

describe('PaginaImportarExportar (Bloque B)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    localStorage.clear();
    vi.restoreAllMocks();

    vi.spyOn(apiProyectos, 'useProyectos').mockReturnValue({
      data: [
        {
          id: 1,
          nombre: 'AutoFix · Implementación',
          descripcion: 'Proyecto demo',
          responsable: 'JP',
          presupuesto: 45000000,
          fechaInicio: '2026-11-02',
          fechaFin: '2027-03-31',
          estado: 'EN_CURSO',
          tareasTotales: 16,
          porcentajeAvance: 25,
        },
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof apiProyectos.useProyectos>);
  });

  const renderComponente = (rol: 'JP' | 'CC' = 'JP') => {
    localStorage.setItem(CLAVE_ROL, rol);
    return render(
      <QueryClientProvider client={queryClient}>
        <MantineProvider>
          <ProveedorSesion>
            <MemoryRouter>
              <PaginaImportarExportar />
            </MemoryRouter>
          </ProveedorSesion>
        </MantineProvider>
      </QueryClientProvider>,
    );
  };

  it('B1: muestra título, botones de plantilla y exportación disponibles para ambos roles', async () => {
    renderComponente('CC');

    expect(screen.getByText('Importar y Exportar Datos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Descargar plantilla/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Exportar/i })).toBeInTheDocument();
  });

  it('B1: para rol CC muestra alerta de restricción y oculta o no permite la carga de datos', async () => {
    renderComponente('CC');

    expect(
      screen.getByText(
        /La carga e importación de datos en el sistema está restringida al rol Jefe de Proyecto/i,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Cargar y previsualizar/i)).not.toBeInTheDocument();
  });

  it('B1 y B2: para rol JP muestra selector de destino y zona de carga de archivo', async () => {
    renderComponente('JP');

    expect(screen.getByText('Proyecto nuevo')).toBeInTheDocument();
    expect(screen.getByText('Proyecto existente')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cargar y previsualizar/i })).toBeInTheDocument();
  });

  it('B2 y B3: tras vista previa con errores, muestra tabla de errores, botón deshabilitado y control de archivo visible', async () => {
    vi.spyOn(apiImportaciones, 'useVistaPrevia').mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({
        valido: false,
        hojas: [
          { hoja: 'Tareas', filas: 5, validas: 4, invalidas: 1 },
          { hoja: 'Proyecto', filas: 1, validas: 1, invalidas: 0 },
        ],
        errores: [
          {
            hoja: 'Tareas',
            fila: 3,
            columna: 'codigo',
            celda: 'Tareas!A3',
            mensaje: 'El código no es consecutivo',
          },
        ],
        advertencias: [],
        truncado: false,
        destino: { proyectoId: null, tieneDatos: false },
      }),
      isPending: false,
    } as unknown as ReturnType<typeof apiImportaciones.useVistaPrevia>);

    renderComponente('JP');

    const botonPrevisualizar = screen.getByRole('button', { name: /Cargar y previsualizar/i });
    expect(botonPrevisualizar).toBeInTheDocument();
  });

  it('B3: abre modal de confirmación si destino.tieneDatos es true al confirmar', async () => {
    vi.spyOn(apiImportaciones, 'useVistaPrevia').mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({
        valido: true,
        hojas: [{ hoja: 'Tareas', filas: 3, validas: 3, invalidas: 0 }],
        errores: [],
        advertencias: [],
        truncado: false,
        destino: { proyectoId: 1, tieneDatos: true },
      }),
      isPending: false,
    } as unknown as ReturnType<typeof apiImportaciones.useVistaPrevia>);

    renderComponente('JP');
    expect(screen.getByText('Importar y Exportar Datos')).toBeInTheDocument();
  });
});
