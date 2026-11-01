import {
  PRIORIDADES_SOLICITUD,
  CATEGORIAS_CAMBIO,
  type PrioridadSolicitud,
  type CategoriaCambio,
} from './cambios';
import { claveNombre } from './catalogos';
import { TIPOS_DEPENDENCIA, type TipoDependencia } from './cronograma';
import { AMBITOS_KPI, UNIDADES_KPI, DIRECCIONES_KPI, esquemaCrearKpi } from './kpi';
import { analizarFormula } from './formulas';
import { codigosVariablesPorAmbito } from './variablesKpi';
import { NIVELES_TAREA, type NivelTarea } from './tareas';

export const HOJAS_CARGA = [
  'Instrucciones',
  'Proyecto',
  'Calendario',
  'Feriados',
  'Tareas',
  'Dependencias',
  'Profesionales',
  'Recursos',
  'Asignaciones',
  'Hitos',
  'KPI',
  'Solicitudes',
] as const;
export type HojaCarga = (typeof HOJAS_CARGA)[number];

export interface DefinicionColumna {
  clave: string;
  nombre: string;
  letra: string;
  obligatoria: boolean;
  nota: string;
  lista?: readonly string[];
  calculada?: boolean;
}

export const COLUMNAS_POR_HOJA: Record<HojaCarga, readonly DefinicionColumna[]> = {
  Instrucciones: [],
  Proyecto: [
    {
      clave: 'nombre',
      nombre: 'nombre*',
      letra: 'A',
      obligatoria: true,
      nota: 'Nombre del proyecto (máx. 120 caracteres)',
    },
    {
      clave: 'descripcion',
      nombre: 'descripcion',
      letra: 'B',
      obligatoria: false,
      nota: 'Descripción general del proyecto (máx. 2000 caracteres)',
    },
    {
      clave: 'responsable',
      nombre: 'responsable*',
      letra: 'C',
      obligatoria: true,
      nota: 'Nombre del responsable del proyecto (máx. 120 caracteres)',
    },
    {
      clave: 'presupuesto',
      nombre: 'presupuesto*',
      letra: 'D',
      obligatoria: true,
      nota: 'Presupuesto total en CLP (>= 0, máx. 2 decimales)',
    },
    {
      clave: 'fechaInicio',
      nombre: 'fechaInicio*',
      letra: 'E',
      obligatoria: true,
      nota: 'Fecha de inicio del proyecto (AAAA-MM-DD)',
    },
    {
      clave: 'fechaFin',
      nombre: 'fechaFin',
      letra: 'F',
      obligatoria: false,
      nota: 'Fecha estimada de fin (AAAA-MM-DD, >= fechaInicio)',
    },
  ],
  Calendario: [
    {
      clave: 'diasLaborables',
      nombre: 'diasLaborables*',
      letra: 'A',
      obligatoria: true,
      nota: 'Días laborables separados por coma (1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb, 0=Dom). Ej: 1,2,3,4,5',
    },
    {
      clave: 'horasPorDia',
      nombre: 'horasPorDia*',
      letra: 'B',
      obligatoria: true,
      nota: 'Jornada laboral en horas por día (1 a 24)',
    },
  ],
  Feriados: [
    {
      clave: 'fecha',
      nombre: 'fecha*',
      letra: 'A',
      obligatoria: true,
      nota: 'Fecha del feriado (AAAA-MM-DD)',
    },
    {
      clave: 'descripcion',
      nombre: 'descripcion*',
      letra: 'B',
      obligatoria: true,
      nota: 'Descripción o motivo del feriado (máx. 120 caracteres)',
    },
  ],
  Tareas: [
    {
      clave: 'codigo',
      nombre: 'codigo*',
      letra: 'A',
      obligatoria: true,
      nota: 'Código jerárquico de la tarea en texto (ej: 1, 1.1, 1.1.1)',
    },
    {
      clave: 'nivel',
      nombre: 'nivel*',
      letra: 'B',
      obligatoria: true,
      nota: 'Nivel jerárquico: ETAPA, ACTIVIDAD o SUBACTIVIDAD',
      lista: NIVELES_TAREA,
    },
    {
      clave: 'nombre',
      nombre: 'nombre*',
      letra: 'C',
      obligatoria: true,
      nota: 'Nombre de la tarea (máx. 120 caracteres)',
    },
    {
      clave: 'duracionDias',
      nombre: 'duracionDias*',
      letra: 'D',
      obligatoria: true,
      nota: 'Duración estimada en días laborables (>= 0)',
    },
    {
      clave: 'descripcion',
      nombre: 'descripcion',
      letra: 'E',
      obligatoria: false,
      nota: 'Descripción de la tarea (máx. 2000 caracteres)',
    },
    {
      clave: 'responsable',
      nombre: 'responsable',
      letra: 'F',
      obligatoria: false,
      nota: 'Responsable de la tarea (máx. 120 caracteres)',
    },
    {
      clave: 'fechaFija',
      nombre: 'fechaFija',
      letra: 'G',
      obligatoria: false,
      nota: 'Fecha fija de inicio planificado (AAAA-MM-DD)',
    },
    {
      clave: 'porcentajeAvance',
      nombre: 'porcentajeAvance',
      letra: 'H',
      obligatoria: false,
      nota: 'Porcentaje de avance (0 a 100)',
    },
    {
      clave: 'inicioReal',
      nombre: 'inicioReal',
      letra: 'I',
      obligatoria: false,
      nota: 'Fecha real de inicio (AAAA-MM-DD)',
    },
    {
      clave: 'finReal',
      nombre: 'finReal',
      letra: 'J',
      obligatoria: false,
      nota: 'Fecha real de fin (AAAA-MM-DD, >= inicioReal)',
    },
    {
      clave: 'inicioPlan',
      nombre: 'inicioPlan (calculado)',
      letra: 'K',
      obligatoria: false,
      nota: 'Fecha planificada calculada por el cronograma',
      calculada: true,
    },
    {
      clave: 'finPlan',
      nombre: 'finPlan (calculado)',
      letra: 'L',
      obligatoria: false,
      nota: 'Fecha planificada calculada por el cronograma',
      calculada: true,
    },
    {
      clave: 'holguraDias',
      nombre: 'holguraDias (calculado)',
      letra: 'M',
      obligatoria: false,
      nota: 'Holgura total en días calculada por CPM',
      calculada: true,
    },
    {
      clave: 'esCritica',
      nombre: 'esCritica (calculado)',
      letra: 'N',
      obligatoria: false,
      nota: 'Indica si la tarea forma parte de la ruta crítica',
      calculada: true,
    },
    {
      clave: 'costoPlan',
      nombre: 'costoPlan (calculado)',
      letra: 'O',
      obligatoria: false,
      nota: 'Costo total planificado calculado según asignaciones',
      calculada: true,
    },
  ],
  Dependencias: [
    {
      clave: 'predecesora',
      nombre: 'predecesora*',
      letra: 'A',
      obligatoria: true,
      nota: 'Código de la tarea predecesora (debe ser tarea hoja)',
    },
    {
      clave: 'sucesora',
      nombre: 'sucesora*',
      letra: 'B',
      obligatoria: true,
      nota: 'Código de la tarea sucesora (debe ser tarea hoja)',
    },
    {
      clave: 'tipo',
      nombre: 'tipo*',
      letra: 'C',
      obligatoria: true,
      nota: 'Tipo de dependencia: FS, SS, FF o SF',
      lista: TIPOS_DEPENDENCIA,
    },
    {
      clave: 'desfaseDias',
      nombre: 'desfaseDias',
      letra: 'D',
      obligatoria: false,
      nota: 'Días de desfase (-365 a 365, por defecto 0)',
    },
  ],
  Profesionales: [
    {
      clave: 'nombre',
      nombre: 'nombre*',
      letra: 'A',
      obligatoria: true,
      nota: 'Nombre completo del profesional (único, máx. 120 caracteres)',
    },
    {
      clave: 'cargo',
      nombre: 'cargo*',
      letra: 'B',
      obligatoria: true,
      nota: 'Cargo o especialidad del profesional (máx. 120 caracteres)',
    },
    {
      clave: 'tarifaHora',
      nombre: 'tarifaHora*',
      letra: 'C',
      obligatoria: true,
      nota: 'Tarifa horaria en CLP (>= 0, máx. 9.999.999)',
    },
    {
      clave: 'horasDiarias',
      nombre: 'horasDiarias',
      letra: 'D',
      obligatoria: false,
      nota: 'Horas disponibles por jornada (1 a 24, por defecto 8)',
    },
  ],
  Recursos: [
    {
      clave: 'nombre',
      nombre: 'nombre*',
      letra: 'A',
      obligatoria: true,
      nota: 'Nombre del recurso o insumo (único, máx. 120 caracteres)',
    },
    {
      clave: 'tipo',
      nombre: 'tipo*',
      letra: 'B',
      obligatoria: true,
      nota: 'Tipo de recurso: Humano, Equipamiento, Material, Servicio',
      lista: ['Humano', 'Equipamiento', 'Material', 'Servicio'],
    },
    {
      clave: 'unidad',
      nombre: 'unidad*',
      letra: 'C',
      obligatoria: true,
      nota: 'Unidad de medida (ej: hora, unidad, día, mes, litro, kg)',
    },
    {
      clave: 'costoUnitario',
      nombre: 'costoUnitario*',
      letra: 'D',
      obligatoria: true,
      nota: 'Costo unitario en CLP (>= 0, máx. 99.999.999)',
    },
  ],
  Asignaciones: [
    {
      clave: 'tarea',
      nombre: 'tarea*',
      letra: 'A',
      obligatoria: true,
      nota: 'Código de la tarea asignada (debe ser tarea hoja)',
    },
    {
      clave: 'profesional',
      nombre: 'profesional',
      letra: 'B',
      obligatoria: false,
      nota: 'Nombre del profesional asignado (debe coincidir con catálogo o Profesionales)',
    },
    {
      clave: 'recurso',
      nombre: 'recurso',
      letra: 'C',
      obligatoria: false,
      nota: 'Nombre del recurso asignado (debe coincidir con catálogo o Recursos)',
    },
    {
      clave: 'dedicacion',
      nombre: 'dedicacion',
      letra: 'D',
      obligatoria: false,
      nota: 'Porcentaje de dedicación del profesional (1 a 100, por defecto 100)',
    },
    {
      clave: 'horasPlan',
      nombre: 'horasPlan',
      letra: 'E',
      obligatoria: false,
      nota: 'Horas planificadas manuales para el profesional (>= 0)',
    },
    {
      clave: 'horasReales',
      nombre: 'horasReales',
      letra: 'F',
      obligatoria: false,
      nota: 'Horas reales ejecutadas por el profesional (>= 0)',
    },
    {
      clave: 'cantidadPlan',
      nombre: 'cantidadPlan',
      letra: 'G',
      obligatoria: false,
      nota: 'Cantidad planificada para el recurso (> 0)',
    },
    {
      clave: 'cantidadReal',
      nombre: 'cantidadReal',
      letra: 'H',
      obligatoria: false,
      nota: 'Cantidad real utilizada para el recurso (>= 0)',
    },
    {
      clave: 'tarifaAplicada',
      nombre: 'tarifaAplicada',
      letra: 'I',
      obligatoria: false,
      nota: 'Tarifa horaria aplicada congelada (>= 0)',
    },
    {
      clave: 'costoUnitarioAplicado',
      nombre: 'costoUnitarioAplicado',
      letra: 'J',
      obligatoria: false,
      nota: 'Costo unitario aplicado congelado (>= 0)',
    },
  ],
  Hitos: [
    {
      clave: 'nombre',
      nombre: 'nombre*',
      letra: 'A',
      obligatoria: true,
      nota: 'Nombre del hito de control (máx. 120 caracteres)',
    },
    {
      clave: 'fechaObjetivo',
      nombre: 'fechaObjetivo*',
      letra: 'B',
      obligatoria: true,
      nota: 'Fecha objetivo del hito (AAAA-MM-DD)',
    },
    {
      clave: 'tarea',
      nombre: 'tarea',
      letra: 'C',
      obligatoria: false,
      nota: 'Código de la tarea vinculada (opcional)',
    },
    {
      clave: 'criterio',
      nombre: 'criterio',
      letra: 'D',
      obligatoria: false,
      nota: 'Criterio de aceptación o éxito (máx. 500 caracteres)',
    },
    {
      clave: 'responsable',
      nombre: 'responsable',
      letra: 'E',
      obligatoria: false,
      nota: 'Responsable del hito (máx. 120 caracteres)',
    },
    {
      clave: 'fechaCumplimiento',
      nombre: 'fechaCumplimiento',
      letra: 'F',
      obligatoria: false,
      nota: 'Fecha en que se cumplió el hito (AAAA-MM-DD)',
    },
  ],
  KPI: [
    {
      clave: 'codigo',
      nombre: 'codigo*',
      letra: 'A',
      obligatoria: true,
      nota: 'Código único del KPI (ej: EV-01, máx. 40 caracteres)',
    },
    {
      clave: 'nombre',
      nombre: 'nombre*',
      letra: 'B',
      obligatoria: true,
      nota: 'Nombre del indicador (máx. 120 caracteres)',
    },
    {
      clave: 'ambito',
      nombre: 'ambito*',
      letra: 'C',
      obligatoria: true,
      nota: 'Ámbito: PROYECTO, HITO o CAMBIO',
      lista: AMBITOS_KPI,
    },
    {
      clave: 'formula',
      nombre: 'formula*',
      letra: 'D',
      obligatoria: true,
      nota: 'Fórmula de cálculo (expresión o identificador, máx. 255 caracteres)',
    },
    {
      clave: 'unidad',
      nombre: 'unidad*',
      letra: 'E',
      obligatoria: true,
      nota: 'Unidad: PORCENTAJE, INDICE, DIAS, CLP, NUMERO',
      lista: UNIDADES_KPI,
    },
    {
      clave: 'meta',
      nombre: 'meta',
      letra: 'F',
      obligatoria: false,
      nota: 'Valor meta del indicador',
    },
    {
      clave: 'direccion',
      nombre: 'direccion*',
      letra: 'G',
      obligatoria: true,
      nota: 'Dirección: MAYOR_MEJOR o MENOR_MEJOR',
      lista: DIRECCIONES_KPI,
    },
  ],
  Solicitudes: [
    {
      clave: 'codigo',
      nombre: 'codigo',
      letra: 'A',
      obligatoria: false,
      nota: 'Código de la solicitud (ej: SC-001, opcional)',
    },
    {
      clave: 'titulo',
      nombre: 'titulo*',
      letra: 'B',
      obligatoria: true,
      nota: 'Título de la solicitud de cambio (máx. 120 caracteres)',
    },
    {
      clave: 'descripcion',
      nombre: 'descripcion*',
      letra: 'C',
      obligatoria: true,
      nota: 'Descripción de la modificación requerida (máx. 2000 caracteres)',
    },
    {
      clave: 'justificacion',
      nombre: 'justificacion*',
      letra: 'D',
      obligatoria: true,
      nota: 'Justificación del cambio propuesto (máx. 2000 caracteres)',
    },
    {
      clave: 'solicitante',
      nombre: 'solicitante*',
      letra: 'E',
      obligatoria: true,
      nota: 'Nombre del solicitante (máx. 120 caracteres)',
    },
    {
      clave: 'responsable',
      nombre: 'responsable*',
      letra: 'F',
      obligatoria: true,
      nota: 'Nombre del responsable asignado (máx. 120 caracteres)',
    },
    {
      clave: 'prioridad',
      nombre: 'prioridad*',
      letra: 'G',
      obligatoria: true,
      nota: 'Prioridad: BAJA, MEDIA, ALTA, CRITICA',
      lista: PRIORIDADES_SOLICITUD,
    },
    {
      clave: 'categoria',
      nombre: 'categoria*',
      letra: 'H',
      obligatoria: true,
      nota: 'Categoría: ALCANCE, PLAZO, COSTO, RECURSO, CALIDAD',
      lista: CATEGORIAS_CAMBIO,
    },
    {
      clave: 'probabilidadRiesgo',
      nombre: 'probabilidadRiesgo*',
      letra: 'I',
      obligatoria: true,
      nota: 'Nivel de probabilidad del riesgo (entero 1 a 5)',
    },
    {
      clave: 'impactoRiesgo',
      nombre: 'impactoRiesgo*',
      letra: 'J',
      obligatoria: true,
      nota: 'Nivel de impacto del riesgo (entero 1 a 5)',
    },
    {
      clave: 'estado',
      nombre: 'estado (referencia)',
      letra: 'K',
      obligatoria: false,
      nota: 'Estado de referencia; siempre se importará como REGISTRADA',
      calculada: true,
    },
    {
      clave: 'etapaActual',
      nombre: 'etapaActual (referencia)',
      letra: 'L',
      obligatoria: false,
      nota: 'Etapa actual de referencia; se inicializará en etapa 1',
      calculada: true,
    },
  ],
};

