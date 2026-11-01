import { describe, expect, it } from 'vitest';
import {
  esquemaCrearImpacto,
  esquemaImpactoDuracion,
  esquemaImpactoNuevaTarea,
  esquemaImpactoPresupuesto,
  esquemaPredecesoraNuevaTarea,
  validarLoteImpactos,
} from './impactos';

describe('impactos schemas and validation', () => {
  it('valida esquemaImpactoDuracion', () => {
    const ok = esquemaImpactoDuracion.safeParse({
      tipo: 'DURACION',
      tareaId: 1,
      duracionDias: 5,
    });
    expect(ok.success).toBe(true);

    const cero = esquemaImpactoDuracion.safeParse({
      tipo: 'DURACION',
      tareaId: 1,
      duracionDias: 0,
    });
    expect(cero.success).toBe(false);

    const exceso = esquemaImpactoDuracion.safeParse({
      tipo: 'DURACION',
      tareaId: 1,
      duracionDias: 4000,
    });
    expect(exceso.success).toBe(false);
  });

  it('valida esquemaPredecesoraNuevaTarea con límites de desfase', () => {
    const conId = esquemaPredecesoraNuevaTarea.safeParse({
      tareaId: 10,
      tipo: 'FS',
      desfaseDias: 0,
    });
    expect(conId.success).toBe(true);

    const conClave = esquemaPredecesoraNuevaTarea.safeParse({
      clave: 'N1',
      tipo: 'SS',
      desfaseDias: -5,
    });
    expect(conClave.success).toBe(true);

    const ambos = esquemaPredecesoraNuevaTarea.safeParse({
      tareaId: 10,
      clave: 'N1',
    });
    expect(ambos.success).toBe(false);

    const ninguno = esquemaPredecesoraNuevaTarea.safeParse({
      tipo: 'FS',
    });
    expect(ninguno.success).toBe(false);

    const desfaseInferior = esquemaPredecesoraNuevaTarea.safeParse({
      tareaId: 10,
      desfaseDias: -3651,
    });
    expect(desfaseInferior.success).toBe(false);

    const desfaseSuperior = esquemaPredecesoraNuevaTarea.safeParse({
      tareaId: 10,
      desfaseDias: 3651,
    });
    expect(desfaseSuperior.success).toBe(false);
  });

  it('valida esquemaImpactoNuevaTarea y limite de predecesoras', () => {
    const ok = esquemaImpactoNuevaTarea.safeParse({
      tipo: 'NUEVA_TAREA',
      clave: 'N1',
      nombre: 'Prueba',
      duracionDias: 3,
      predecesoras: [{ tareaId: 1 }],
    });
    expect(ok.success).toBe(true);

    const claveInvalida = esquemaImpactoNuevaTarea.safeParse({
      tipo: 'NUEVA_TAREA',
      clave: 'X1',
      nombre: 'Prueba',
      duracionDias: 3,
    });
    expect(claveInvalida.success).toBe(false);

    const muchasPredecesoras = Array.from({ length: 21 }, (_, i) => ({
      tareaId: i + 1,
    }));
    const excesoPredecesoras = esquemaImpactoNuevaTarea.safeParse({
      tipo: 'NUEVA_TAREA',
      clave: 'N2',
      nombre: 'Prueba',
      duracionDias: 3,
      predecesoras: muchasPredecesoras,
    });
    expect(excesoPredecesoras.success).toBe(false);
  });

  it('valida esquemaImpactoPresupuesto', () => {
    const ok = esquemaImpactoPresupuesto.safeParse({
      tipo: 'PRESUPUESTO',
      presupuesto: 50000000,
    });
    expect(ok.success).toBe(true);

    const negativo = esquemaImpactoPresupuesto.safeParse({
      tipo: 'PRESUPUESTO',
      presupuesto: -10,
    });
    expect(negativo.success).toBe(false);

    const decimales = esquemaImpactoPresupuesto.safeParse({
      tipo: 'PRESUPUESTO',
      presupuesto: 100.123,
    });
    expect(decimales.success).toBe(false);
  });

  it('valida esquemaCrearImpacto para asignaciones', () => {
    const agregarProf = esquemaCrearImpacto.safeParse({
      tipo: 'ASIGNACION',
      operacion: 'agregar',
      elemento: 'PROFESIONAL',
      tareaId: 1,
      profesionalId: 2,
      dedicacion: 50,
    });
    expect(agregarProf.success).toBe(true);

    const agregarRec = esquemaCrearImpacto.safeParse({
      tipo: 'ASIGNACION',
      operacion: 'agregar',
      elemento: 'RECURSO',
      tareaId: 1,
      recursoId: 2,
      cantidadPlan: 10,
    });
    expect(agregarRec.success).toBe(true);

    const quitar = esquemaCrearImpacto.safeParse({
      tipo: 'ASIGNACION',
      operacion: 'quitar',
      elemento: 'PROFESIONAL',
      tareaId: 1,
      profesionalId: 2,
    });
    expect(quitar.success).toBe(true);
  });

  it('detecta duplicados y errores en validarLoteImpactos', () => {
    const loteDuplicado = [
      { tipo: 'DURACION' as const, tareaId: 1, duracionDias: 5 },
      { tipo: 'DURACION' as const, tareaId: 1, duracionDias: 8 },
    ];
    const errDuplicado = validarLoteImpactos(loteDuplicado);
    expect(errDuplicado.length).toBe(1);
    expect(errDuplicado[0]?.mensaje).toContain('Elemento duplicado');

    const lotePresupuestoDup = [
      { tipo: 'PRESUPUESTO' as const, presupuesto: 1000 },
      { tipo: 'PRESUPUESTO' as const, presupuesto: 2000 },
    ];
    expect(validarLoteImpactos(lotePresupuestoDup).length).toBe(1);

    const loteAutodependencia = [
      {
        tipo: 'NUEVA_TAREA' as const,
        clave: 'N1',
        nombre: 'Tarea N1',
        duracionDias: 2,
        predecesoras: [{ clave: 'N1', tipo: 'FS' as const, desfaseDias: 0 }],
      },
    ];
    const errAuto = validarLoteImpactos(loteAutodependencia);
    expect(errAuto.some((e) => e.mensaje.includes('Autodependencia'))).toBe(true);

    const loteInexistente = [
      {
        tipo: 'NUEVA_TAREA' as const,
        clave: 'N1',
        nombre: 'Tarea N1',
        duracionDias: 2,
        predecesoras: [{ clave: 'N2', tipo: 'FS' as const, desfaseDias: 0 }],
      },
    ];
    const errInexistente = validarLoteImpactos(loteInexistente);
    expect(errInexistente.some((e) => e.mensaje.includes('no existe'))).toBe(true);

    const loteCiclo = [
      {
        tipo: 'NUEVA_TAREA' as const,
        clave: 'N1',
        nombre: 'Tarea N1',
        duracionDias: 2,
        predecesoras: [{ clave: 'N2', tipo: 'FS' as const, desfaseDias: 0 }],
      },
      {
        tipo: 'NUEVA_TAREA' as const,
        clave: 'N2',
        nombre: 'Tarea N2',
        duracionDias: 2,
        predecesoras: [{ clave: 'N1', tipo: 'FS' as const, desfaseDias: 0 }],
      },
    ];
    const errCiclo = validarLoteImpactos(loteCiclo);
    expect(errCiclo.some((e) => e.mensaje.includes('Ciclo detectado'))).toBe(true);
  });
});
