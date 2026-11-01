import { describe, expect, it } from 'vitest';
import {
  aplicarAccionEtapa,
  calcularEtapaActual,
  decidir,
  duracionRealDias,
  ErrorTransicion,
  esquemaActualizarEtapa,
  esquemaActualizarSolicitud,
  esquemaCrearSolicitud,
  filtrarSolicitudes,
  nivelRiesgo,
  puedeDecidir,
  siguienteCodigo,
  type EstadoEtapa,
  type EstadoSolicitud,
  type SolicitudFiltrable,
  type SolicitudParaAccion,
} from './cambios';

const hoy = '2026-10-31';

function nuevaSolicitud(): SolicitudParaAccion {
  return {
    estado: 'REGISTRADA',
    etapaActual: 1,
    etapas: Array.from({ length: 10 }, (_, i) => ({
      numero: i + 1,
      estado: 'PENDIENTE' as EstadoEtapa,
    })),
  };
}

const hasta = (
  solicitud: SolicitudParaAccion,
  pasos: [number | 'decidir', string, Record<string, unknown>?][],
): SolicitudParaAccion =>
  pasos.reduce<SolicitudParaAccion>((acc, [n, accion, datos = {}]) => {
    if (n === 'decidir') {
      return decidir(acc, accion as 'aprobar' | 'rechazar');
    }
    return aplicarAccionEtapa(acc, n, accion as 'iniciar' | 'completar' | 'omitir', {
      hoy,
      ...datos,
    });
  }, solicitud);

const flujoHastaAprobada: [number | 'decidir', string, Record<string, unknown>?][] = [
  [1, 'iniciar'],
  [1, 'completar'],
  [2, 'iniciar'],
  [2, 'completar'],
  [3, 'iniciar'],
  [3, 'completar'],
  ['decidir', 'aprobar'],
];