export const REGEX_CODIGO = /^[1-9]\d*(\.[1-9]\d*){0,2}$/;

export function codigoDesdeCelda(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'number') {
    return String(valor);
  }
  return String(valor).trim();
}

export function normalizarFechaCelda(valor: unknown): string | null {
  if (valor === null || valor === undefined || valor === '') return null;
  if (valor instanceof Date) {
    if (isNaN(valor.getTime())) return null;
    return valor.toISOString().slice(0, 10);
  }
  if (typeof valor === 'string') {
    const trimmed = valor.trim();
    if (!trimmed) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const fecha = new Date(`${trimmed}T00:00:00.000Z`);
      if (!isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === trimmed) {
        return trimmed;
      }
      return null;
    }
  }
  return null;
}

export function componentesFuertes(nodos: string[], aristas: [string, string][]): string[][] {
  const adyacencia = new Map<string, string[]>();
  for (const n of nodos) {
    adyacencia.set(n, []);
  }
  for (const [origen, destino] of aristas) {
    if (adyacencia.has(origen)) {
      adyacencia.get(origen)!.push(destino);
    }
  }

  let indice = 0;
  const indices = new Map<string, number>();
  const lowlinks = new Map<string, number>();
  const enPila = new Set<string>();
  const pilaScc: string[] = [];
  const sccs: string[][] = [];

  for (const nodoInicial of nodos) {
    if (indices.has(nodoInicial)) continue;

    const stack: { u: string; i: number }[] = [{ u: nodoInicial, i: 0 }];
    indices.set(nodoInicial, indice);
    lowlinks.set(nodoInicial, indice);
    indice += 1;
    pilaScc.push(nodoInicial);
    enPila.add(nodoInicial);

    while (stack.length > 0) {
      const actual = stack[stack.length - 1];
      if (!actual) break;
      const u = actual.u;
      const vecinos = adyacencia.get(u) ?? [];

      if (actual.i < vecinos.length) {
        const v = vecinos[actual.i];
        actual.i += 1;
        if (!v) continue;

        if (!indices.has(v)) {
          indices.set(v, indice);
          lowlinks.set(v, indice);
          indice += 1;
          pilaScc.push(v);
          enPila.add(v);
          stack.push({ u: v, i: 0 });
        } else if (enPila.has(v)) {
          lowlinks.set(u, Math.min(lowlinks.get(u)!, indices.get(v)!));
        }
      } else {
        stack.pop();
        if (stack.length > 0) {
          const padre = stack[stack.length - 1]?.u;
          if (padre) {
            lowlinks.set(padre, Math.min(lowlinks.get(padre)!, lowlinks.get(u)!));
          }
        }

        if (lowlinks.get(u) === indices.get(u)) {
          const scc: string[] = [];
          while (true) {
            const w = pilaScc.pop()!;
            enPila.delete(w);
            scc.push(w);
            if (w === u) break;
          }
          sccs.push(scc);
        }
      }
    }
  }

  return sccs;
}

