import { describe, expect, it } from 'vitest';
import {
  HOJAS_CARGA,
  normalizarFechaCelda,
  codigoDesdeCelda,
  REGEX_CODIGO,
  encontrarCiclos,
  validarLibro,
  type LibroCarga,
} from './plantillaCarga';

const libroMinimoValido = (): LibroCarga => ({
  Proyecto: [
    {
      nombre: 'Proyecto Taller Central',
      descripcion: 'Modernización del taller',
      responsable: 'Carlos Morales',
      presupuesto: 50000000,
      fechaInicio: '2026-11-02',
      fechaFin: '2026-12-31',
    },
  ],
  Calendario: [
    {
      diasLaborables: '1,2,3,4,5',
      horasPorDia: 8,
    },
  ],
  Feriados: [
    {
      fecha: '2026-11-01',
      descripcion: 'Día de Todos los Santos',
    },
  ],
  Tareas: [
    {
      codigo: '1',
      nivel: 'ETAPA',
      nombre: 'Etapa Diagnóstico',
      duracionDias: 10,
    },
    {
      codigo: '1.1',
      nivel: 'ACTIVIDAD',
      nombre: 'Actividad Revisión',
      duracionDias: 5,
    },
    {
      codigo: '1.1.1',
      nivel: 'SUBACTIVIDAD',
      nombre: 'Subactividad Frenos',
      duracionDias: 3,
    },
    {
      codigo: '1.1.2',
      nivel: 'SUBACTIVIDAD',
      nombre: 'Subactividad Motor',
      duracionDias: 2,
    },
  ],
  Dependencias: [
    {
      predecesora: '1.1.1',
      sucesora: '1.1.2',
      tipo: 'FS',
      desfaseDias: 0,
    },
  ],
  Profesionales: [
    {
      nombre: 'Ana Pérez',
      cargo: 'Mecánico Jefe',
      tarifaHora: 25000,
      horasDiarias: 8,
    },
  ],
  Recursos: [
    {
      nombre: 'Elevador Hidráulico',
      tipo: 'Equipamiento',
      unidad: 'hora',
      costoUnitario: 15000,
    },
  ],
  Asignaciones: [
    {
      tarea: '1.1.1',
      profesional: 'Ana Pérez',
      dedicacion: 100,
    },
    {
      tarea: '1.1.2',
      recurso: 'Elevador Hidráulico',
      cantidadPlan: 10,
    },
  ],
  Hitos: [
    {
      nombre: 'Hito Revisión Finalizada',
      fechaObjetivo: '2026-11-20',
      tarea: '1.1.2',
    },
  ],
  KPI: [
    {
      codigo: 'KPI-01',
      nombre: 'Avance de Diagnóstico',
      ambito: 'PROYECTO',
      formula: 'AVANCE_REAL',
      unidad: 'PORCENTAJE',
      meta: 100,
      direccion: 'MAYOR_MEJOR',
    },
  ],
  Solicitudes: [
    {
      codigo: 'SC-001',
      titulo: 'Cambio de repuestos',
      descripcion: 'Actualizar especificación',
      justificacion: 'Falla recurrente',
      solicitante: 'Juan Chofer',
      responsable: 'Carlos Morales',
      prioridad: 'MEDIA',
      categoria: 'PLAZO',
      probabilidadRiesgo: 2,
      impactoRiesgo: 3,
      estado: 'REGISTRADA',
    },
  ],
});

