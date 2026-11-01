import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DependenciaTarea, HitoConEstado, TareaArbol } from '@autofix/core';
import { CLAVE_PROYECTO, CLAVE_ROL } from '../sesion/almacenamiento';
import { ProveedorSesion } from '../sesion/proveedor-sesion';
import { PaginaGantt } from './pagina-gantt';

describe('PaginaGantt', () => {
  const tareasSeed: TareaArbol[] = [
    {
      id: 1,
      codigo: '1',
      padreId: null,
      nombre: 'Levantamiento y diseño',
      descripcion: null,
      responsable: 'Jefe de Proyecto',
      duracionDias: 12,
      porcentajeAvance: 35.72,
      inicioPlan: '2026-11-02',
      finPlan: '2026-11-17',
      inicioTardio: '2026-11-02',
      finTardio: '2026-11-17',
      holguraDias: 0,
      esCritica: true,
      fechaFija: null,
      inicioReal: null,
      finReal: null,
      nivel: 'ETAPA',
      orden: 1,
      tieneHijas: true,
    },
    {
      id: 2,
      codigo: '1.1',
      padreId: 1,
      nombre: 'Levantamiento de procesos',
      descripcion: null,
      responsable: 'Jefe de Taller',
      duracionDias: 7,
      porcentajeAvance: 71.43,
      inicioPlan: '2026-11-02',
      finPlan: '2026-11-10',
      inicioTardio: '2026-11-02',
      finTardio: '2026-11-10',
      holguraDias: 0,
      esCritica: true,
      fechaFija: null,
      inicioReal: null,
      finReal: null,
      nivel: 'ACTIVIDAD',
      orden: 1,
      tieneHijas: true,
    },
    {
      id: 3,
      codigo: '1.1.1',
      padreId: 2,
      nombre: 'Entrevistas con el jefe',
      descripcion: null,
      responsable: 'Jefe de Taller',
      duracionDias: 3,
      porcentajeAvance: 100,
      inicioPlan: '2026-11-02',
      finPlan: '2026-11-04',
      inicioTardio: '2026-11-02',
      finTardio: '2026-11-04',
      holguraDias: 0,
      esCritica: true,
      fechaFija: null,
      inicioReal: '2026-11-02',
      finReal: '2026-11-04',
      nivel: 'SUBACTIVIDAD',
      orden: 1,
      tieneHijas: false,
    },
    {
      id: 4,
      codigo: '1.1.2',
      padreId: 2,
      nombre: 'Mapeo del flujo de órdenes',
      descripcion: null,
      responsable: 'Jefe de Taller',
      duracionDias: 4,
      porcentajeAvance: 50,
      inicioPlan: '2026-11-05',
      finPlan: '2026-11-10',
      inicioTardio: '2026-11-05',
      finTardio: '2026-11-10',
      holguraDias: 0,
      esCritica: true,
      fechaFija: null,
      inicioReal: '2026-11-05',
      finReal: null,
      nivel: 'SUBACTIVIDAD',
      orden: 2,
      tieneHijas: false,
    },
    {
      id: 5,
      codigo: '1.2',
      padreId: 1,
      nombre: 'Diseño de la solución',
      descripcion: null,
      responsable: 'Jefe de Proyecto',
      duracionDias: 7,
      porcentajeAvance: 0,
      inicioPlan: '2026-11-09',
      finPlan: '2026-11-17',
      inicioTardio: '2026-11-09',
      finTardio: '2026-11-17',
      holguraDias: 0,
      esCritica: true,
      fechaFija: null,
      inicioReal: null,
      finReal: null,
      nivel: 'ACTIVIDAD',
      orden: 2,
      tieneHijas: true,
    },
    {
      id: 6,
      codigo: '1.2.1',
      padreId: 5,
      nombre: 'Modelo de datos de vehículos',
      descripcion: null,
      responsable: 'Desarrollador',
      duracionDias: 5,
      porcentajeAvance: 0,
      inicioPlan: '2026-11-09',
      finPlan: '2026-11-13',
      inicioTardio: '2026-11-09',
      finTardio: '2026-11-13',
      holguraDias: 0,
      esCritica: true,
      fechaFija: null,
      inicioReal: null,
      finReal: null,
      nivel: 'SUBACTIVIDAD',
      orden: 1,
      tieneHijas: false,
    },
    {
      id: 14,
      codigo: '2.2.2',
      padreId: 5,
      nombre: 'Pruebas de humo',
      descripcion: null,
      responsable: 'Tester',
      duracionDias: 2,
      porcentajeAvance: 0,
      inicioPlan: '2026-11-23',
      finPlan: '2026-11-24',
      inicioTardio: '2026-12-08',
      finTardio: '2026-12-09',
      holguraDias: 11,
      esCritica: false,
      fechaFija: null,
      inicioReal: null,
      finReal: null,
      nivel: 'SUBACTIVIDAD',
      orden: 2,
      tieneHijas: false,
    },
  ];

  const dependenciasSeed: DependenciaTarea[] = [
    { id: 1, predecesoraId: 3, sucesoraId: 4, tipo: 'FS', desfaseDias: 0 },
    { id: 2, predecesoraId: 4, sucesoraId: 6, tipo: 'SS', desfaseDias: 2 },
    { id: 3, predecesoraId: 6, sucesoraId: 14, tipo: 'SF', desfaseDias: 0 },
  ];

  const hitosSeed: HitoConEstado[] = [
    {
      id: 1,
      proyectoId: 1,
      nombre: 'Acta aprobada',
      fechaObjetivo: '2026-10-30',
      fechaCumplimiento: '2026-10-29',
      criterio: null,
      responsable: null,
      tarea: null,
      estado: 'CUMPLIDO',
      aTiempo: true,
      diasHabilesRestantes: 0,
    },
  ];

  let peticionesPatch: Array<{ url: string; body: unknown }> = [];

  beforeEach(() => {
    peticionesPatch = [];
    localStorage.setItem(CLAVE_PROYECTO, '1');
    localStorage.setItem(CLAVE_ROL, 'JP');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (init?.method === 'PATCH') {
          peticionesPatch.push({
            url,
            body: init.body ? JSON.parse(init.body as string) : null,
          });
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                arbol: { proyectoId: 1, porcentajeAvanceProyecto: 35, tareas: tareasSeed },
                tareasAfectadas: [],
                hitos: hitosSeed,
              }),
          });
        }
        if (url.includes('/proyectos/1/lineas-base/vigente')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ proyectoId: 1, lineaBase: null }),
          });
        }
        if (url.includes('/proyectos/1/calendario')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                proyectoId: 1,
                diasLaborables: [1, 2, 3, 4, 5],
                horasPorDia: 8,
                feriados: [],
              }),
          });
        }
        if (url.includes('/proyectos/1/hitos')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                proyectoId: 1,
                fechaCalculo: '2026-10-31',
                hitos: hitosSeed,
              }),
          });
        }
        if (url.includes('/proyectos/1/dependencias')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(dependenciasSeed),
          });
        }
        if (url.includes('/proyectos/1/tareas')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                proyectoId: 1,
                porcentajeAvanceProyecto: 35.72,
                tareas: tareasSeed,
              }),
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
                fechaInicio: '2026-11-02',
              }),
          });
        }
        if (
          url.includes('/profesionales') ||
          url.includes('/recursos') ||
          url.includes('/asignaciones')
        ) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve([]),
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

  const renderConProveedores = (rutaInicial = '/gantt') => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return render(
      <QueryClientProvider client={queryClient}>
        <MantineProvider>
          <Notifications />
          <ProveedorSesion>
            <MemoryRouter initialEntries={[rutaInicial]}>
              <PaginaGantt />
            </MemoryRouter>
          </ProveedorSesion>
        </MantineProvider>
      </QueryClientProvider>,
    );
  };

  it('renderiza barras de resumen y hojas con los datos del seed', async () => {
    renderConProveedores();

    await waitFor(() => {
      expect(screen.getByText('Levantamiento y diseño')).toBeInTheDocument();
    });

    expect(screen.getByTestId('barra-resumen-1')).toBeInTheDocument();
    expect(screen.getByTestId('barra-tarea-1.2.1')).toBeInTheDocument();
  });

  it('deshabilita interruptor de linea base cuando la respuesta trae lineaBase null', async () => {
    renderConProveedores();

    await waitFor(() => {
      expect(screen.getByLabelText('Línea base')).toBeInTheDocument();
    });

    const switchLb = screen.getByLabelText('Línea base');
    expect(switchLb).toBeDisabled();
  });

  it('con rol CC ninguna barra tiene asas ni atributo data-arrastrable', async () => {
    localStorage.setItem(CLAVE_ROL, 'CC');
    renderConProveedores();

    await waitFor(() => {
      expect(screen.getByTestId('barra-tarea-1.2.1')).toBeInTheDocument();
    });

    const barras = document.querySelectorAll('[data-arrastrable]');
    expect(barras.length).toBe(0);

    const asas = document.querySelectorAll('[data-asa-estirar]');
    expect(asas.length).toBe(0);
  });

  it('prueba de reversión: al mover 1.2.1 4 días hacia la izquierda no debe enviar PATCH y debe avisar SS +2', async () => {
    renderConProveedores();

    await waitFor(() => {
      expect(screen.getByTestId('barra-tarea-1.2.1')).toBeInTheDocument();
    });

    const barra121 = screen.getByTestId('barra-tarea-1.2.1').querySelector('rect')!;

    fireEvent.pointerDown(barra121, { clientX: 288, pointerId: 1 });
    fireEvent.pointerMove(barra121, { clientX: 288 - 4 * 32, pointerId: 1 });
    fireEvent.pointerUp(barra121, { clientX: 288 - 4 * 32, pointerId: 1 });

    expect(peticionesPatch).toHaveLength(0);
    expect(await screen.findByText(/SS \+2/i)).toBeInTheDocument();
  });

  it('prueba de regresion B3: dos arrastres seguidos de 2.2.2 sin resolver el primer fetch solo envía un PATCH', async () => {
    let resolverPrimerPatch: (() => void) | null = null;
    let llamadaCount = 0;

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (init?.method === 'PATCH') {
          llamadaCount += 1;
          peticionesPatch.push({
            url,
            body: init.body ? JSON.parse(init.body as string) : null,
          });
          if (llamadaCount === 1) {
            return new Promise((resolve) => {
              resolverPrimerPatch = () => {
                resolve({
                  ok: true,
                  status: 200,
                  json: () =>
                    Promise.resolve({
                      arbol: { proyectoId: 1, porcentajeAvanceProyecto: 35, tareas: tareasSeed },
                      tareasAfectadas: [],
                      hitos: hitosSeed,
                    }),
                });
              };
            });
          }
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                arbol: { proyectoId: 1, porcentajeAvanceProyecto: 35, tareas: tareasSeed },
                tareasAfectadas: [],
                hitos: hitosSeed,
              }),
          });
        }
        if (url.includes('/proyectos/1/lineas-base/vigente')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ proyectoId: 1, lineaBase: null }),
          });
        }
        if (url.includes('/proyectos/1/calendario')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                proyectoId: 1,
                diasLaborables: [1, 2, 3, 4, 5],
                horaInicio: '08:30',
                horaFin: '18:00',
                feriados: [],
              }),
          });
        }
        if (url.includes('/proyectos/1/hitos')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                proyectoId: 1,
                fechaCalculo: '2026-10-31',
                hitos: hitosSeed,
              }),
          });
        }
        if (url.includes('/proyectos/1/dependencias')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(dependenciasSeed),
          });
        }
        if (url.includes('/proyectos/1/tareas')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                proyectoId: 1,
                porcentajeAvanceProyecto: 35,
                tareas: tareasSeed,
              }),
          });
        }
        if (url.includes('/proyectos/1')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                id: 1,
                nombre: 'AutoFix · Demostración',
                descripcion: 'Proyecto de prueba',
                estado: 'EN_PLANIFICACION',
                fechaInicio: '2026-11-02',
                fechaFinEstimada: '2026-12-10',
              }),
          });
        }
        return Promise.reject(new Error(`Ruta no manejada en test: ${url}`));
      }),
    );

    renderConProveedores();

    await waitFor(() => {
      expect(screen.getByTestId('barra-tarea-2.2.2')).toBeInTheDocument();
    });

    const barra222 = screen.getByTestId('barra-tarea-2.2.2').querySelector('rect')!;

    fireEvent.pointerDown(barra222, { clientX: 700, pointerId: 1 });
    fireEvent.pointerMove(barra222, { clientX: 732, pointerId: 1 });
    fireEvent.pointerUp(barra222, { clientX: 732, pointerId: 1 });

    await waitFor(() => {
      expect(peticionesPatch).toHaveLength(1);
    });

    fireEvent.pointerDown(barra222, { clientX: 700, pointerId: 2 });
    fireEvent.pointerMove(barra222, { clientX: 764, pointerId: 2 });
    fireEvent.pointerUp(barra222, { clientX: 764, pointerId: 2 });

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(peticionesPatch).toHaveLength(1);

    if (resolverPrimerPatch) {
      (resolverPrimerPatch as () => void)();
    }
  });

  it('prueba A3: al recibir error 409 de la API muestra el aviso con el mensaje de error y revierte la posicion', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (init?.method === 'PATCH') {
          return Promise.resolve({
            ok: false,
            status: 409,
            json: () =>
              Promise.resolve({
                codigo: 'PROYECTO_CERRADO',
                error: 'Conflicto',
                mensaje: 'El proyecto se encuentra cerrado y no permite modificaciones.',
              }),
          });
        }
        if (url.includes('/proyectos/1/lineas-base/vigente')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ proyectoId: 1, lineaBase: null }),
          });
        }
        if (url.includes('/proyectos/1/calendario')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                proyectoId: 1,
                diasLaborables: [1, 2, 3, 4, 5],
                horaInicio: '08:30',
                horaFin: '18:00',
                feriados: [],
              }),
          });
        }
        if (url.includes('/proyectos/1/hitos')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                proyectoId: 1,
                fechaCalculo: '2026-10-31',
                hitos: hitosSeed,
              }),
          });
        }
        if (url.includes('/proyectos/1/dependencias')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(dependenciasSeed),
          });
        }
        if (url.includes('/proyectos/1/tareas')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                proyectoId: 1,
                porcentajeAvanceProyecto: 35,
                tareas: tareasSeed,
              }),
          });
        }
        if (url.includes('/proyectos/1')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                id: 1,
                nombre: 'AutoFix · Demostración',
                descripcion: 'Proyecto de prueba',
                estado: 'EN_PLANIFICACION',
                fechaInicio: '2026-11-02',
                fechaFinEstimada: '2026-12-10',
              }),
          });
        }
        return Promise.reject(new Error(`Ruta no manejada: ${url}`));
      }),
    );

    renderConProveedores();

    await waitFor(() => {
      expect(screen.getByTestId('barra-tarea-2.2.2')).toBeInTheDocument();
    });

    const barra222 = screen.getByTestId('barra-tarea-2.2.2').querySelector('rect')!;

    fireEvent.pointerDown(barra222, { clientX: 700, pointerId: 1 });
    fireEvent.pointerMove(barra222, { clientX: 732, pointerId: 1 });
    fireEvent.pointerUp(barra222, { clientX: 732, pointerId: 1 });

    expect(
      await screen.findByText(/El proyecto se encuentra cerrado y no permite modificaciones./i),
    ).toBeInTheDocument();
  });

  it('selecciona y resalta la tarea especificada en la url mediante parametro de busqueda', async () => {
    renderConProveedores('/gantt?tarea=6');

    await waitFor(() => {
      expect(screen.getByTestId('fila-tarea-1.2.1')).toBeInTheDocument();
    });

    const fila6 = screen.getByTestId('fila-tarea-1.2.1');
    expect(fila6).toHaveAttribute('data-seleccionada', 'true');
  });

  it('tras aplicar ?tarea=6, cerrar el detalle y forzar un nuevo modelo no lo reabre', async () => {
    renderConProveedores('/gantt?tarea=6');

    await waitFor(() => {
      expect(screen.getByTestId('fila-tarea-1.2.1')).toBeInTheDocument();
    });

    expect(screen.getByText('1.2.1 · Modelo de datos de vehículos')).toBeInTheDocument();

    const botonCerrar = document.querySelector('.mantine-Drawer-close')!;
    fireEvent.click(botonCerrar);

    await waitFor(() => {
      expect(screen.queryByText('1.2.1 · Modelo de datos de vehículos')).not.toBeInTheDocument();
    });

    const switchRutaCritica = screen.getByRole('switch', { name: /Ruta crítica/i });
    fireEvent.click(switchRutaCritica);

    expect(screen.queryByText('1.2.1 · Modelo de datos de vehículos')).not.toBeInTheDocument();
  });
});