export function encontrarCiclos(nodos: string[], aristas: [string, string][]): string[][] {
  const sccs = componentesFuertes(nodos, aristas);
  const bucles = new Set<string>();
  for (const [o, d] of aristas) {
    if (o === d) bucles.add(o);
  }
  return sccs.filter(
    (scc) => scc.length > 1 || (scc.length === 1 && scc[0] !== undefined && bucles.has(scc[0])),
  );
}

export type FilaCarga = Record<string, unknown>;
export type LibroCarga = Record<string, FilaCarga[]>;

export interface ErrorValidacionCarga {
  hoja: string;
  fila: number;
  columna: string;
  celda: string;
  mensaje: string;
}

export interface AdvertenciaCarga {
  hoja: string;
  fila: number;
  columna: string;
  celda: string;
  mensaje: string;
}

export interface ResumenHojaValidacion {
  hoja: string;
  filas: number;
  validas: number;
  invalidas: number;
}

export interface ResultadoValidacionLibro {
  valido: boolean;
  hojas: ResumenHojaValidacion[];
  errores: ErrorValidacionCarga[];
  advertencias: AdvertenciaCarga[];
  truncado: boolean;
}

export interface CatalogoExistente {
  profesionales?: Array<{ id: number; nombre: string; tarifaHora: number; activo: boolean }>;
  recursos?: Array<{
    id: number;
    nombre: string;
    costoUnitario: number;
    activo: boolean;
    tipo?: string;
    unidad?: string;
  }>;
  kpis?: Array<{ id: number; codigo: string; nombre: string }>;
}

export interface OpcionesValidacionLibro {
  catalogo?: CatalogoExistente;
  maximoErrores?: number;
  encabezadosPorHoja?: Record<string, string[]>;
  ordenHojas?: string[];
}

function esFilaVacia(fila: FilaCarga): boolean {
  for (const [k, v] of Object.entries(fila)) {
    if (k.startsWith('_')) continue;
    if (v !== null && v !== undefined && String(v).trim() !== '') return false;
  }
  return true;
}

function obtenerLetraColumna(hoja: HojaCarga, clave: string): string {
  const cols = COLUMNAS_POR_HOJA[hoja] ?? [];
  return cols.find((c) => c.clave === clave)?.letra ?? 'A';
}

