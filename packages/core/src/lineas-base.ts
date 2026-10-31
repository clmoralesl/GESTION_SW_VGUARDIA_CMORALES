export interface TareaLineaBase {
  tareaId: number | null;
  codigo: string;
  nombre: string;
  duracionDias: number;
  inicioPlan: string | null;
  finPlan: string | null;
}

export interface LineaBaseGantt {
  id: number;
  version: number;
  descripcion: string | null;
  creadoEn: string;
  fechaFinProyecto: string | null;
  tareas: TareaLineaBase[];
}

export interface LineaBaseVigente {
  proyectoId: number;
  lineaBase: LineaBaseGantt | null;
}
