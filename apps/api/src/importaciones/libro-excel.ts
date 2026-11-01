import { HttpStatus } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import {
  COLUMNAS_POR_HOJA,
  HOJAS_CARGA,
  type HojaCarga,
  type LibroCarga,
  type FilaCarga,
} from '@autofix/core';
import { ExcepcionApi } from '../comun/errores/excepcion-api';

const FIRMA_ZIP = [0x50, 0x4b, 0x03, 0x04];
const MAX_FILAS_DATOS = 2000;

export function esXlsx(nombre: string, contenido: Buffer): boolean {
  return (
    typeof nombre === 'string' &&
    nombre.toLowerCase().endsWith('.xlsx') &&
    contenido &&
    contenido.length >= 4 &&
    FIRMA_ZIP.every((b, i) => contenido[i] === b)
  );
}

export interface FilaExportacionTarea {
  codigo: string;
  nivel: string;
  nombre: string;
  duracionDias: number;
  descripcion?: string | null;
  responsable?: string | null;
  fechaFija?: string | null;
  porcentajeAvance?: number | null;
  inicioReal?: string | null;
  finReal?: string | null;
  inicioPlan?: string | null;
  finPlan?: string | null;
  holguraDias?: number | null;
  esCritica?: boolean | null;
  costoPlan?: number | null;
}

export interface FilaExportacionDependencia {
  predecesora: string;
  sucesora: string;
  tipo: string;
  desfaseDias: number;
}

export interface FilaExportacionProfesional {
  nombre: string;
  cargo: string;
  tarifaHora: number;
  horasDiarias?: number | null;
}

export interface FilaExportacionRecurso {
  nombre: string;
  tipo: string;
  unidad: string;
  costoUnitario: number;
}

export interface FilaExportacionAsignacion {
  tarea: string;
  profesional?: string | null;
  recurso?: string | null;
  dedicacion?: number | null;
  horasPlan?: number | null;
  horasPlanManual?: boolean;
  horasReales?: number | null;
  cantidadPlan?: number | null;
  cantidadReal?: number | null;
  tarifaAplicada?: number | null;
  costoUnitarioAplicado?: number | null;
}

export interface FilaExportacionHito {
  nombre: string;
  fechaObjetivo: string;
  tarea?: string | null;
  criterio?: string | null;
  responsable?: string | null;
  fechaCumplimiento?: string | null;
}

export interface FilaExportacionKpi {
  codigo: string;
  nombre: string;
  ambito: string;
  formula: string;
  unidad: string;
  meta?: number | null;
  direccion: string;
}

export interface FilaExportacionSolicitud {
  codigo?: string | null;
  titulo: string;
  descripcion: string;
  justificacion: string;
  solicitante: string;
  responsable: string;
  prioridad: string;
  categoria: string;
  probabilidadRiesgo: number;
  impactoRiesgo: number;
  estado?: string | null;
  etapaActual?: number | null;
}

export interface DatosExportacion {
  proyecto: {
    nombre: string;
    descripcion?: string | null;
    responsable: string;
    presupuesto: number;
    fechaInicio: string;
    fechaFin?: string | null;
  };
  calendario: {
    diasLaborables: string;
    horasPorDia: number;
  };
  feriados: Array<{ fecha: string; descripcion: string }>;
  tareas: FilaExportacionTarea[];
  dependencias: FilaExportacionDependencia[];
  profesionales: FilaExportacionProfesional[];
  recursos: FilaExportacionRecurso[];
  asignaciones: FilaExportacionAsignacion[];
  hitos: FilaExportacionHito[];
  kpis: FilaExportacionKpi[];
  solicitudes: FilaExportacionSolicitud[];
}

