import { describe, expect, it } from 'vitest';
import {
  ActualizarProfesional,
  ActualizarRecurso,
  claveNombre,
  COSTO_UNITARIO_MAXIMO,
  CrearProfesional,
  CrearRecurso,
  esquemaActualizarProfesional,
  esquemaActualizarRecurso,
  esquemaCrearProfesional,
  esquemaCrearRecurso,
  mensajeTieneAsignaciones,
  TARIFA_HORA_MAXIMA,
  textoAsignaciones,
  TIPOS_RECURSO,
  UNIDADES_SUGERIDAS,
} from './catalogos';

describe('catalogos', () => {
  describe('constantes', () => {
    it('define los 4 tipos de recurso requeridos', () => {
      expect(TIPOS_RECURSO.map((t) => t.nombre)).toEqual([
        'Humano',
        'Equipamiento',
        'Material',
        'Servicio',
      ]);
    });

    it('incluye las unidades sugeridas requeridas', () => {
      expect(UNIDADES_SUGERIDAS).toContain('hora');
      expect(UNIDADES_SUGERIDAS).toContain('unidad');
      expect(UNIDADES_SUGERIDAS).toContain('mes');
      expect(UNIDADES_SUGERIDAS).toContain('licencia');
    });
  });

  describe('claveNombre', () => {
    it.each([
      ['Peña', 'peña'],
      ['Pena', 'pena'],
      ['PEÑA', 'peña'],
      ['  JUAN   PÉREZ  ', 'juan perez'],
      ['Juan Pérez', 'juan perez'],
      ['juan perez', 'juan perez'],
      ['Pen\u0303a', 'peña'],
      ['Ángel Órdenes', 'angel ordenes'],
      ['CAMILA ROJAS', 'camila rojas'],
      ['Matias-Soto', 'matias-soto'],
    ])('genera clave correcta para "%s" -> "%s"', (entrada, esperado) => {
      expect(claveNombre(entrada)).toBe(esperado);
    });

    it('diferencia Peña y Pena', () => {
      expect(claveNombre('Peña')).not.toBe(claveNombre('Pena'));
    });
  });

  describe('textoAsignaciones y mensajeTieneAsignaciones', () => {
    it.each([
      [0, '0 asignaciones'],
      [1, '1 asignación'],
      [2, '2 asignaciones'],
      [3, '3 asignaciones'],
    ])('formatea %i asignaciones como "%s"', (cantidad, esperado) => {
      expect(textoAsignaciones(cantidad)).toBe(esperado);
    });

    it('genera mensaje con singular', () => {
      expect(mensajeTieneAsignaciones('El profesional', 'Matías Soto', 1)).toBe(
        'El profesional «Matías Soto» tiene 1 asignación. Solo puede desactivarlo.',
      );
    });

    it('genera mensaje con plural', () => {
      expect(mensajeTieneAsignaciones('El recurso', 'Elevador hidráulico', 3)).toBe(
        'El recurso «Elevador hidráulico» tiene 3 asignaciones. Solo puede desactivarlo.',
      );
    });
  });

  describe('esquemaCrearProfesional', () => {
    const baseValida: CrearProfesional = {
      nombre: 'Rodrigo Fuentes',
      cargo: 'Jefe de taller',
      tarifaHora: 12000,
      horasDiarias: 8,
    };

    it('acepta datos validos', () => {
      const res = esquemaCrearProfesional.safeParse(baseValida);
      expect(res.success).toBe(true);
    });

    it('asigna 8 horas por defecto si se omite', () => {
      const sinHoras = {
        nombre: baseValida.nombre,
        cargo: baseValida.cargo,
        tarifaHora: baseValida.tarifaHora,
      };
      const res = esquemaCrearProfesional.safeParse(sinHoras);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.horasDiarias).toBe(8);
      }
    });

    it('colapsa espacios en nombre y cargo y normaliza a NFC', () => {
      const res = esquemaCrearProfesional.safeParse({
        ...baseValida,
        nombre: '   Rodrigo    Fuentes   ',
        cargo: '   Jefe   de   taller   ',
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.nombre).toBe('Rodrigo Fuentes');
        expect(res.data.cargo).toBe('Jefe de taller');
      }
    });

    it.each([
      ['nombre vacio', { ...baseValida, nombre: '' }, 'Ingrese el nombre.'],
      ['nombre solo espacios', { ...baseValida, nombre: '   ' }, 'Ingrese el nombre.'],
      [
        'nombre de 121 caracteres',
        { ...baseValida, nombre: 'a'.repeat(121) },
        'Use como máximo 120 caracteres.',
      ],
      ['cargo vacio', { ...baseValida, cargo: '' }, 'Ingrese el cargo.'],
      ['cargo solo espacios', { ...baseValida, cargo: '   ' }, 'Ingrese el cargo.'],
      [
        'cargo de 121 caracteres',
        { ...baseValida, cargo: 'a'.repeat(121) },
        'Use como máximo 120 caracteres.',
      ],
      ['tarifa negativa', { ...baseValida, tarifaHora: -1 }, 'La tarifa no puede ser negativa.'],
      [
        'tarifa con decimales',
        { ...baseValida, tarifaHora: 12000.5 },
        'Ingrese la tarifa en pesos, sin decimales.',
      ],
      [
        'tarifa mayor al maximo',
        { ...baseValida, tarifaHora: TARIFA_HORA_MAXIMA + 1 },
        'La tarifa supera el máximo permitido.',
      ],
      [
        'horas diarias 0',
        { ...baseValida, horasDiarias: 0 },
        'Las horas por día deben ser mayores que 0.',
      ],
      [
        'horas diarias negativas',
        { ...baseValida, horasDiarias: -1 },
        'Las horas por día deben ser mayores que 0.',
      ],
      [
        'horas diarias mayores a 24',
        { ...baseValida, horasDiarias: 24.01 },
        'Las horas por día no pueden superar 24.',
      ],
      [
        'horas diarias con 3 decimales',
        { ...baseValida, horasDiarias: 7.555 },
        'Use como máximo 2 decimales.',
      ],
      [
        'tarifa no numerica',
        { ...baseValida, tarifaHora: 'abc' as unknown as number },
        'Ingrese la tarifa por hora.',
      ],
      [
        'horas no numericas',
        { ...baseValida, horasDiarias: 'abc' as unknown as number },
        'Ingrese las horas por día.',
      ],
      ['campo desconocido', { ...baseValida, activo: true }, 'Llave desconocida: "activo"'],
    ])('falla en caso invalido: %s', (_, entrada, mensajeEsperado) => {
      const res = esquemaCrearProfesional.safeParse(entrada);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toBe(mensajeEsperado);
      }
    });

    it.each([
      ['tarifa 0', { ...baseValida, tarifaHora: 0 }],
      ['tarifa maxima', { ...baseValida, tarifaHora: TARIFA_HORA_MAXIMA }],
      ['horas diarias 0.01', { ...baseValida, horasDiarias: 0.01 }],
      ['horas diarias 7.5', { ...baseValida, horasDiarias: 7.5 }],
      ['horas diarias 24', { ...baseValida, horasDiarias: 24 }],
      ['nombre de 120 caracteres', { ...baseValida, nombre: 'a'.repeat(120) }],
      ['cargo de 120 caracteres', { ...baseValida, cargo: 'a'.repeat(120) }],
      [
        'nombre con 120 caracteres y espacios en bordes',
        { ...baseValida, nombre: `  ${'a'.repeat(120)}  ` },
      ],
    ])('acepta caso limite valido: %s', (_, entrada) => {
      const res = esquemaCrearProfesional.safeParse(entrada);
      expect(res.success).toBe(true);
    });
  });

  describe('esquemaActualizarProfesional', () => {
    it('falla si el objeto esta vacio', () => {
      const res = esquemaActualizarProfesional.safeParse({});
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toBe('Debe enviar al menos un campo para actualizar.');
      }
    });

    it.each([
      ['activo booleano', { activo: false }],
      ['reactivar', { activo: true }],
      ['cambio de cargo', { cargo: 'Mecánico senior' }],
      ['cambio de tarifa', { tarifaHora: 15000 }],
      ['cambio de horas', { horasDiarias: 6 }],
      ['multiples campos', { nombre: 'Nuevo Nombre', tarifaHora: 9000 }],
    ])('acepta actualizacion parcial valida: %s', (_, entrada) => {
      const res = esquemaActualizarProfesional.safeParse(entrada);
      expect(res.success).toBe(true);
    });

    it('rechaza campo activo no booleano', () => {
      const res = esquemaActualizarProfesional.safeParse({
        activo: 'invalido' as unknown as boolean,
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toBe('Indique si está activo.');
      }
    });

    it('rechaza campos desconocidos', () => {
      const res = esquemaActualizarProfesional.safeParse({
        id: 1,
        cargo: 'Jefe',
      } as unknown as ActualizarProfesional);
      expect(res.success).toBe(false);
    });
  });

  describe('esquemaCrearRecurso', () => {
    const baseRecursoValida: CrearRecurso = {
      nombre: 'Elevador hidráulico de dos columnas',
      tipoRecursoId: 2,
      unidad: 'día',
      costoUnitario: 25000,
    };

    it('acepta datos validos', () => {
      const res = esquemaCrearRecurso.safeParse(baseRecursoValida);
      expect(res.success).toBe(true);
    });

    it('colapsa espacios en unidad y nombre', () => {
      const res = esquemaCrearRecurso.safeParse({
        ...baseRecursoValida,
        nombre: '  Elevador   hidráulico  ',
        unidad: '   día   ',
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.nombre).toBe('Elevador hidráulico');
        expect(res.data.unidad).toBe('día');
      }
    });

    it.each([
      ['nombre vacio', { ...baseRecursoValida, nombre: '' }, 'Ingrese el nombre.'],
      [
        'tipoRecursoId 0',
        { ...baseRecursoValida, tipoRecursoId: 0 },
        'Seleccione el tipo de recurso.',
      ],
      [
        'tipoRecursoId negativo',
        { ...baseRecursoValida, tipoRecursoId: -1 },
        'Seleccione el tipo de recurso.',
      ],
      [
        'tipoRecursoId con decimales',
        { ...baseRecursoValida, tipoRecursoId: 1.5 },
        'Seleccione el tipo de recurso.',
      ],
      [
        'tipoRecursoId ausente',
        { ...baseRecursoValida, tipoRecursoId: undefined as unknown as number },
        'Seleccione el tipo de recurso.',
      ],
      ['unidad vacia', { ...baseRecursoValida, unidad: '' }, 'Ingrese la unidad.'],
      [
        'unidad de 31 caracteres',
        { ...baseRecursoValida, unidad: 'a'.repeat(31) },
        'Use como máximo 30 caracteres.',
      ],
      [
        'costo negativo',
        { ...baseRecursoValida, costoUnitario: -1 },
        'El costo no puede ser negativo.',
      ],
      [
        'costo con decimales',
        { ...baseRecursoValida, costoUnitario: 25000.5 },
        'Ingrese el costo en pesos, sin decimales.',
      ],
      [
        'costo mayor al maximo',
        { ...baseRecursoValida, costoUnitario: COSTO_UNITARIO_MAXIMO + 1 },
        'El costo supera el máximo permitido.',
      ],
      [
        'costo no numerico',
        { ...baseRecursoValida, costoUnitario: 'abc' as unknown as number },
        'Ingrese el costo unitario.',
      ],
    ])('falla en caso invalido: %s', (_, entrada, mensajeEsperado) => {
      const res = esquemaCrearRecurso.safeParse(entrada);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toBe(mensajeEsperado);
      }
    });

    it.each([
      ['costo 0', { ...baseRecursoValida, costoUnitario: 0 }],
      ['costo maximo', { ...baseRecursoValida, costoUnitario: COSTO_UNITARIO_MAXIMO }],
      ['unidad de 30 caracteres', { ...baseRecursoValida, unidad: 'a'.repeat(30) }],
    ])('acepta caso limite valido: %s', (_, entrada) => {
      const res = esquemaCrearRecurso.safeParse(entrada);
      expect(res.success).toBe(true);
    });
  });

  describe('esquemaActualizarRecurso', () => {
    it('falla si el objeto esta vacio', () => {
      const res = esquemaActualizarRecurso.safeParse({});
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toBe('Debe enviar al menos un campo para actualizar.');
      }
    });

    it.each([
      ['desactivar', { activo: false }],
      ['reactivar', { activo: true }],
      ['costo', { costoUnitario: 30000 }],
      ['unidad', { unidad: 'hora' }],
      ['tipo', { tipoRecursoId: 1 }],
    ])('acepta actualizacion parcial valida: %s', (_, entrada) => {
      const res = esquemaActualizarRecurso.safeParse(entrada);
      expect(res.success).toBe(true);
    });

    it('rechaza claves desconocidas', () => {
      const res = esquemaActualizarRecurso.safeParse({
        id: 10,
        unidad: 'mes',
      } as unknown as ActualizarRecurso);
      expect(res.success).toBe(false);
    });
  });
});