describe('A1: plantilla de carga inicial (validación entre hojas)', () => {
  it('libro mínimo válido pasa con cero errores', () => {
    const libro = libroMinimoValido();
    const resultado = validarLibro(libro);
    expect(resultado.valido).toBe(true);
    expect(resultado.errores).toHaveLength(0);
    expect(resultado.truncado).toBe(false);
  });

  it('HOJAS_CARGA contiene las 12 hojas en orden oficial', () => {
    expect(HOJAS_CARGA).toEqual([
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
    ]);
  });

  it('H1 y D5: códigos jerárquicos y numeración consecutiva', () => {
    const libro = libroMinimoValido();
    libro.Tareas = [
      { codigo: '1', nivel: 'ETAPA', nombre: 'Etapa 1', duracionDias: 1 },
      { codigo: '1.1', nivel: 'ACTIVIDAD', nombre: 'Act 1.1', duracionDias: 1 },
      { codigo: '2', nivel: 'ETAPA', nombre: 'Etapa 2', duracionDias: 1 },
      { codigo: '2.1', nivel: 'ACTIVIDAD', nombre: 'Act 2.1', duracionDias: 1 },
    ];
    libro.Dependencias = [];
    libro.Asignaciones = [];
    libro.Hitos = [];
    const r = validarLibro(libro);
    expect(r.valido).toBe(true);
    expect(r.errores).toHaveLength(0);
  });

  it('H2 y caso borde 4: rechaza códigos tecleados como números no enteros', () => {
    expect(REGEX_CODIGO.test('1')).toBe(true);
    expect(REGEX_CODIGO.test('1.2')).toBe(true);
    expect(REGEX_CODIGO.test('1.2.3')).toBe(true);
    expect(REGEX_CODIGO.test('01.2')).toBe(false);
    expect(REGEX_CODIGO.test('1.2.3.4')).toBe(false);
    expect(REGEX_CODIGO.test('1.2.')).toBe(false);

    const libro = libroMinimoValido();
    libro.Tareas[0].codigo = 1.1;
    const r = validarLibro(libro);
    expect(r.valido).toBe(false);
    expect(r.errores.some((e) => e.celda.startsWith('Tareas!') && e.columna === 'codigo')).toBe(
      true,
    );
  });

  it('H5 y caso borde 8: dependencias y asignaciones solo admiten tareas hoja', () => {
    const libro = libroMinimoValido();
    libro.Dependencias = [
      {
        predecesora: '1',
        sucesora: '1.1.1',
        tipo: 'FS',
      },
    ];
    const r = validarLibro(libro);
    expect(r.valido).toBe(false);
    expect(
      r.errores.some(
        (e) => e.hoja === 'Dependencias' && e.mensaje.includes('no es una tarea hoja'),
      ),
    ).toBe(true);
  });

  it('H6: Tarjan iterativo marca ciclo de 999 tareas en menos de 500 ms sin desbordar pila', () => {
    const n = 999;
    const nodos = Array.from({ length: n }, (_, i) => `T${i + 1}`);
    const aristas: [string, string][] = [];
    for (let i = 0; i < n - 1; i += 1) {
      aristas.push([nodos[i], nodos[i + 1]]);
    }
    aristas.push([nodos[n - 1], nodos[0]]);

    const t0 = performance.now();
    const ciclos = encontrarCiclos(nodos, aristas);
    const duracion = performance.now() - t0;

    expect(duracion).toBeLessThan(500);
    expect(ciclos).toHaveLength(1);
    expect(ciclos[0]).toHaveLength(n);
  });

  it('caso borde 2: error estructural por falta de columna omite validar filas de esa hoja', () => {
    const libro = libroMinimoValido();
    const r = validarLibro(libro, {
      encabezadosPorHoja: {
        Tareas: ['nivel*', 'nombre*', 'duracionDias*'],
      },
    });
    expect(r.valido).toBe(false);
    expect(
      r.errores.some(
        (e) => e.celda === 'Tareas!A1' && e.mensaje.includes('falta la columna codigo*'),
      ),
    ).toBe(true);
  });

  it('caso borde 3: filas totalmente vacías se omiten sin error', () => {
    const libro = libroMinimoValido();
    libro.Tareas.push({ codigo: '', nombre: null, duracionDias: undefined });
    libro.Feriados.push({ fecha: '', descripcion: '   ' });
    const r = validarLibro(libro);
    expect(r.valido).toBe(true);
    expect(r.errores).toHaveLength(0);
  });

  it('caso borde 5: código repetido da error citando la primera fila', () => {
    const libro = libroMinimoValido();
    libro.Tareas.push({
      _fila: 10,
      codigo: '1.1.1',
      nivel: 'SUBACTIVIDAD',
      nombre: 'Repetida',
      duracionDias: 2,
    });
    const r = validarLibro(libro);
    expect(r.valido).toBe(false);
    expect(
      r.errores.some(
        (e) => e.celda === 'Tareas!A10' && e.mensaje.includes('ya fue definido en la fila 4'),
      ),
    ).toBe(true);
  });

  it('caso borde 6: hueco en la numeración reporta código no consecutivo y valor esperado', () => {
    const libro = libroMinimoValido();
    libro.Tareas = [
      { codigo: '1', nivel: 'ETAPA', nombre: 'E1', duracionDias: 1 },
      { _fila: 3, codigo: '1.1', nivel: 'ACTIVIDAD', nombre: 'A1.1', duracionDias: 1 },
      { _fila: 4, codigo: '1.3', nivel: 'ACTIVIDAD', nombre: 'A1.3', duracionDias: 1 },
    ];
    libro.Dependencias = [];
    libro.Asignaciones = [];
    libro.Hitos = [];
    const r = validarLibro(libro);
    expect(r.valido).toBe(false);
    expect(
      r.errores.some(
        (e) =>
          e.celda === 'Tareas!A4' &&
          e.mensaje.includes('el código 1.3 no es consecutivo; se esperaba 1.2'),
      ),
    ).toBe(true);
  });

  it('caso borde 7: padre inexistente y nivel que no coincide con profundidad', () => {
    const libro = libroMinimoValido();
    libro.Tareas = [
      { _fila: 2, codigo: '2.1', nivel: 'ETAPA', nombre: 'Invalida', duracionDias: 1 },
    ];
    libro.Dependencias = [];
    libro.Asignaciones = [];
    libro.Hitos = [];
    const r = validarLibro(libro);
    expect(r.valido).toBe(false);
    expect(
      r.errores.some((e) => e.mensaje.includes('El padre 2 no existe para el código 2.1')),
    ).toBe(true);
    expect(
      r.errores.some((e) => e.mensaje.includes('El nivel ETAPA no coincide con la profundidad')),
    ).toBe(true);
  });

  it('caso borde 8: dependencia a sí misma, a tarea inexistente y repetida', () => {
    const libro = libroMinimoValido();
    libro.Dependencias = [
      { _fila: 2, predecesora: '1.1.1', sucesora: '1.1.1', tipo: 'FS' },
      { _fila: 3, predecesora: '1.1.1', sucesora: '9.9.9', tipo: 'FS' },
      { _fila: 4, predecesora: '1.1.1', sucesora: '1.1.2', tipo: 'FS' },
      { _fila: 5, predecesora: '1.1.1', sucesora: '1.1.2', tipo: 'SS' },
    ];
    const r = validarLibro(libro);
    expect(r.valido).toBe(false);
    expect(r.errores.some((e) => e.mensaje.includes('no puede depender de sí misma'))).toBe(true);
    expect(r.errores.some((e) => e.mensaje.includes('sucesora 9.9.9 no existe'))).toBe(true);
    expect(r.errores.some((e) => e.mensaje.includes('ya fue definida en la fila 4'))).toBe(true);
  });

  it('caso borde 9: ciclo detectado con SS o FF marca error con las tareas del ciclo', () => {
    const libro = libroMinimoValido();
    libro.Dependencias = [
      { _fila: 2, predecesora: '1.1.1', sucesora: '1.1.2', tipo: 'SS' },
      { _fila: 3, predecesora: '1.1.2', sucesora: '1.1.1', tipo: 'FF' },
    ];
    const r = validarLibro(libro);
    expect(r.valido).toBe(false);
    expect(
      r.errores.some(
        (e) => e.hoja === 'Dependencias' && e.mensaje.includes('Ciclo detectado en las tareas'),
      ),
    ).toBe(true);
  });

  it('caso borde 10: profesional o recurso duplicado por claveNombre', () => {
    const libro = libroMinimoValido();
    libro.Profesionales.push({
      _fila: 5,
      nombre: 'ANA  perez',
      cargo: 'Ayudante',
      tarifaHora: 15000,
    });
    libro.Recursos.push({
      _fila: 6,
      nombre: 'elevador hidráulico',
      tipo: 'Equipamiento',
      unidad: 'hora',
      costoUnitario: 10000,
    });
    const r = validarLibro(libro);
    expect(r.valido).toBe(false);
    expect(
      r.errores.some(
        (e) => e.hoja === 'Profesionales' && e.mensaje.includes('ya fue registrado en la fila 2'),
      ),
    ).toBe(true);
    expect(
      r.errores.some(
        (e) => e.hoja === 'Recursos' && e.mensaje.includes('ya fue registrado en la fila 2'),
      ),
    ).toBe(true);
  });

  it('caso borde 11: asignacion con profesional y recurso a la vez o ninguno, o inactivo en catalogo', () => {
    const libro = libroMinimoValido();
    libro.Asignaciones = [
      { _fila: 2, tarea: '1.1.1', profesional: 'Ana Pérez', recurso: 'Elevador Hidráulico' },
      { _fila: 3, tarea: '1.1.1' },
      { _fila: 4, tarea: '1.1.1', profesional: 'Inexistente Pérez' },
      { _fila: 5, tarea: '1.1.1', profesional: 'Carlos Retirado' },
    ];
    const catalogo = {
      profesionales: [{ id: 2, nombre: 'Carlos Retirado', tarifaHora: 20000, activo: false }],
    };
    const r = validarLibro(libro, { catalogo });
    expect(r.valido).toBe(false);
    expect(r.errores.some((e) => e.mensaje.includes('no ambos'))).toBe(true);
    expect(
      r.errores.some((e) => e.mensaje.includes('Debe indicar un profesional o un recurso')),
    ).toBe(true);
    expect(
      r.errores.some((e) => e.mensaje.includes("El profesional 'Inexistente Pérez' no existe")),
    ).toBe(true);
    expect(r.errores.some((e) => e.mensaje.includes('está inactivo en el catálogo'))).toBe(true);
  });

  it('caso borde 12: tarifa o costo unitario distinto al catálogo genera advertencia y no error', () => {
    const libro = libroMinimoValido();
    libro.Profesionales = [];
    libro.Recursos = [];
    libro.Asignaciones = [
      {
        tarea: '1.1.1',
        profesional: 'Ana Pérez',
        tarifaAplicada: 30000,
      },
    ];
    const catalogo = {
      profesionales: [{ id: 1, nombre: 'Ana Pérez', tarifaHora: 25000, activo: true }],
    };
    const r = validarLibro(libro, { catalogo });
    expect(r.valido).toBe(true);
    expect(r.errores).toHaveLength(0);
    expect(r.advertencias).toHaveLength(1);
    expect(r.advertencias[0].mensaje).toContain('difiere de la del catálogo');
  });

  it('caso borde 13: fechas como texto AAAA-MM-DD o Date de Excel se normalizan', () => {
    expect(normalizarFechaCelda('2026-11-02')).toBe('2026-11-02');
    const d = new Date('2026-11-02T00:00:00.000Z');
    expect(normalizarFechaCelda(d)).toBe('2026-11-02');
    expect(normalizarFechaCelda('invalida')).toBe(null);
  });

  it('caso borde 14: tope de 200 errores y flag truncado: true', () => {
    const libro = libroMinimoValido();
    libro.Tareas = Array.from({ length: 250 }, (_, i) => ({
      codigo: `invalido-${i}`,
      nombre: '',
      duracionDias: -1,
    }));
    libro.Dependencias = [];
    libro.Asignaciones = [];
    libro.Hitos = [];
    const r = validarLibro(libro, { maximoErrores: 200 });
    expect(r.valido).toBe(false);
    expect(r.errores).toHaveLength(200);
    expect(r.truncado).toBe(true);
  });

  it('caso borde 18: solicitud con estado avanzado se advierte en vista previa', () => {
    const libro = libroMinimoValido();
    libro.Solicitudes[0].estado = 'APROBADA';
    const r = validarLibro(libro);
    expect(r.valido).toBe(true);
    expect(
      r.advertencias.some(
        (a) => a.hoja === 'Solicitudes' && a.mensaje.includes('se importará como REGISTRADA'),
      ),
    ).toBe(true);
  });

  it('AJ1 regresion: KPI nuevo con formula invalida produce valido false y error en celda KPI!D', () => {
    const libro = libroMinimoValido();
    libro.KPI = [
      {
        _fila: 2,
        codigo: 'KPI-NUEVO-INVALIDO',
        nombre: 'Kpi con formula invalida',
        ambito: 'PROYECTO',
        formula: 'VARIABLE_INEXISTENTE * (',
        unidad: 'PORCENTAJE',
        meta: 100,
        direccion: 'MAYOR_MEJOR',
      },
    ];
    const r = validarLibro(libro);
    expect(r.valido).toBe(false);
    const errorFormula = r.errores.find(
      (e) => e.celda === 'KPI!D2' || (e.hoja === 'KPI' && e.columna === 'formula'),
    );
    expect(errorFormula).toBeDefined();
    expect(errorFormula?.celda).toBe('KPI!D2');
  });

  it('AJ3 regresion: normalizarFechaCelda rechaza fechas en formato texto ambiguo 02/01/2026', () => {
    expect(normalizarFechaCelda('02/01/2026')).toBeNull();
    const libro = libroMinimoValido();
    libro.Proyecto[0].fechaInicio = '02/01/2026';
    const r = validarLibro(libro);
    expect(r.valido).toBe(false);
    const err = r.errores.find((e) => e.celda === 'Proyecto!E2');
    expect(err).toBeDefined();
  });

  it('codigoDesdeCelda maneja números enteros y texto recortado', () => {
    expect(codigoDesdeCelda(1)).toBe('1');
    expect(codigoDesdeCelda(' 1.2 ')).toBe('1.2');
    expect(codigoDesdeCelda(null)).toBe('');
    expect(codigoDesdeCelda(undefined)).toBe('');
  });
});