function aplicarValidacionesYEstilo(hoja: HojaCarga, ws: ExcelJS.Worksheet): void {
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  const cols = COLUMNAS_POR_HOJA[hoja] ?? [];
  const fila1 = ws.getRow(1);
  fila1.height = 28;

  for (let i = 0; i < cols.length; i += 1) {
    const colDef = cols[i]!;
    const colIdx = i + 1;
    const celda = fila1.getCell(colIdx);
    celda.value = colDef.nombre;
    celda.note = colDef.nota;
    celda.font = {
      bold: true,
      color: { argb: 'FFFFFFFF' },
      size: 10,
      name: 'Segoe UI',
    };
    celda.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: colDef.calculada ? 'FF64748B' : 'FF1E293B' },
    };
    celda.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true,
    };

    const ancho = Math.max(16, colDef.nombre.length + 4);
    ws.getColumn(colIdx).width = ancho;

    const esColCodigo =
      colDef.clave === 'codigo' ||
      colDef.clave === 'predecesora' ||
      colDef.clave === 'sucesora' ||
      colDef.clave === 'tarea';

    if (esColCodigo) {
      ws.getColumn(colIdx).numFmt = '@';
    }

    if (colDef.lista && colDef.lista.length > 0) {
      const formulaLista = `"${colDef.lista.join(',')}"`;
      const wsConValidaciones = ws as unknown as {
        dataValidations?: { add: (rango: string, validacion: unknown) => void };
      };
      if (wsConValidaciones.dataValidations?.add) {
        wsConValidaciones.dataValidations.add(`${colDef.letra}2:${colDef.letra}2001`, {
          type: 'list',
          allowBlank: true,
          formulae: [formulaLista],
        });
      }
    }
  }
}

function agregarHojaInstrucciones(wb: ExcelJS.Workbook): void {
  const ws = wb.addWorksheet('Instrucciones');
  ws.getColumn(1).width = 24;
  ws.getColumn(2).width = 90;

  ws.mergeCells('A1:B1');
  const titulo = ws.getCell('A1');
  titulo.value = 'INSTRUCCIONES DE USO - PLANTILLA DE CARGA INICIAL AUTOFIX';
  titulo.font = { bold: true, size: 14, color: { argb: 'FF1E293B' }, name: 'Segoe UI' };
  titulo.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(1).height = 36;

  const filasInstrucciones: Array<[string, string]> = [
    [
      'Generalidades',
      'Esta plantilla permite importar y exportar datos completos de un proyecto en Autofix. Conserve el nombre y orden de las 12 hojas.',
    ],
    [
      'Campos obligatorios',
      'Las columnas marcadas con un asterisco (*) son obligatorias en cada fila utilizada.',
    ],
    [
      'Estructura de tareas',
      'Los códigos de tareas deben seguir numeración jerárquica con enteros: 1, 1.1, 1.1.1, etc. Nivel 1 = ETAPA, Nivel 2 = ACTIVIDAD, Nivel 3 = SUBACTIVIDAD. Los códigos deben ser consecutivos dentro de su nivel.',
    ],
    [
      'Formato de texto',
      'Las columnas de código (código, predecesora, sucesora, tarea) deben mantenerse con formato de texto para evitar pérdida de decimales (ej. 1.10).',
    ],
    [
      'Fechas',
      'Las fechas deben registrarse en formato ISO AAAA-MM-DD (ejemplo: 2026-11-01) o como celdas con formato de fecha en Excel.',
    ],
    [
      'Listas desplegables',
      'Las columnas con valores predefinidos (nivel, tipo de dependencia, tipo de recurso, ámbito, prioridad, categoría, etc.) incluyen listas desplegables con las opciones permitidas.',
    ],
    [
      'Columnas calculadas',
      'Las columnas marcadas con (calculado) o (referencia) son generadas automáticamente por Autofix y se ignoran durante la importación.',
    ],
    ['Límite de filas', 'Cada hoja admite un máximo de 2000 filas de datos.'],
  ];

  for (let i = 0; i < filasInstrucciones.length; i += 1) {
    const [seccion, desc] = filasInstrucciones[i]!;
    const numFila = i + 3;
    const r = ws.getRow(numFila);
    r.height = 28;
    const c1 = r.getCell(1);
    c1.value = seccion;
    c1.font = { bold: true, size: 10, name: 'Segoe UI', color: { argb: 'FF334155' } };
    c1.alignment = { vertical: 'top', horizontal: 'left' };

    const c2 = r.getCell(2);
    c2.value = desc;
    c2.font = { size: 10, name: 'Segoe UI' };
    c2.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
  }
}