export function validarLibro(
  libro: LibroCarga,
  opciones: OpcionesValidacionLibro = {},
): ResultadoValidacionLibro {
  const maximoErrores = opciones.maximoErrores ?? 200;
  const catalogo = opciones.catalogo ?? {};
  const errores: ErrorValidacionCarga[] = [];
  const advertencias: AdvertenciaCarga[] = [];
  let truncado = false;

  const agregarError = (hoja: string, fila: number, columnaClave: string, mensaje: string) => {
    if (errores.length >= maximoErrores) {
      truncado = true;
      return;
    }
    const letra = obtenerLetraColumna(hoja as HojaCarga, columnaClave);
    errores.push({
      hoja,
      fila,
      columna: columnaClave,
      celda: `${hoja}!${letra}${fila}`,
      mensaje,
    });
    if (errores.length >= maximoErrores) {
      truncado = true;
    }
  };

  const agregarAdvertencia = (
    hoja: string,
    fila: number,
    columnaClave: string,
    mensaje: string,
  ) => {
    const letra = obtenerLetraColumna(hoja as HojaCarga, columnaClave);
    advertencias.push({
      hoja,
      fila,
      columna: columnaClave,
      celda: `${hoja}!${letra}${fila}`,
      mensaje,
    });
  };

  const hojasValidadas: HojaCarga[] = [
    'Proyecto',
    'Calendario',
    'Feriados',
    'Tareas',
    'Dependencias',
    'Profesionales',
    'Recursos',
    'Asignaciones',
    'Hitos',
    'KPI',
    'Solicitudes',
  ];

  if (opciones.ordenHojas && opciones.ordenHojas.length > 0) {
    const hojasEsperadas = HOJAS_CARGA.filter((h) => h !== 'Instrucciones');
    const hojasPresentes = opciones.ordenHojas.filter((h) => h !== 'Instrucciones');
    for (let i = 0; i < hojasEsperadas.length; i += 1) {
      const esperada = hojasEsperadas[i];
      const presente = hojasPresentes[i];
      if (esperada && presente !== esperada) {
        agregarError(
          esperada,
          1,
          'A',
          `El orden de las hojas es incorrecto. Se esperaba '${esperada}' en la posición ${i + 2}.`,
        );
        break;
      }
    }
  }

  const filasInvalidasPorHoja = new Map<string, Set<number>>();
  for (const h of hojasValidadas) {
    filasInvalidasPorHoja.set(h, new Set());
  }

  const registrarFilaInvalida = (hoja: string, fila: number) => {
    filasInvalidasPorHoja.get(hoja)?.add(fila);
  };

  const filasFiltradasPorHoja = new Map<string, Array<{ fila: FilaCarga; numFila: number }>>();
  const hojasConFallaEstructural = new Set<string>();

  for (const hoja of hojasValidadas) {
    const defCols = COLUMNAS_POR_HOJA[hoja];
    const encabezados = opciones.encabezadosPorHoja?.[hoja];
    if (encabezados) {
      const obligatorias = defCols.filter((c) => c.obligatoria);
      for (const ob of obligatorias) {
        const existe = encabezados.some((e) => {
          const norm = e.replace(/\*/g, '').trim().toLowerCase();
          return (
            norm === ob.clave.toLowerCase() ||
            norm === ob.nombre.replace(/\*/g, '').trim().toLowerCase()
          );
        });
        if (!existe) {
          agregarError(hoja, 1, ob.clave, `falta la columna ${ob.nombre}`);
          hojasConFallaEstructural.add(hoja);
        }
      }
    }

    const filasRaw = libro[hoja] ?? [];
    const filtradas: Array<{ fila: FilaCarga; numFila: number }> = [];
    for (let i = 0; i < filasRaw.length; i += 1) {
      const f = filasRaw[i];
      if (!f) continue;
      const numFila = typeof f._fila === 'number' ? f._fila : i + 2;
      if (!esFilaVacia(f)) {
        filtradas.push({ fila: f, numFila });
      }
    }
    filasFiltradasPorHoja.set(hoja, filtradas);
  }

  if (!hojasConFallaEstructural.has('Proyecto')) {
    const filasProy = filasFiltradasPorHoja.get('Proyecto') ?? [];
    if (filasProy.length === 0) {
      agregarError('Proyecto', 1, 'nombre', 'La hoja Proyecto debe tener exactamente 1 fila.');
      registrarFilaInvalida('Proyecto', 1);
    } else {
      if (filasProy.length > 1) {
        for (let i = 1; i < filasProy.length; i += 1) {
          const fProy = filasProy[i];
          if (fProy) {
            agregarError(
              'Proyecto',
              fProy.numFila,
              'nombre',
              'La hoja Proyecto solo debe contener 1 fila de datos.',
            );
            registrarFilaInvalida('Proyecto', fProy.numFila);
          }
        }
      }
      const primerProy = filasProy[0];
      if (primerProy) {
        const { fila, numFila } = primerProy;
        const nombre = String(fila.nombre ?? '').trim();
        if (!nombre) {
          agregarError('Proyecto', numFila, 'nombre', 'Ingrese el nombre del proyecto.');
          registrarFilaInvalida('Proyecto', numFila);
        } else if (nombre.length > 120) {
          agregarError(
            'Proyecto',
            numFila,
            'nombre',
            'El nombre supera el máximo de 120 caracteres.',
          );
          registrarFilaInvalida('Proyecto', numFila);
        }

        const responsable = String(fila.responsable ?? '').trim();
        if (!responsable) {
          agregarError('Proyecto', numFila, 'responsable', 'Ingrese el responsable del proyecto.');
          registrarFilaInvalida('Proyecto', numFila);
        } else if (responsable.length > 120) {
          agregarError(
            'Proyecto',
            numFila,
            'responsable',
            'El responsable supera el máximo de 120 caracteres.',
          );
          registrarFilaInvalida('Proyecto', numFila);
        }

        const pres = Number(fila.presupuesto);
        if (
          fila.presupuesto === undefined ||
          fila.presupuesto === null ||
          String(fila.presupuesto).trim() === '' ||
          isNaN(pres)
        ) {
          agregarError('Proyecto', numFila, 'presupuesto', 'El presupuesto debe ser numérico.');
          registrarFilaInvalida('Proyecto', numFila);
        } else if (pres < 0) {
          agregarError('Proyecto', numFila, 'presupuesto', 'El presupuesto no puede ser negativo.');
          registrarFilaInvalida('Proyecto', numFila);
        } else if (pres > 999_999_999_999.99) {
          agregarError(
            'Proyecto',
            numFila,
            'presupuesto',
            'El presupuesto supera el máximo permitido.',
          );
          registrarFilaInvalida('Proyecto', numFila);
        }

        const fechaIni = normalizarFechaCelda(fila.fechaInicio);
        if (!fechaIni) {
          agregarError(
            'Proyecto',
            numFila,
            'fechaInicio',
            'La fecha de inicio debe tener formato AAAA-MM-DD.',
          );
          registrarFilaInvalida('Proyecto', numFila);
        }

        if (
          fila.fechaFin !== undefined &&
          fila.fechaFin !== null &&
          String(fila.fechaFin).trim() !== ''
        ) {
          const fechaFin = normalizarFechaCelda(fila.fechaFin);
          if (!fechaFin) {
            agregarError(
              'Proyecto',
              numFila,
              'fechaFin',
              'La fecha de fin debe tener formato AAAA-MM-DD.',
            );
            registrarFilaInvalida('Proyecto', numFila);
          } else if (fechaIni && fechaFin < fechaIni) {
            agregarError(
              'Proyecto',
              numFila,
              'fechaFin',
              'La fecha de fin es anterior a la de inicio.',
            );
            registrarFilaInvalida('Proyecto', numFila);
          }
        }
      }
    }
  }

  if (!hojasConFallaEstructural.has('Calendario')) {
    const filasCal = filasFiltradasPorHoja.get('Calendario') ?? [];
    if (filasCal.length === 0) {
      agregarError(
        'Calendario',
        1,
        'diasLaborables',
        'La hoja Calendario debe tener exactamente 1 fila.',
      );
      registrarFilaInvalida('Calendario', 1);
    } else {
      if (filasCal.length > 1) {
        for (let i = 1; i < filasCal.length; i += 1) {
          const fCal = filasCal[i];
          if (fCal) {
            agregarError(
              'Calendario',
              fCal.numFila,
              'diasLaborables',
              'La hoja Calendario solo debe contener 1 fila de datos.',
            );
            registrarFilaInvalida('Calendario', fCal.numFila);
          }
        }
      }
      const primerCal = filasCal[0];
      if (primerCal) {
        const { fila, numFila } = primerCal;
        const diasStr = String(fila.diasLaborables ?? '').trim();
        const partes = diasStr
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        const numeros = partes.map(Number);
        if (
          partes.length === 0 ||
          numeros.some((n) => isNaN(n) || !Number.isInteger(n) || n < 0 || n > 6)
        ) {
          agregarError(
            'Calendario',
            numFila,
            'diasLaborables',
            'Los días laborables deben ser números entre 0 y 6 separados por coma.',
          );
          registrarFilaInvalida('Calendario', numFila);
        } else {
          const setDias = new Set(numeros);
          if (setDias.size === 0) {
            agregarError(
              'Calendario',
              numFila,
              'diasLaborables',
              'Debe indicar al menos un día laborable.',
            );
            registrarFilaInvalida('Calendario', numFila);
          }
        }

        const hpd = Number(fila.horasPorDia);
        if (
          fila.horasPorDia === undefined ||
          fila.horasPorDia === null ||
          String(fila.horasPorDia).trim() === '' ||
          isNaN(hpd)
        ) {
          agregarError(
            'Calendario',
            numFila,
            'horasPorDia',
            'Las horas por día deben ser numéricas.',
          );
          registrarFilaInvalida('Calendario', numFila);
        } else if (hpd <= 0 || hpd > 24) {
          agregarError(
            'Calendario',
            numFila,
            'horasPorDia',
            'Las horas por día deben estar entre 1 y 24.',
          );
          registrarFilaInvalida('Calendario', numFila);
        }
      }
    }
  }

  if (!hojasConFallaEstructural.has('Feriados')) {
    const feriadosFilas = filasFiltradasPorHoja.get('Feriados') ?? [];
    const fechasVistas = new Map<string, number>();
    for (const { fila, numFila } of feriadosFilas) {
      const fIso = normalizarFechaCelda(fila.fecha);
      if (!fIso) {
        agregarError(
          'Feriados',
          numFila,
          'fecha',
          'La fecha del feriado debe tener formato AAAA-MM-DD.',
        );
        registrarFilaInvalida('Feriados', numFila);
      } else {
        const filaPrevia = fechasVistas.get(fIso);
        if (filaPrevia !== undefined) {
          agregarError(
            'Feriados',
            numFila,
            'fecha',
            `La fecha ${fIso} ya fue registrada en la fila ${filaPrevia}.`,
          );
          registrarFilaInvalida('Feriados', numFila);
        } else {
          fechasVistas.set(fIso, numFila);
        }
      }

      const desc = String(fila.descripcion ?? '').trim();
      if (!desc) {
        agregarError('Feriados', numFila, 'descripcion', 'Ingrese la descripción del feriado.');
        registrarFilaInvalida('Feriados', numFila);
      } else if (desc.length > 120) {
        agregarError(
          'Feriados',
          numFila,
          'descripcion',
          'La descripción supera el máximo de 120 caracteres.',
        );
        registrarFilaInvalida('Feriados', numFila);
      }
    }
  }

  interface InfoTareaValidada {
    codigo: string;
    numFila: number;
    nivel: NivelTarea;
    nombre: string;
    esHoja: boolean;
    inicioReal: string | null;
    finReal: string | null;
  }
  const tareasPorCodigo = new Map<string, InfoTareaValidada>();
  const codigosVistos = new Map<string, number>();

  if (!hojasConFallaEstructural.has('Tareas')) {
    const tareasFilas = filasFiltradasPorHoja.get('Tareas') ?? [];
    for (const { fila, numFila } of tareasFilas) {
      const codigoRaw = fila.codigo;
      if (typeof codigoRaw === 'number' && !Number.isInteger(codigoRaw)) {
        agregarError(
          'Tareas',
          numFila,
          'codigo',
          `El código '${codigoRaw}' no es un número entero válido.`,
        );
        registrarFilaInvalida('Tareas', numFila);
        continue;
      }
      const codigo = codigoDesdeCelda(codigoRaw);
      if (!codigo || !REGEX_CODIGO.test(codigo)) {
        agregarError(
          'Tareas',
          numFila,
          'codigo',
          `El código '${codigo}' tiene un formato inválido. Debe seguir el formato 1, 1.2 o 1.2.3.`,
        );
        registrarFilaInvalida('Tareas', numFila);
        continue;
      }

      const filaPrevia = codigosVistos.get(codigo);
      if (filaPrevia !== undefined) {
        agregarError(
          'Tareas',
          numFila,
          'codigo',
          `El código ${codigo} ya fue definido en la fila ${filaPrevia}.`,
        );
        registrarFilaInvalida('Tareas', numFila);
        continue;
      }
      codigosVistos.set(codigo, numFila);

      const nivelStr = String(fila.nivel ?? '')
        .trim()
        .toUpperCase();
      if (!NIVELES_TAREA.includes(nivelStr as NivelTarea)) {
        agregarError(
          'Tareas',
          numFila,
          'nivel',
          `El nivel '${fila.nivel}' es inválido. Valores permitidos: ETAPA, ACTIVIDAD, SUBACTIVIDAD.`,
        );
        registrarFilaInvalida('Tareas', numFila);
      }

      const nom = String(fila.nombre ?? '').trim();
      if (!nom) {
        agregarError('Tareas', numFila, 'nombre', 'Ingrese el nombre de la tarea.');
        registrarFilaInvalida('Tareas', numFila);
      } else if (nom.length > 120) {
        agregarError('Tareas', numFila, 'nombre', 'El nombre supera el máximo de 120 caracteres.');
        registrarFilaInvalida('Tareas', numFila);
      }

      const dur = Number(fila.duracionDias);
      if (
        fila.duracionDias !== undefined &&
        fila.duracionDias !== null &&
        String(fila.duracionDias).trim() !== ''
      ) {
        if (isNaN(dur) || dur < 0) {
          agregarError(
            'Tareas',
            numFila,
            'duracionDias',
            'La duración debe ser un número mayor o igual a 0.',
          );
          registrarFilaInvalida('Tareas', numFila);
        }
      }

      const iniR = normalizarFechaCelda(fila.inicioReal);
      const finR = normalizarFechaCelda(fila.finReal);
      if (fila.inicioReal && !iniR) {
        agregarError(
          'Tareas',
          numFila,
          'inicioReal',
          'La fecha de inicio real debe tener formato AAAA-MM-DD.',
        );
        registrarFilaInvalida('Tareas', numFila);
      }
      if (fila.finReal && !finR) {
        agregarError(
          'Tareas',
          numFila,
          'finReal',
          'La fecha de fin real debe tener formato AAAA-MM-DD.',
        );
        registrarFilaInvalida('Tareas', numFila);
      }
      if (iniR && finR && finR < iniR) {
        agregarError('Tareas', numFila, 'finReal', 'La fecha de fin es anterior a la de inicio.');
        registrarFilaInvalida('Tareas', numFila);
      }

      if (NIVELES_TAREA.includes(nivelStr as NivelTarea)) {
        tareasPorCodigo.set(codigo, {
          codigo,
          numFila,
          nivel: nivelStr as NivelTarea,
          nombre: nom,
          esHoja: true,
          inicioReal: iniR,
          finReal: finR,
        });
      }
    }

    for (const [codigo, info] of tareasPorCodigo) {
      const segmentos = codigo.split('.');
      const profundidad = segmentos.length;
      if (profundidad === 1 && info.nivel !== 'ETAPA') {
        agregarError(
          'Tareas',
          info.numFila,
          'nivel',
          `El nivel ${info.nivel} no coincide con la profundidad del código ${codigo}. Se esperaba ETAPA.`,
        );
        registrarFilaInvalida('Tareas', info.numFila);
      } else if (profundidad === 2 && info.nivel !== 'ACTIVIDAD') {
        agregarError(
          'Tareas',
          info.numFila,
          'nivel',
          `El nivel ${info.nivel} no coincide con la profundidad del código ${codigo}. Se esperaba ACTIVIDAD.`,
        );
        registrarFilaInvalida('Tareas', info.numFila);
      } else if (profundidad === 3 && info.nivel !== 'SUBACTIVIDAD') {
        agregarError(
          'Tareas',
          info.numFila,
          'nivel',
          `El nivel ${info.nivel} no coincide con la profundidad del código ${codigo}. Se esperaba SUBACTIVIDAD.`,
        );
        registrarFilaInvalida('Tareas', info.numFila);
      }

      if (profundidad > 1) {
        const codigoPadre = segmentos.slice(0, -1).join('.');
        const infoPadre = tareasPorCodigo.get(codigoPadre);
        if (!infoPadre) {
          agregarError(
            'Tareas',
            info.numFila,
            'codigo',
            `El padre ${codigoPadre} no existe para el código ${codigo}.`,
          );
          registrarFilaInvalida('Tareas', info.numFila);
        } else {
          infoPadre.esHoja = false;
        }
      }
    }

    const gruposHijos = new Map<
      string,
      Array<{ ultimoSegmento: number; codigo: string; numFila: number }>
    >();
    for (const [codigo, info] of tareasPorCodigo) {
      const segmentos = codigo.split('.');
      const padre = segmentos.length === 1 ? '' : segmentos.slice(0, -1).join('.');
      const ultimo = segmentos[segmentos.length - 1] ?? '0';
      const seg = parseInt(ultimo, 10);
      const grupo = gruposHijos.get(padre) ?? [];
      grupo.push({ ultimoSegmento: seg, codigo, numFila: info.numFila });
      gruposHijos.set(padre, grupo);
    }

    for (const [padre, hijos] of gruposHijos) {
      hijos.sort((a, b) => a.ultimoSegmento - b.ultimoSegmento);
      for (let i = 0; i < hijos.length; i += 1) {
        const hijo = hijos[i];
        if (!hijo) continue;
        const esperado = i + 1;
        if (hijo.ultimoSegmento !== esperado) {
          const esperadoCodigo = padre === '' ? String(esperado) : `${padre}.${esperado}`;
          agregarError(
            'Tareas',
            hijo.numFila,
            'codigo',
            `el código ${hijo.codigo} no es consecutivo; se esperaba ${esperadoCodigo}`,
          );
          registrarFilaInvalida('Tareas', hijo.numFila);
          break;
        }
      }
    }
  }

  if (!hojasConFallaEstructural.has('Dependencias')) {
    const depsFilas = filasFiltradasPorHoja.get('Dependencias') ?? [];
    const depsVistas = new Map<string, number>();
    const aristasValidas: [string, string][] = [];

    for (const { fila, numFila } of depsFilas) {
      const pred = codigoDesdeCelda(fila.predecesora);
      const suc = codigoDesdeCelda(fila.sucesora);
      const tipo = String(fila.tipo ?? '')
        .trim()
        .toUpperCase();

      if (!pred) {
        agregarError(
          'Dependencias',
          numFila,
          'predecesora',
          'Ingrese el código de la tarea predecesora.',
        );
        registrarFilaInvalida('Dependencias', numFila);
      }
      if (!suc) {
        agregarError(
          'Dependencias',
          numFila,
          'sucesora',
          'Ingrese el código de la tarea sucesora.',
        );
        registrarFilaInvalida('Dependencias', numFila);
      }

      if (pred && suc) {
        if (pred === suc) {
          agregarError(
            'Dependencias',
            numFila,
            'sucesora',
            'Una tarea no puede depender de sí misma.',
          );
          registrarFilaInvalida('Dependencias', numFila);
        }

        const infoPred = tareasPorCodigo.get(pred);
        const infoSuc = tareasPorCodigo.get(suc);

        if (!infoPred) {
          agregarError(
            'Dependencias',
            numFila,
            'predecesora',
            `La tarea predecesora ${pred} no existe.`,
          );
          registrarFilaInvalida('Dependencias', numFila);
        } else if (!infoPred.esHoja) {
          agregarError(
            'Dependencias',
            numFila,
            'predecesora',
            `La tarea predecesora ${pred} no es una tarea hoja (tiene subtareas).`,
          );
          registrarFilaInvalida('Dependencias', numFila);
        }

        if (!infoSuc) {
          agregarError('Dependencias', numFila, 'sucesora', `La tarea sucesora ${suc} no existe.`);
          registrarFilaInvalida('Dependencias', numFila);
        } else if (!infoSuc.esHoja) {
          agregarError(
            'Dependencias',
            numFila,
            'sucesora',
            `La tarea sucesora ${suc} no es una tarea hoja (tiene subtareas).`,
          );
          registrarFilaInvalida('Dependencias', numFila);
        }

        const claveDep = `${pred}->${suc}`;
        const filaDepPrevia = depsVistas.get(claveDep);
        if (filaDepPrevia !== undefined) {
          agregarError(
            'Dependencias',
            numFila,
            'sucesora',
            `La dependencia entre ${pred} y ${suc} ya fue definida en la fila ${filaDepPrevia}.`,
          );
          registrarFilaInvalida('Dependencias', numFila);
        } else {
          depsVistas.set(claveDep, numFila);
          if (infoPred && infoSuc && infoPred.esHoja && infoSuc.esHoja && pred !== suc) {
            aristasValidas.push([pred, suc]);
          }
        }
      }

      if (!TIPOS_DEPENDENCIA.includes(tipo as TipoDependencia)) {
        agregarError(
          'Dependencias',
          numFila,
          'tipo',
          `El tipo de dependencia '${fila.tipo}' es inválido. Valores permitidos: FS, SS, FF, SF.`,
        );
        registrarFilaInvalida('Dependencias', numFila);
      }

      if (
        fila.desfaseDias !== undefined &&
        fila.desfaseDias !== null &&
        String(fila.desfaseDias).trim() !== ''
      ) {
        const des = Number(fila.desfaseDias);
        if (isNaN(des) || !Number.isInteger(des) || des < -365 || des > 365) {
          agregarError(
            'Dependencias',
            numFila,
            'desfaseDias',
            'El desfase en días debe ser un número entero entre -365 y 365.',
          );
          registrarFilaInvalida('Dependencias', numFila);
        }
      }
    }

    if (aristasValidas.length > 0) {
      const hojasTareas = [...tareasPorCodigo.values()]
        .filter((t) => t.esHoja)
        .map((t) => t.codigo);
      const ciclos = encontrarCiclos(hojasTareas, aristasValidas);
      for (const ciclo of ciclos) {
        const tareasCiclo = new Set(ciclo);
        for (const { fila, numFila } of depsFilas) {
          const pred = codigoDesdeCelda(fila.predecesora);
          const suc = codigoDesdeCelda(fila.sucesora);
          if (tareasCiclo.has(pred) && tareasCiclo.has(suc)) {
            agregarError(
              'Dependencias',
              numFila,
              'sucesora',
              `Ciclo detectado en las tareas: ${ciclo.join(', ')}.`,
            );
            registrarFilaInvalida('Dependencias', numFila);
          }
        }
      }
    }
  }

  const profPorClave = new Map<string, { numFila: number; nombre: string; tarifaHora: number }>();
  if (!hojasConFallaEstructural.has('Profesionales')) {
    const profFilas = filasFiltradasPorHoja.get('Profesionales') ?? [];
    for (const { fila, numFila } of profFilas) {
      const nom = String(fila.nombre ?? '').trim();
      if (!nom) {
        agregarError('Profesionales', numFila, 'nombre', 'Ingrese el nombre del profesional.');
        registrarFilaInvalida('Profesionales', numFila);
      } else if (nom.length > 120) {
        agregarError(
          'Profesionales',
          numFila,
          'nombre',
          'El nombre supera el máximo de 120 caracteres.',
        );
        registrarFilaInvalida('Profesionales', numFila);
      } else {
        const cNom = claveNombre(nom);
        const previo = profPorClave.get(cNom);
        if (previo !== undefined) {
          agregarError(
            'Profesionales',
            numFila,
            'nombre',
            `El profesional '${nom}' ya fue registrado en la fila ${previo.numFila} con un nombre equivalente.`,
          );
          registrarFilaInvalida('Profesionales', numFila);
        } else {
          const th = Number(fila.tarifaHora);
          profPorClave.set(cNom, { numFila, nombre: nom, tarifaHora: isNaN(th) ? 0 : th });
        }
      }

      const cargo = String(fila.cargo ?? '').trim();
      if (!cargo) {
        agregarError('Profesionales', numFila, 'cargo', 'Ingrese el cargo del profesional.');
        registrarFilaInvalida('Profesionales', numFila);
      } else if (cargo.length > 120) {
        agregarError(
          'Profesionales',
          numFila,
          'cargo',
          'El cargo supera el máximo de 120 caracteres.',
        );
        registrarFilaInvalida('Profesionales', numFila);
      }

      const th = Number(fila.tarifaHora);
      if (
        fila.tarifaHora === undefined ||
        fila.tarifaHora === null ||
        String(fila.tarifaHora).trim() === '' ||
        isNaN(th)
      ) {
        agregarError(
          'Profesionales',
          numFila,
          'tarifaHora',
          'La tarifa por hora debe ser numérica.',
        );
        registrarFilaInvalida('Profesionales', numFila);
      } else if (th < 0 || th > 9_999_999) {
        agregarError(
          'Profesionales',
          numFila,
          'tarifaHora',
          'La tarifa por hora debe estar entre 0 y 9.999.999.',
        );
        registrarFilaInvalida('Profesionales', numFila);
      }

      if (
        fila.horasDiarias !== undefined &&
        fila.horasDiarias !== null &&
        String(fila.horasDiarias).trim() !== ''
      ) {
        const hd = Number(fila.horasDiarias);
        if (isNaN(hd) || hd < 1 || hd > 24) {
          agregarError(
            'Profesionales',
            numFila,
            'horasDiarias',
            'Las horas diarias deben estar entre 1 y 24.',
          );
          registrarFilaInvalida('Profesionales', numFila);
        }
      }
    }
  }

  const recPorClave = new Map<string, { numFila: number; nombre: string; costoUnitario: number }>();
  if (!hojasConFallaEstructural.has('Recursos')) {
    const recFilas = filasFiltradasPorHoja.get('Recursos') ?? [];
    const tiposValidos = ['Humano', 'Equipamiento', 'Material', 'Servicio'];
    for (const { fila, numFila } of recFilas) {
      const nom = String(fila.nombre ?? '').trim();
      if (!nom) {
        agregarError('Recursos', numFila, 'nombre', 'Ingrese el nombre del recurso.');
        registrarFilaInvalida('Recursos', numFila);
      } else if (nom.length > 120) {
        agregarError(
          'Recursos',
          numFila,
          'nombre',
          'El nombre supera el máximo de 120 caracteres.',
        );
        registrarFilaInvalida('Recursos', numFila);
      } else {
        const cNom = claveNombre(nom);
        const previo = recPorClave.get(cNom);
        if (previo !== undefined) {
          agregarError(
            'Recursos',
            numFila,
            'nombre',
            `El recurso '${nom}' ya fue registrado en la fila ${previo.numFila} con un nombre equivalente.`,
          );
          registrarFilaInvalida('Recursos', numFila);
        } else {
          const cu = Number(fila.costoUnitario);
          recPorClave.set(cNom, { numFila, nombre: nom, costoUnitario: isNaN(cu) ? 0 : cu });
        }
      }

      const tipo = String(fila.tipo ?? '').trim();
      if (!tiposValidos.includes(tipo)) {
        agregarError(
          'Recursos',
          numFila,
          'tipo',
          `El tipo de recurso '${fila.tipo}' es inválido. Valores permitidos: Humano, Equipamiento, Material, Servicio.`,
        );
        registrarFilaInvalida('Recursos', numFila);
      }

      const unidad = String(fila.unidad ?? '').trim();
      if (!unidad) {
        agregarError('Recursos', numFila, 'unidad', 'Ingrese la unidad del recurso.');
        registrarFilaInvalida('Recursos', numFila);
      } else if (unidad.length > 30) {
        agregarError('Recursos', numFila, 'unidad', 'La unidad supera el máximo de 30 caracteres.');
        registrarFilaInvalida('Recursos', numFila);
      }

      const cu = Number(fila.costoUnitario);
      if (
        fila.costoUnitario === undefined ||
        fila.costoUnitario === null ||
        String(fila.costoUnitario).trim() === '' ||
        isNaN(cu)
      ) {
        agregarError('Recursos', numFila, 'costoUnitario', 'El costo unitario debe ser numérico.');
        registrarFilaInvalida('Recursos', numFila);
      } else if (cu < 0 || cu > 99_999_999) {
        agregarError(
          'Recursos',
          numFila,
          'costoUnitario',
          'El costo unitario debe estar entre 0 y 99.999.999.',
        );
        registrarFilaInvalida('Recursos', numFila);
      }
    }
  }

  const catalogoProfMap = new Map<
    string,
    { id: number; nombre: string; tarifaHora: number; activo: boolean }
  >();
  for (const p of catalogo.profesionales ?? []) {
    catalogoProfMap.set(claveNombre(p.nombre), p);
  }
  const catalogoRecMap = new Map<
    string,
    { id: number; nombre: string; costoUnitario: number; activo: boolean }
  >();
  for (const r of catalogo.recursos ?? []) {
    catalogoRecMap.set(claveNombre(r.nombre), r);
  }

  if (!hojasConFallaEstructural.has('Asignaciones')) {
    const asigFilas = filasFiltradasPorHoja.get('Asignaciones') ?? [];
    for (const { fila, numFila } of asigFilas) {
      const codTarea = codigoDesdeCelda(fila.tarea);
      if (!codTarea) {
        agregarError('Asignaciones', numFila, 'tarea', 'Ingrese el código de la tarea asignada.');
        registrarFilaInvalida('Asignaciones', numFila);
      } else {
        const tInfo = tareasPorCodigo.get(codTarea);
        if (!tInfo) {
          agregarError('Asignaciones', numFila, 'tarea', `La tarea ${codTarea} no existe.`);
          registrarFilaInvalida('Asignaciones', numFila);
        } else if (!tInfo.esHoja) {
          agregarError(
            'Asignaciones',
            numFila,
            'tarea',
            `La tarea ${codTarea} no es una tarea hoja y no puede tener asignaciones.`,
          );
          registrarFilaInvalida('Asignaciones', numFila);
        }
      }

      const profNom = String(fila.profesional ?? '').trim();
      const recNom = String(fila.recurso ?? '').trim();

      if (profNom && recNom) {
        agregarError(
          'Asignaciones',
          numFila,
          'profesional',
          'La asignación debe tener profesional o recurso, no ambos.',
        );
        registrarFilaInvalida('Asignaciones', numFila);
      } else if (!profNom && !recNom) {
        agregarError(
          'Asignaciones',
          numFila,
          'profesional',
          'Debe indicar un profesional o un recurso para la asignación.',
        );
        registrarFilaInvalida('Asignaciones', numFila);
      } else if (profNom) {
        const cNom = claveNombre(profNom);
        const enHoja = profPorClave.get(cNom);
        const enCat = catalogoProfMap.get(cNom);

        if (!enHoja && !enCat) {
          agregarError(
            'Asignaciones',
            numFila,
            'profesional',
            `El profesional '${profNom}' no existe en la hoja ni en el catálogo.`,
          );
          registrarFilaInvalida('Asignaciones', numFila);
        } else if (enCat && !enCat.activo && !enHoja) {
          agregarError(
            'Asignaciones',
            numFila,
            'profesional',
            `El profesional '${profNom}' está inactivo en el catálogo.`,
          );
          registrarFilaInvalida('Asignaciones', numFila);
        } else if (enCat) {
          let tarifaHoja: number | undefined;
          if (
            fila.tarifaAplicada !== undefined &&
            fila.tarifaAplicada !== null &&
            String(fila.tarifaAplicada).trim() !== ''
          ) {
            tarifaHoja = Number(fila.tarifaAplicada);
          } else if (enHoja) {
            tarifaHoja = enHoja.tarifaHora;
          }
          if (tarifaHoja !== undefined && tarifaHoja !== enCat.tarifaHora) {
            agregarAdvertencia(
              'Asignaciones',
              numFila,
              'tarifaAplicada',
              `La tarifa indicada para '${profNom}' ($${tarifaHoja}) difiere de la del catálogo ($${enCat.tarifaHora}).`,
            );
          }
        }

        if (
          fila.dedicacion !== undefined &&
          fila.dedicacion !== null &&
          String(fila.dedicacion).trim() !== ''
        ) {
          const ded = Number(fila.dedicacion);
          if (isNaN(ded) || ded < 1 || ded > 100) {
            agregarError(
              'Asignaciones',
              numFila,
              'dedicacion',
              'La dedicación debe estar entre 1 y 100.',
            );
            registrarFilaInvalida('Asignaciones', numFila);
          }
        }
      } else if (recNom) {
        const cNom = claveNombre(recNom);
        const enHoja = recPorClave.get(cNom);
        const enCat = catalogoRecMap.get(cNom);

        if (!enHoja && !enCat) {
          agregarError(
            'Asignaciones',
            numFila,
            'recurso',
            `El recurso '${recNom}' no existe en la hoja ni en el catálogo.`,
          );
          registrarFilaInvalida('Asignaciones', numFila);
        } else if (enCat && !enCat.activo && !enHoja) {
          agregarError(
            'Asignaciones',
            numFila,
            'recurso',
            `El recurso '${recNom}' está inactivo en el catálogo.`,
          );
          registrarFilaInvalida('Asignaciones', numFila);
        } else if (enCat) {
          let costoHoja: number | undefined;
          if (
            fila.costoUnitarioAplicado !== undefined &&
            fila.costoUnitarioAplicado !== null &&
            String(fila.costoUnitarioAplicado).trim() !== ''
          ) {
            costoHoja = Number(fila.costoUnitarioAplicado);
          } else if (enHoja) {
            costoHoja = enHoja.costoUnitario;
          }
          if (costoHoja !== undefined && costoHoja !== enCat.costoUnitario) {
            agregarAdvertencia(
              'Asignaciones',
              numFila,
              'costoUnitarioAplicado',
              `El costo unitario indicado para '${recNom}' ($${costoHoja}) difiere de la del catálogo ($${enCat.costoUnitario}).`,
            );
          }
        }

        if (
          fila.cantidadPlan !== undefined &&
          fila.cantidadPlan !== null &&
          String(fila.cantidadPlan).trim() !== ''
        ) {
          const cant = Number(fila.cantidadPlan);
          if (isNaN(cant) || cant <= 0) {
            agregarError(
              'Asignaciones',
              numFila,
              'cantidadPlan',
              'La cantidad planificada debe ser un número positivo.',
            );
            registrarFilaInvalida('Asignaciones', numFila);
          }
        }
      }
    }
  }

  if (!hojasConFallaEstructural.has('Hitos')) {
    const hitosFilas = filasFiltradasPorHoja.get('Hitos') ?? [];
    for (const { fila, numFila } of hitosFilas) {
      const nom = String(fila.nombre ?? '').trim();
      if (!nom) {
        agregarError('Hitos', numFila, 'nombre', 'Ingrese el nombre del hito.');
        registrarFilaInvalida('Hitos', numFila);
      } else if (nom.length > 120) {
        agregarError('Hitos', numFila, 'nombre', 'El nombre supera el máximo de 120 caracteres.');
        registrarFilaInvalida('Hitos', numFila);
      }

      const fObj = normalizarFechaCelda(fila.fechaObjetivo);
      if (!fObj) {
        agregarError(
          'Hitos',
          numFila,
          'fechaObjetivo',
          'La fecha objetivo debe tener formato AAAA-MM-DD.',
        );
        registrarFilaInvalida('Hitos', numFila);
      }

      if (fila.tarea !== undefined && fila.tarea !== null && String(fila.tarea).trim() !== '') {
        const codTarea = codigoDesdeCelda(fila.tarea);
        if (!tareasPorCodigo.has(codTarea)) {
          agregarError('Hitos', numFila, 'tarea', `La tarea vinculada ${codTarea} no existe.`);
          registrarFilaInvalida('Hitos', numFila);
        }
      }

      if (
        fila.fechaCumplimiento !== undefined &&
        fila.fechaCumplimiento !== null &&
        String(fila.fechaCumplimiento).trim() !== ''
      ) {
        const fCum = normalizarFechaCelda(fila.fechaCumplimiento);
        if (!fCum) {
          agregarError(
            'Hitos',
            numFila,
            'fechaCumplimiento',
            'La fecha de cumplimiento debe tener formato AAAA-MM-DD.',
          );
          registrarFilaInvalida('Hitos', numFila);
        }
      }
    }
  }

  const kpisExistentesCodigos = new Set((catalogo.kpis ?? []).map((k) => k.codigo.toLowerCase()));
  if (!hojasConFallaEstructural.has('KPI')) {
    const kpiFilas = filasFiltradasPorHoja.get('KPI') ?? [];
    const codigosKpiVistos = new Map<string, number>();
    const kpisOmitidos: string[] = [];

    for (const { fila, numFila } of kpiFilas) {
      const codigo = String(fila.codigo ?? '').trim();
      if (!codigo) {
        agregarError('KPI', numFila, 'codigo', 'Ingrese el código del KPI.');
        registrarFilaInvalida('KPI', numFila);
      } else if (codigo.length > 40) {
        agregarError('KPI', numFila, 'codigo', 'El código supera el máximo de 40 caracteres.');
        registrarFilaInvalida('KPI', numFila);
      } else {
        const cLower = codigo.toLowerCase();
        const filaPrevia = codigosKpiVistos.get(cLower);
        if (filaPrevia !== undefined) {
          agregarError(
            'KPI',
            numFila,
            'codigo',
            `El código de KPI '${codigo}' ya fue registrado en la fila ${filaPrevia}.`,
          );
          registrarFilaInvalida('KPI', numFila);
        } else {
          codigosKpiVistos.set(cLower, numFila);
          if (kpisExistentesCodigos.has(cLower)) {
            kpisOmitidos.push(codigo);
            continue;
          }
        }
      }

      const nom =
        fila.nombre !== undefined && fila.nombre !== null ? String(fila.nombre).trim() : '';
      const formula =
        fila.formula !== undefined && fila.formula !== null ? String(fila.formula).trim() : '';
      const parseoKpi = esquemaCrearKpi.safeParse({
        codigo,
        nombre: nom,
        descripcion: fila.descripcion ? String(fila.descripcion).trim() : null,
        ambito: fila.ambito ? String(fila.ambito).trim().toUpperCase() : undefined,
        formula,
        unidad: fila.unidad ? String(fila.unidad).trim().toUpperCase() : undefined,
        meta:
          fila.meta !== undefined && fila.meta !== null && String(fila.meta).trim() !== ''
            ? Number(fila.meta)
            : null,
        direccion: fila.direccion ? String(fila.direccion).trim().toUpperCase() : undefined,
      });

      if (!parseoKpi.success) {
        for (const issue of parseoKpi.error.issues) {
          const colName = String(issue.path[0] ?? 'codigo');
          agregarError('KPI', numFila, colName, issue.message);
          registrarFilaInvalida('KPI', numFila);
        }
      } else {
        const codigosValidos = codigosVariablesPorAmbito(parseoKpi.data.ambito);
        const analisis = analizarFormula(parseoKpi.data.formula, codigosValidos);
        if (!analisis.valida) {
          const msg = analisis.errores[0]?.mensaje ?? 'La fórmula de cálculo no es válida.';
          agregarError('KPI', numFila, 'formula', msg);
          registrarFilaInvalida('KPI', numFila);
        }
      }
    }

    if (kpisOmitidos.length > 0) {
      agregarAdvertencia(
        'KPI',
        1,
        'codigo',
        `${kpisOmitidos.length} KPI ya existen en el catálogo y se omitirán: ${kpisOmitidos.join(', ')}.`,
      );
    }
  }

  if (!hojasConFallaEstructural.has('Solicitudes')) {
    const solFilas = filasFiltradasPorHoja.get('Solicitudes') ?? [];
    for (const { fila, numFila } of solFilas) {
      const tit = String(fila.titulo ?? '').trim();
      if (!tit) {
        agregarError('Solicitudes', numFila, 'titulo', 'Ingrese el título de la solicitud.');
        registrarFilaInvalida('Solicitudes', numFila);
      } else if (tit.length > 120) {
        agregarError(
          'Solicitudes',
          numFila,
          'titulo',
          'El título supera el máximo de 120 caracteres.',
        );
        registrarFilaInvalida('Solicitudes', numFila);
      }

      const desc = String(fila.descripcion ?? '').trim();
      if (!desc) {
        agregarError(
          'Solicitudes',
          numFila,
          'descripcion',
          'Ingrese la descripción de la solicitud.',
        );
        registrarFilaInvalida('Solicitudes', numFila);
      } else if (desc.length > 2000) {
        agregarError(
          'Solicitudes',
          numFila,
          'descripcion',
          'La descripción supera el máximo de 2000 caracteres.',
        );
        registrarFilaInvalida('Solicitudes', numFila);
      }

      const just = String(fila.justificacion ?? '').trim();
      if (!just) {
        agregarError(
          'Solicitudes',
          numFila,
          'justificacion',
          'Ingrese la justificación de la solicitud.',
        );
        registrarFilaInvalida('Solicitudes', numFila);
      } else if (just.length > 2000) {
        agregarError(
          'Solicitudes',
          numFila,
          'justificacion',
          'La justificación supera el máximo de 2000 caracteres.',
        );
        registrarFilaInvalida('Solicitudes', numFila);
      }

      const sol = String(fila.solicitante ?? '').trim();
      if (!sol) {
        agregarError(
          'Solicitudes',
          numFila,
          'solicitante',
          'Ingrese el solicitante de la solicitud.',
        );
        registrarFilaInvalida('Solicitudes', numFila);
      } else if (sol.length > 120) {
        agregarError(
          'Solicitudes',
          numFila,
          'solicitante',
          'El solicitante supera el máximo de 120 caracteres.',
        );
        registrarFilaInvalida('Solicitudes', numFila);
      }

      const resp = String(fila.responsable ?? '').trim();
      if (!resp) {
        agregarError(
          'Solicitudes',
          numFila,
          'responsable',
          'Ingrese el responsable de la solicitud.',
        );
        registrarFilaInvalida('Solicitudes', numFila);
      } else if (resp.length > 120) {
        agregarError(
          'Solicitudes',
          numFila,
          'responsable',
          'El responsable supera el máximo de 120 caracteres.',
        );
        registrarFilaInvalida('Solicitudes', numFila);
      }

      const prioridad = String(fila.prioridad ?? '')
        .trim()
        .toUpperCase();
      if (!PRIORIDADES_SOLICITUD.includes(prioridad as PrioridadSolicitud)) {
        agregarError(
          'Solicitudes',
          numFila,
          'prioridad',
          `La prioridad '${fila.prioridad}' es inválida. Valores permitidos: BAJA, MEDIA, ALTA, CRITICA.`,
        );
        registrarFilaInvalida('Solicitudes', numFila);
      }

      const cat = String(fila.categoria ?? '')
        .trim()
        .toUpperCase();
      if (!CATEGORIAS_CAMBIO.includes(cat as CategoriaCambio)) {
        agregarError(
          'Solicitudes',
          numFila,
          'categoria',
          `La categoría '${fila.categoria}' es inválida. Valores permitidos: ALCANCE, PLAZO, COSTO, RECURSO, CALIDAD.`,
        );
        registrarFilaInvalida('Solicitudes', numFila);
      }

      const prob = Number(fila.probabilidadRiesgo);
      if (
        fila.probabilidadRiesgo === undefined ||
        fila.probabilidadRiesgo === null ||
        String(fila.probabilidadRiesgo).trim() === '' ||
        isNaN(prob) ||
        !Number.isInteger(prob) ||
        prob < 1 ||
        prob > 5
      ) {
        agregarError(
          'Solicitudes',
          numFila,
          'probabilidadRiesgo',
          'La probabilidad de riesgo debe ser un número entero entre 1 y 5.',
        );
        registrarFilaInvalida('Solicitudes', numFila);
      }

      const imp = Number(fila.impactoRiesgo);
      if (
        fila.impactoRiesgo === undefined ||
        fila.impactoRiesgo === null ||
        String(fila.impactoRiesgo).trim() === '' ||
        isNaN(imp) ||
        !Number.isInteger(imp) ||
        imp < 1 ||
        imp > 5
      ) {
        agregarError(
          'Solicitudes',
          numFila,
          'impactoRiesgo',
          'El impacto de riesgo debe ser un número entero entre 1 y 5.',
        );
        registrarFilaInvalida('Solicitudes', numFila);
      }

      if (fila.estado !== undefined && fila.estado !== null && String(fila.estado).trim() !== '') {
        const estStr = String(fila.estado).trim().toUpperCase();
        if (estStr !== 'REGISTRADA') {
          agregarAdvertencia(
            'Solicitudes',
            numFila,
            'estado',
            `La solicitud con título '${tit || 'sin título'}' tiene estado '${fila.estado}'; se importará como REGISTRADA.`,
          );
        }
      }
    }
  }

  const resumenHojas: ResumenHojaValidacion[] = hojasValidadas.map((h) => {
    const filtradas = filasFiltradasPorHoja.get(h) ?? [];
    const numFilas = filtradas.length;
    const invalidas = filasInvalidasPorHoja.get(h)?.size ?? 0;
    const validas = Math.max(0, numFilas - invalidas);
    return {
      hoja: h,
      filas: numFilas,
      validas,
      invalidas,
    };
  });

  return {
    valido: errores.length === 0,
    hojas: resumenHojas,
    errores,
    advertencias,
    truncado,
  };
}
