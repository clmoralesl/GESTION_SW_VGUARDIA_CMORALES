import { createBrowserRouter, Navigate } from 'react-router';
import { EstructuraApp } from '../diseno/estructura-app';
import { PaginaCalendario } from '../paginas/pagina-calendario';
import { PaginaCambios } from '../paginas/pagina-cambios';
import { PaginaDetalleCambio } from '../paginas/pagina-detalle-cambio';
import { PaginaDetalleProyecto } from '../paginas/pagina-detalle-proyecto';
import { PaginaGantt } from '../paginas/pagina-gantt';
import { PaginaHitos } from '../paginas/pagina-hitos';
import { PaginaKpi } from '../paginas/pagina-kpi';
import { PaginaNoEncontrada } from '../paginas/pagina-no-encontrada';
import { PaginaProyectos } from '../paginas/pagina-proyectos';
import { PaginaProximamente } from '../paginas/pagina-proximamente';
import { PaginaRecursos } from '../paginas/pagina-recursos';
import { PaginaTareas } from '../paginas/pagina-tareas';
import { MODULOS } from './modulos';

const rutasModulos = MODULOS.map((m) => ({
  path: m.ruta,
  element:
    m.ruta === 'proyectos' ? (
      <PaginaProyectos />
    ) : m.ruta === 'tareas' ? (
      <PaginaTareas />
    ) : m.ruta === 'hitos' ? (
      <PaginaHitos />
    ) : m.ruta === 'gantt' ? (
      <PaginaGantt />
    ) : m.ruta === 'recursos' ? (
      <PaginaRecursos />
    ) : m.ruta === 'kpi' ? (
      <PaginaKpi />
    ) : m.ruta === 'cambios' ? (
      <PaginaCambios />
    ) : (
      <PaginaProximamente titulo={m.titulo} />
    ),
}));

export const enrutador = createBrowserRouter([
  {
    path: '/',
    element: <EstructuraApp />,
    children: [
      {
        index: true,
        element: <Navigate to="/proyectos" replace />,
      },
      ...rutasModulos,
      {
        path: 'cambios/:solicitudId',
        element: <PaginaDetalleCambio />,
      },
      {
        path: 'proyectos/:proyectoId/calendario',
        element: <PaginaCalendario />,
      },
      {
        path: 'proyectos/:proyectoId',
        element: <PaginaDetalleProyecto />,
      },
      {
        path: '*',
        element: <PaginaNoEncontrada />,
      },
    ],
  },
]);