export async function generarPlantilla(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Autofix';
  wb.created = new Date();

  agregarHojaInstrucciones(wb);

  for (const hoja of HOJAS_CARGA) {
    if (hoja === 'Instrucciones') continue;
    const ws = wb.addWorksheet(hoja);
    aplicarValidacionesYEstilo(hoja, ws);
  }

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

function extraerTextoCelda(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'string') return valor;
  if (typeof valor === 'number' || typeof valor === 'boolean') return String(valor);
  if (typeof valor === 'object') {
    if ('richText' in valor && Array.isArray((valor as { richText: unknown[] }).richText)) {
      return (valor as { richText: Array<{ text?: string }> }).richText
        .map((t) => t.text ?? '')
        .join('');
    }
    if ('result' in valor) {
      return extraerTextoCelda((valor as { result: unknown }).result);
    }
    if ('text' in valor) {
      return String((valor as { text: unknown }).text);
    }
  }
  return String(valor);
}

function extraerValorCelda(valor: unknown): unknown {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'object') {
    if ('richText' in valor && Array.isArray((valor as { richText: unknown[] }).richText)) {
      return (valor as { richText: Array<{ text?: string }> }).richText
        .map((t) => t.text ?? '')
        .join('');
    }
    if ('result' in valor) {
      return extraerValorCelda((valor as { result: unknown }).result);
    }
    if ('text' in valor) {
      return (valor as { text: unknown }).text;
    }
  }
  if (valor instanceof Date) {
    if (isNaN(valor.getTime())) return null;
    return valor.toISOString().slice(0, 10);
  }
  return valor;
}

export interface ResultadoLecturaLibro {
  libro: LibroCarga;
  ordenHojas: string[];
  encabezadosPorHoja: Record<string, string[]>;
}

export async function leerLibro(buffer: Buffer): Promise<ResultadoLecturaLibro> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);

  for (const ws of wb.worksheets) {
    if (ws.name === 'Instrucciones') continue;
    let filasConDatos = 0;
    for (let r = 2; r <= ws.rowCount; r += 1) {
      const fila = ws.getRow(r);
      if (fila && fila.cellCount > 0) {
        let tieneDato = false;
        fila.eachCell({ includeEmpty: false }, (celda) => {
          const v = celda.value;
          if (v !== null && v !== undefined && String(v).trim() !== '') {
            tieneDato = true;
          }
        });
        if (tieneDato) filasConDatos += 1;
      }
    }
    if (filasConDatos > MAX_FILAS_DATOS) {
      throw new ExcepcionApi(
        HttpStatus.PAYLOAD_TOO_LARGE,
        'CONTENIDO_DEMASIADO_GRANDE',
        `La hoja '${ws.name}' supera el límite permitido de ${MAX_FILAS_DATOS} filas.`,
      );
    }
  }

  const ordenHojas = wb.worksheets.map((w) => w.name);
  const encabezadosPorHoja: Record<string, string[]> = {};
  const libro: LibroCarga = {};

  for (const hoja of HOJAS_CARGA) {
    if (hoja === 'Instrucciones') continue;

    const ws =
      wb.getWorksheet(hoja) ??
      wb.worksheets.find((w) => w.name.trim().toLowerCase() === hoja.toLowerCase());

    if (!ws) {
      libro[hoja] = [];
      continue;
    }

    const colsDef = COLUMNAS_POR_HOJA[hoja] ?? [];
    const mapaColAClave = new Map<number, string>();
    const encabezados: string[] = [];
    const fila1 = ws.getRow(1);

    fila1.eachCell({ includeEmpty: false }, (celda, colNumber) => {
      const raw = extraerTextoCelda(celda.value).trim();
      if (raw) encabezados.push(raw);

      const norm = raw
        .replace(/\*/g, '')
        .replace(/\(calculado\)/g, '')
        .replace(/\(referencia\)/g, '')
        .trim()
        .toLowerCase();

      const def =
        colsDef.find((c) => c.clave.toLowerCase() === norm) ||
        colsDef.find((c) => c.nombre.replace(/\*/g, '').trim().toLowerCase() === norm);

      if (def) {
        mapaColAClave.set(colNumber, def.clave);
      } else {
        const letra = celda.address.replace(/\d+/g, '').toUpperCase();
        const defPorLetra = colsDef.find((c) => c.letra === letra);
        if (defPorLetra) {
          mapaColAClave.set(colNumber, defPorLetra.clave);
        }
      }
    });

    encabezadosPorHoja[hoja] = encabezados;

    const filas: FilaCarga[] = [];
    for (let r = 2; r <= ws.rowCount; r += 1) {
      const fila = ws.getRow(r);
      if (!fila || fila.cellCount === 0) continue;

      const obj: FilaCarga = { _fila: r };
      let tieneDato = false;

      fila.eachCell({ includeEmpty: false }, (celda, colNumber) => {
        const clave = mapaColAClave.get(colNumber);
        if (clave) {
          const val = extraerValorCelda(celda.value);
          if (val !== undefined && val !== null && val !== '') {
            obj[clave] = val;
            tieneDato = true;
          }
        }
      });

      if (tieneDato) {
        filas.push(obj);
      }
    }

    libro[hoja] = filas;
  }

  return { libro, ordenHojas, encabezadosPorHoja };
}