describe('cambios en core', () => {
  it('nueva solicitud: 10 etapas pendientes, etapa actual 1', () => {
    const s = nuevaSolicitud();
    expect(s.etapas).toHaveLength(10);
    expect(s.etapaActual).toBe(1);
    expect(calcularEtapaActual(s.etapas)).toBe(1);
  });

  it('iniciar etapa 2 pasa a EN_EVALUACION', () => {
    const s = hasta(nuevaSolicitud(), [
      [1, 'iniciar'],
      [1, 'completar'],
      [2, 'iniciar'],
    ]);
    expect(s.estado).toBe('EN_EVALUACION');
    expect(s.etapaActual).toBe(2);
  });

  it('no se completa una etapa si la anterior no esta terminada', () => {
    const s = hasta(nuevaSolicitud(), [[1, 'iniciar']]);
    expect(() => aplicarAccionEtapa(s, 2, 'completar', { hoy })).toThrowError(ErrorTransicion);
    expect(() => aplicarAccionEtapa(s, 2, 'iniciar', { hoy })).toThrowError(ErrorTransicion);
  });

  it('no se completa sin iniciar', () => {
    expect(() => aplicarAccionEtapa(nuevaSolicitud(), 1, 'completar', { hoy })).toThrowError(
      ErrorTransicion,
    );
  });

  it('omitir exige comentario y no aplica a etapas obligatorias', () => {
    const s = hasta(nuevaSolicitud(), flujoHastaAprobada);
    expect(() => aplicarAccionEtapa(s, 4, 'omitir', { hoy, comentario: '   ' })).toThrowError(
      ErrorTransicion,
    );

    const o = aplicarAccionEtapa(s, 4, 'omitir', {
      hoy,
      comentario: 'Plan ya existente',
    });
    expect(o.etapas[3]?.estado).toBe('OMITIDA');
    expect(o.etapaActual).toBe(5);

    expect(() =>
      aplicarAccionEtapa(nuevaSolicitud(), 1, 'omitir', {
        hoy,
        comentario: 'x',
      }),
    ).toThrowError(ErrorTransicion);

    const o5 = aplicarAccionEtapa(o, 5, 'omitir', { hoy, comentario: 'x' });
    expect(() => aplicarAccionEtapa(o5, 6, 'omitir', { hoy, comentario: 'x' })).toThrowError(
      ErrorTransicion,
    );
  });

  it('etapa 4 exige APROBADA: con EN_EVALUACION responde error', () => {
    const s = hasta(nuevaSolicitud(), flujoHastaAprobada.slice(0, 6));
    expect(s.estado).toBe('EN_EVALUACION');
    expect(() => aplicarAccionEtapa(s, 4, 'iniciar', { hoy })).toThrowError(ErrorTransicion);
  });

  it('aprobar exige etapa 3 completada y puedeDecidir lo refleja', () => {
    const parcial = hasta(nuevaSolicitud(), flujoHastaAprobada.slice(0, 5));
    expect(puedeDecidir(parcial)).toBe(false);
    expect(() => decidir(parcial, 'aprobar')).toThrowError(ErrorTransicion);

    const completa3 = hasta(nuevaSolicitud(), flujoHastaAprobada.slice(0, 6));
    expect(puedeDecidir(completa3)).toBe(true);
  });

  it('completar etapa 6 pasa a IMPLEMENTADA y etapa 10 a CERRADA', () => {
    let s = hasta(nuevaSolicitud(), [
      ...flujoHastaAprobada,
      [4, 'omitir', { comentario: 'x' }],
      [5, 'iniciar'],
      [5, 'completar'],
      [6, 'iniciar'],
      [6, 'completar'],
    ]);
    expect(s.estado).toBe('IMPLEMENTADA');

    s = hasta(s, [
      [7, 'iniciar'],
      [7, 'completar'],
      [8, 'omitir', { comentario: 'x' }],
      [9, 'iniciar'],
    ]);
    const etapa9 = s.etapas[8];
    if (etapa9) etapa9.accionesAbiertas = 1;
    expect(() => aplicarAccionEtapa(s, 9, 'completar', { hoy })).toThrowError(ErrorTransicion);

    if (etapa9) etapa9.accionesAbiertas = 0;
    s = hasta(s, [
      [9, 'completar'],
      [10, 'iniciar'],
    ]);
    expect(() => aplicarAccionEtapa(s, 10, 'completar', { hoy })).toThrowError(ErrorTransicion);

    const etapa10 = s.etapas[9];
    if (etapa10) etapa10.porcentajeAdopcion = 85;
    s = aplicarAccionEtapa(s, 10, 'completar', { hoy });
    expect(s.estado).toBe('CERRADA');
    expect(s.etapaActual).toBe(10);
    expect(() => aplicarAccionEtapa(s, 10, 'iniciar', { hoy })).toThrowError(ErrorTransicion);
  });

  it('RECHAZADA bloquea todas las acciones de etapa', () => {
    const s = hasta(nuevaSolicitud(), [...flujoHastaAprobada.slice(0, 6), ['decidir', 'rechazar']]);
    expect(s.estado).toBe('RECHAZADA');
    expect(() => aplicarAccionEtapa(s, 4, 'omitir', { hoy, comentario: 'x' })).toThrowError(
      ErrorTransicion,
    );
  });

  it('no se reabre ni se reinicia una etapa completada', () => {
    const s = hasta(nuevaSolicitud(), [
      [1, 'iniciar'],
      [1, 'completar'],
    ]);
    expect(() => aplicarAccionEtapa(s, 1, 'iniciar', { hoy })).toThrowError(ErrorTransicion);
    const s2 = hasta(s, [
      [2, 'iniciar'],
      [2, 'completar'],
    ]);
    expect(() => aplicarAccionEtapa(s2, 2, 'iniciar', { hoy })).toThrowError(ErrorTransicion);
  });

  it('codigo correlativo sin depender del orden textual', () => {
    expect(siguienteCodigo([])).toBe('SC-001');
    expect(siguienteCodigo(['SC-999', 'SC-1000', 'SC-002'])).toBe('SC-1001');
  });

  it('nivel de riesgo por bandas', () => {
    const pares: [number, number][] = [
      [1, 4],
      [1, 5],
      [3, 3],
      [2, 5],
      [3, 5],
      [5, 5],
    ];
    expect(pares.map(([p, i]) => nivelRiesgo(p, i))).toEqual([
      'BAJO',
      'MEDIO',
      'MEDIO',
      'ALTO',
      'CRITICO',
      'CRITICO',
    ]);
  });

  it('duracion real en dias corridos inclusive', () => {
    expect(
      duracionRealDias(
        {
          estado: 'COMPLETADA',
          fechaIniciada: '2026-10-01',
          fechaCompletada: '2026-10-01',
        },
        hoy,
      ),
    ).toBe(1);
    expect(
      duracionRealDias(
        {
          estado: 'EN_CURSO',
          fechaIniciada: '2026-10-30',
        },
        hoy,
      ),
    ).toBe(2);
    expect(
      duracionRealDias(
        {
          estado: 'PENDIENTE',
        },
        hoy,
      ),
    ).toBeNull();
  });

  it('filtrarSolicitudes filtra por campos combinables', () => {
    const items: SolicitudFiltrable[] = [
      {
        codigo: 'SC-001',
        titulo: 'Aumento de memoria',
        responsable: 'Carlos Núñez',
        estado: 'REGISTRADA' as EstadoSolicitud,
        etapaActual: 1,
        prioridad: 'ALTA',
        categoria: 'RECURSO',
        probabilidadRiesgo: 3,
        impactoRiesgo: 4,
        fechaRegistro: '2026-10-15',
      },
      {
        codigo: 'SC-002',
        titulo: 'Nuevo módulo',
        responsable: 'Ana Gómez',
        estado: 'EN_EVALUACION' as EstadoSolicitud,
        etapaActual: 2,
        prioridad: 'MEDIA',
        categoria: 'ALCANCE',
        probabilidadRiesgo: 2,
        impactoRiesgo: 2,
        fechaRegistro: '2026-10-20',
      },
    ];

    expect(filtrarSolicitudes(items, { estado: 'REGISTRADA' })).toHaveLength(1);
    expect(filtrarSolicitudes(items, { responsable: 'nunez' })).toHaveLength(1);
    expect(filtrarSolicitudes(items, { nivelRiesgo: 'ALTO' })).toHaveLength(1);
    expect(filtrarSolicitudes(items, { fechaDesde: '2026-10-18' })).toHaveLength(1);
    expect(filtrarSolicitudes(items, { fechaHasta: '2026-10-10' })).toHaveLength(0);
  });

  it('esquemas validan y rechazan entradas incorrectas', () => {
    const valida = esquemaCrearSolicitud.safeParse({
      titulo: 'Nueva funcionalidad',
      descripcion: 'Detalle de la necesidad',
      justificacion: 'Requerido para producción',
      solicitante: 'Juan Pérez',
      responsable: 'María López',
      prioridad: 'ALTA',
      categoria: 'ALCANCE',
      probabilidadRiesgo: 3,
      impactoRiesgo: 4,
    });
    expect(valida.success).toBe(true);

    const invalida = esquemaCrearSolicitud.safeParse({
      titulo: 'X',
      probabilidadRiesgo: 7,
    });
    expect(invalida.success).toBe(false);

    const etapaValida = esquemaActualizarEtapa.safeParse({
      fechaInicio: '2026-11-01',
      fechaFin: '2026-11-05',
    });
    expect(etapaValida.success).toBe(true);

    const etapaInvalida = esquemaActualizarEtapa.safeParse({
      fechaInicio: '2026-11-05',
      fechaFin: '2026-11-01',
    });
    expect(etapaInvalida.success).toBe(false);

    const patchVacio = esquemaActualizarSolicitud.safeParse({});
    expect(patchVacio.success).toBe(true);
  });
});
