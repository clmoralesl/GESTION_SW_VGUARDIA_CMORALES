import { describe, expect, it } from 'vitest';
import {
  ACCIONES_BITACORA,
  ENTIDADES_BITACORA,
  derivarOrigen,
  esquemaConsultaBitacora,
  esquemaPaginacion,
  resumirValorBitacora,
} from './bitacora';
import { validar } from './validacion';

describe('bitacora', () => {
  it('valida paginacion con valores por defecto y limites', () => {
    const defecto = esquemaPaginacion.parse({});
    expect(defecto.pagina).toBe(1);
    expect(defecto.tamanoPagina).toBe(25);

    const coercion = esquemaPaginacion.parse({ pagina: '2', tamanoPagina: '50' });
    expect(coercion.pagina).toBe(2);
    expect(coercion.tamanoPagina).toBe(50);

    const invalidoCero = validar(esquemaPaginacion, { pagina: 0 });
    expect(invalidoCero.ok).toBe(false);

    const invalidoMax = validar(esquemaPaginacion, { tamanoPagina: 101 });
    expect(invalidoMax.ok).toBe(false);

    const invalidoDecimal = validar(esquemaPaginacion, { pagina: 1.5 });
    expect(invalidoDecimal.ok).toBe(false);

    const invalidoTexto = validar(esquemaPaginacion, { tamanoPagina: 'abc' });
    expect(invalidoTexto.ok).toBe(false);
  });

  it('valida consulta completa de bitacora y casos borde 1 y 2', () => {
    const valida = validar(esquemaConsultaBitacora, {
      proyectoId: '1',
      entidad: 'Tarea',
      entidadId: '10',
      rol: 'JP',
      accion: 'ACTUALIZAR',
      desde: '2026-11-01',
      hasta: '2026-11-02',
      pagina: '1',
      tamanoPagina: '25',
    });
    expect(valida.ok).toBe(true);

    const rolInvalido = validar(esquemaConsultaBitacora, { rol: 'ADMIN' });
    expect(rolInvalido.ok).toBe(false);

    const accionInvalida = validar(esquemaConsultaBitacora, { accion: 'BORRAR' });
    expect(accionInvalida.ok).toBe(false);

    const entidadInvalida = validar(esquemaConsultaBitacora, { entidad: 'Usuario' });
    expect(entidadInvalida.ok).toBe(false);

    const claveDesconocida = validar(esquemaConsultaBitacora, { orden: 'asc' });
    expect(claveDesconocida.ok).toBe(false);

    const parametroRepetido = validar(esquemaConsultaBitacora, { rol: ['JP', 'CC'] });
    expect(parametroRepetido.ok).toBe(false);
  });

  it('valida caso borde 3 de fechas: formato, desde mayor a hasta y desde igual a hasta', () => {
    const fechaInvalida = validar(esquemaConsultaBitacora, { desde: '2026-02-30' });
    expect(fechaInvalida.ok).toBe(false);

    const desdeMayor = validar(esquemaConsultaBitacora, {
      desde: '2026-11-05',
      hasta: '2026-11-02',
    });
    expect(desdeMayor.ok).toBe(false);
    if (!desdeMayor.ok) {
      expect(desdeMayor.detalles[0].campo).toBe('hasta');
    }

    const desdeIgual = validar(esquemaConsultaBitacora, {
      desde: '2026-11-02',
      hasta: '2026-11-02',
    });
    expect(desdeIgual.ok).toBe(true);
  });

  it('valida caso borde 4: entidadId sin entidad es rechazado', () => {
    const sinEntidad = validar(esquemaConsultaBitacora, { entidadId: '5' });
    expect(sinEntidad.ok).toBe(false);
    if (!sinEntidad.ok) {
      expect(sinEntidad.detalles[0].campo).toBe('entidadId');
    }

    const conEntidad = validar(esquemaConsultaBitacora, { entidad: 'Tarea', entidadId: '5' });
    expect(conEntidad.ok).toBe(true);
  });

  it('deriva origen segun D1 distinguiendo aprobacion, rechazo, importacion, recalculo y manual', () => {
    const aprobacion = derivarOrigen({
      accion: 'ACTUALIZAR',
      solicitudCambioId: 2,
      solicitudCambioCodigo: 'SC-002',
      origen: 'Aprobación de impacto',
    });
    expect(aprobacion.tipo).toBe('APROBACION');
    expect(aprobacion.etiqueta).toBe('Aprobación SC-002');
    expect(aprobacion.solicitudCambioId).toBe(2);
    expect(aprobacion.detalle).toBe('Aprobación de impacto');

    const rechazo = derivarOrigen({
      accion: 'RECHAZAR',
      solicitudCambioId: 3,
      solicitudCambioCodigo: 'SC-003',
    });
    expect(rechazo.tipo).toBe('RECHAZO');
    expect(rechazo.etiqueta).toBe('Rechazo SC-003');
    expect(rechazo.solicitudCambioId).toBe(3);

    const importacion = derivarOrigen({
      accion: 'IMPORTAR',
      origen: 'Importación de plantilla',
    });
    expect(importacion.tipo).toBe('IMPORTACION');
    expect(importacion.etiqueta).toBe('Importación');
    expect(importacion.solicitudCambioId).toBeNull();
    expect(importacion.detalle).toBe('Importación de plantilla');

    const recalculo = derivarOrigen({
      accion: 'RECALCULAR',
      origen: 'Actualizar asignación en T-1.2',
    });
    expect(recalculo.tipo).toBe('RECALCULO');
    expect(recalculo.etiqueta).toBe('Recálculo');
    expect(recalculo.solicitudCambioId).toBeNull();
    expect(recalculo.detalle).toBe('Actualizar asignación en T-1.2');

    const manual = derivarOrigen({
      accion: 'ACTUALIZAR',
    });
    expect(manual.tipo).toBe('MANUAL');
    expect(manual.etiqueta).toBe('Manual');
    expect(manual.solicitudCambioId).toBeNull();
    expect(manual.detalle).toBeNull();
  });

  it('resume valores de bitacora sin volcar json crudo', () => {
    const nulo = resumirValorBitacora(null);
    expect(nulo.texto).toBe('-');
    expect(nulo.esObjeto).toBe(false);
    expect(nulo.detalles).toBeNull();

    const boolSi = resumirValorBitacora(true);
    expect(boolSi.texto).toBe('Sí');
    expect(boolSi.esObjeto).toBe(false);

    const boolNo = resumirValorBitacora(false);
    expect(boolNo.texto).toBe('No');
    expect(boolNo.esObjeto).toBe(false);

    const escalar = resumirValorBitacora('2026-11-02');
    expect(escalar.texto).toBe('2026-11-02');
    expect(escalar.esObjeto).toBe(false);

    const unCampo = resumirValorBitacora({ duracion: 5 });
    expect(unCampo.texto).toBe('1 campo');
    expect(unCampo.esObjeto).toBe(true);
    expect(unCampo.detalles).toEqual({ duracion: '5' });
    expect(String(unCampo)).toBe('1 campo');

    const variosCampos = resumirValorBitacora({ nombre: 'T-1', duracion: 5, activo: true });
    expect(variosCampos.texto).toBe('3 campos');
    expect(variosCampos.esObjeto).toBe(true);
    expect(variosCampos.detalles).toEqual({ nombre: 'T-1', duracion: '5', activo: 'Sí' });

    const arreglo = resumirValorBitacora([10, 20]);
    expect(arreglo.texto).toBe('2 elementos');
    expect(arreglo.esObjeto).toBe(true);
    expect(arreglo.detalles).toEqual({ '[0]': '10', '[1]': '20' });
  });

  it('resume valores anidados sin serializar json en el detalle', () => {
    const recalculo = resumirValorBitacora({
      costoPlanNuevo: 1071700,
      tareasAfectadas: [
        { id: 6, codigo: '1.2.1', finNuevo: '2026-11-18' },
        { id: 9, codigo: '1.3.1', finNuevo: '2026-11-23' },
      ],
      hitos: { total: 2, cumplidos: 1 },
      etiquetas: [1, 2, 3],
      vacio: [],
    });
    expect(recalculo.texto).toBe('5 campos');
    expect(recalculo.detalles).toEqual({
      costoPlanNuevo: '1071700',
      tareasAfectadas: '1.2.1, 1.3.1',
      hitos: '2 campos',
      etiquetas: '3 elementos',
      vacio: '0 elementos',
    });
    for (const texto of Object.values(recalculo.detalles ?? {})) {
      expect(texto).not.toMatch(/[{[]/);
    }

    const arregloDeObjetos = resumirValorBitacora([{ id: 1, nombre: 'A' }]);
    expect(arregloDeObjetos.detalles).toEqual({ '[0]': '2 campos' });
  });

  it('limita a diez los codigos de un arreglo anidado', () => {
    const tareas = Array.from({ length: 12 }, (_, i) => ({ codigo: `T-${i + 1}` }));
    const resumen = resumirValorBitacora({ tareasAfectadas: tareas });
    const primeros = tareas.slice(0, 10).map((t) => t.codigo);
    expect(resumen.detalles?.tareasAfectadas).toBe(`${primeros.join(', ')} y 2 más`);
  });

  it('usa el identificador como respaldo cuando falta el codigo de la solicitud', () => {
    const origen = derivarOrigen({ accion: 'APROBAR', solicitudCambioId: 9 });
    expect(origen.tipo).toBe('APROBACION');
    expect(origen.etiqueta).toBe('Aprobación #9');
  });

  it('declara la lista completa de entidades y acciones registradas', () => {
    expect(ENTIDADES_BITACORA.length).toBe(16);
    expect(ENTIDADES_BITACORA).toContain('Tarea');
    expect(ENTIDADES_BITACORA).toContain('SolicitudCambio');
    expect(ACCIONES_BITACORA.length).toBe(8);
    expect(ACCIONES_BITACORA).toContain('IMPORTAR');
    expect(ACCIONES_BITACORA).toContain('RECALCULAR');
  });
});