export async function generarExportacion(datos: DatosExportacion): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Autofix';
  wb.created = new Date();

  agregarHojaInstrucciones(wb);

  for (const hoja of HOJAS_CARGA) {
    if (hoja === 'Instrucciones') continue;
    const ws = wb.addWorksheet(hoja);
    aplicarValidacionesYEstilo(hoja, ws);

    const colsDef = COLUMNAS_POR_HOJA[hoja] ?? [];

    const agregarFilas = (filas: Array<Record<string, unknown>>) => {
      for (const f of filas) {
        const valoresFila: unknown[] = [];
        for (const c of colsDef) {
          const val = f[c.clave];
          valoresFila.push(val !== undefined && val !== null ? val : '');
        }
        const nuevaFila = ws.addRow(valoresFila);
        for (let i = 0; i < colsDef.length; i += 1) {
          const c = colsDef[i]!;
          if (
            c.clave === 'codigo' ||
            c.clave === 'predecesora' ||
            c.clave === 'sucesora' ||
            c.clave === 'tarea'
          ) {
            nuevaFila.getCell(i + 1).numFmt = '@';
          }
        }
      }
    };

    if (hoja === 'Proyecto') {
      agregarFilas([datos.proyecto as unknown as Record<string, unknown>]);
    } else if (hoja === 'Calendario') {
      agregarFilas([datos.calendario as unknown as Record<string, unknown>]);
    } else if (hoja === 'Feriados') {
      agregarFilas(datos.feriados as unknown as Array<Record<string, unknown>>);
    } else if (hoja === 'Tareas') {
      const tareasOrdenadas = [...datos.tareas].sort((a, b) =>
        a.codigo.localeCompare(b.codigo, 'es', { numeric: true }),
      );
      agregarFilas(tareasOrdenadas as unknown as Array<Record<string, unknown>>);
    } else if (hoja === 'Dependencias') {
      agregarFilas(datos.dependencias as unknown as Array<Record<string, unknown>>);
    } else if (hoja === 'Profesionales') {
      agregarFilas(datos.profesionales as unknown as Array<Record<string, unknown>>);
    } else if (hoja === 'Recursos') {
      agregarFilas(datos.recursos as unknown as Array<Record<string, unknown>>);
    } else if (hoja === 'Asignaciones') {
      const asignacionesParaExportar = datos.asignaciones.map((a) => ({
        ...a,
        horasPlan: a.horasPlanManual ? a.horasPlan : null,
      }));
      agregarFilas(asignacionesParaExportar as unknown as Array<Record<string, unknown>>);
    } else if (hoja === 'Hitos') {
      agregarFilas(datos.hitos as unknown as Array<Record<string, unknown>>);
    } else if (hoja === 'KPI') {
      agregarFilas(datos.kpis as unknown as Array<Record<string, unknown>>);
    } else if (hoja === 'Solicitudes') {
      agregarFilas(datos.solicitudes as unknown as Array<Record<string, unknown>>);
    }
  }

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
