export interface Modulo {
  ruta: string;
  titulo: string;
  disponible: boolean;
}

export const MODULOS: Modulo[] = [
  { ruta: 'proyectos', titulo: 'Proyectos', disponible: true },
  { ruta: 'tareas', titulo: 'Tareas', disponible: true },
  { ruta: 'gantt', titulo: 'Gantt', disponible: true },
  { ruta: 'recursos', titulo: 'Recursos', disponible: true },
  { ruta: 'hitos', titulo: 'Hitos', disponible: true },
  { ruta: 'kpi', titulo: 'KPI', disponible: true },
  { ruta: 'cambios', titulo: 'Cambios', disponible: true },
  { ruta: 'tablero-proyecto', titulo: 'Tablero proyecto', disponible: true },
  { ruta: 'tablero-cambio', titulo: 'Tablero cambio', disponible: false },
  { ruta: 'importar-exportar', titulo: 'Importar/Exportar', disponible: false },
  { ruta: 'bitacora', titulo: 'Bitácora', disponible: false },
];
