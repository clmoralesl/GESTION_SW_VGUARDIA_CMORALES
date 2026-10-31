import { describe, expect, it } from 'vitest';
import {
  esquemaActualizarAsignacionProfesional,
  esquemaActualizarAsignacionRecurso,
  esquemaConsultaCargaRecursos,
  esquemaCrearAsignacion,
} from './asignaciones';
import { validar } from './validacion';

describe('asignaciones esquemas', () => {
  it('valida asignacion de profesional valida', () => {
    const res = validar(esquemaCrearAsignacion, {
      profesionalId: 1,
      dedicacion: 50,
      horasPlan: 20,
    });
    expect(res.ok).toBe(true);
  });

  it('valida asignacion de recurso valida', () => {
    const res = validar(esquemaCrearAsignacion, {
      recursoId: 2,
      cantidadPlan: 10.5,
    });
    expect(res.ok).toBe(true);
  });

  it('rechaza cuando se mezclan campos de profesional y recurso', () => {
    const res = validar(esquemaCrearAsignacion, {
      profesionalId: 1,
      dedicacion: 50,
      recursoId: 2,
    });
    expect(res.ok).toBe(false);
  });

  it('rechaza dedicacion menor a 1 o mayor a 100', () => {
    expect(validar(esquemaCrearAsignacion, { profesionalId: 1, dedicacion: 0 }).ok).toBe(false);
    expect(validar(esquemaCrearAsignacion, { profesionalId: 1, dedicacion: 101 }).ok).toBe(false);
  });

  it('actualizar profesional rechaza objeto vacio', () => {
    const res = validar(esquemaActualizarAsignacionProfesional, {});
    expect(res.ok).toBe(false);
  });

  it('actualizar recurso permite actualizarTarifa', () => {
    const res = validar(esquemaActualizarAsignacionRecurso, {
      actualizarTarifa: true,
      cantidadReal: 5,
    });
    expect(res.ok).toBe(true);
  });

  it('consulta de carga rechaza rango mayor a 26 semanas', () => {
    const res = validar(esquemaConsultaCargaRecursos, {
      desde: '2026-01-01',
      hasta: '2026-08-01',
    });
    expect(res.ok).toBe(false);
  });

  it('consulta de carga rechaza desde mayor a hasta', () => {
    const res = validar(esquemaConsultaCargaRecursos, {
      desde: '2026-11-10',
      hasta: '2026-11-02',
    });
    expect(res.ok).toBe(false);
  });
});
