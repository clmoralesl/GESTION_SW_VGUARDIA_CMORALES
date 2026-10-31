import { describe, expect, it } from 'vitest';
import {
  mensajeRolNoPermitido,
  NOMBRES_ROL,
  PERMISOS,
  ROLES,
  textoRestriccion,
  tienePermiso,
} from './roles';

describe('roles', () => {
  it('contiene los roles requeridos', () => {
    expect(ROLES).toEqual(['JP', 'CC']);
    expect(NOMBRES_ROL.JP).toBe('Jefe de Proyecto');
    expect(NOMBRES_ROL.CC).toBe('Comité de Cambios');
  });

  it('verifica permisos correctamente segun la matriz', () => {
    expect(tienePermiso('JP', 'editarPlanificacion')).toBe(true);
    expect(tienePermiso('CC', 'editarPlanificacion')).toBe(false);

    expect(tienePermiso('JP', 'gestionarRecursos')).toBe(true);
    expect(tienePermiso('CC', 'gestionarRecursos')).toBe(false);

    expect(tienePermiso('CC', 'avanzarEtapasCambio')).toBe(true);
    expect(tienePermiso('JP', 'avanzarEtapasCambio')).toBe(false);

    expect(tienePermiso('JP', 'adjuntarEvidencias')).toBe(true);
    expect(tienePermiso('CC', 'adjuntarEvidencias')).toBe(true);
  });

  it('genera texto descriptivo de restricciones', () => {
    expect(textoRestriccion(PERMISOS.editarPlanificacion)).toBe('Solo Jefe de Proyecto');
    expect(textoRestriccion(PERMISOS.adjuntarEvidencias)).toBe(
      'Solo Jefe de Proyecto o Comité de Cambios',
    );
  });

  it('genera mensaje de rol no permitido', () => {
    expect(mensajeRolNoPermitido(PERMISOS.editarPlanificacion)).toBe(
      'Acción permitida solo para Jefe de Proyecto.',
    );
  });
});
