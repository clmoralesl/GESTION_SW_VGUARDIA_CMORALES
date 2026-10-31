import { describe, expect, it } from 'vitest';
import {
  atributoAriaSort,
  compararValores,
  filtrarYOrdenar,
  siguienteOrden,
  type OpcionesTabla,
} from './ordenar-filas';

describe('ordenar-filas', () => {
  interface FilaPrueba {
    id: number;
    nombre: string;
    cargo: string;
    monto: number | null;
    activo: boolean;
  }

  const filasPrueba: FilaPrueba[] = [
    {
      id: 1,
      nombre: 'Rodrigo Fuentes',
      cargo: 'Jefe',
      monto: 12000,
      activo: true,
    },
    {
      id: 2,
      nombre: 'Camila Rojas',
      cargo: 'Mecánica',
      monto: 9500,
      activo: true,
    },
    {
      id: 3,
      nombre: 'Valentina Muñoz',
      cargo: 'Desarrolladora',
      monto: 11000,
      activo: false,
    },
    {
      id: 4,
      nombre: 'Matías Soto',
      cargo: 'Mecánico',
      monto: null,
      activo: true,
    },
    {
      id: 5,
      nombre: 'Nicolás Núñez',
      cargo: 'Asistente',
      monto: 8000,
      activo: true,
    },
    {
      id: 6,
      nombre: 'Ñuble Peña',
      cargo: 'Técnico',
      monto: 8000,
      activo: false,
    },
  ];

  const columnas: OpcionesTabla<FilaPrueba, 'nombre' | 'monto' | 'activo'>['columnas'] = {
    nombre: (f) => f.nombre,
    monto: (f) => f.monto,
    activo: (f) => f.activo,
  };

  const camposBusqueda = [(f: FilaPrueba) => f.nombre, (f: FilaPrueba) => f.cargo];

  it('no muta el arreglo original', () => {
    const copia = [...filasPrueba];
    filtrarYOrdenar(filasPrueba, {
      busqueda: '',
      camposBusqueda,
      columnas,
      orden: { columna: 'nombre', direccion: 'asc' },
    });
    expect(filasPrueba).toEqual(copia);
  });

  it('ordena decimales numericamente respetando 9.25 < 9.5 < 10', () => {
    const filas = [
      { id: 1, valor: 9.5 },
      { id: 2, valor: 10 },
      { id: 3, valor: 9.25 },
    ];
    const res = filtrarYOrdenar(filas, {
      busqueda: '',
      camposBusqueda: [],
      columnas: { valor: (f) => f.valor },
      orden: { columna: 'valor', direccion: 'asc' },
    });
    expect(res.map((r) => r.valor)).toEqual([9.25, 9.5, 10]);
  });

  it('desempata por id aunque la entrada venga desordenada', () => {
    const filas = [
      { id: 15, valor: 100 },
      { id: 3, valor: 100 },
      { id: 8, valor: 100 },
      { id: 1, valor: 100 },
    ];
    const resAsc = filtrarYOrdenar(filas, {
      busqueda: '',
      camposBusqueda: [],
      columnas: { valor: (f) => f.valor },
      orden: { columna: 'valor', direccion: 'asc' },
    });
    expect(resAsc.map((r) => r.id)).toEqual([1, 3, 8, 15]);

    const resDesc = filtrarYOrdenar(filas, {
      busqueda: '',
      camposBusqueda: [],
      columnas: { valor: (f) => f.valor },
      orden: { columna: 'valor', direccion: 'desc' },
    });
    expect(resDesc.map((r) => r.id)).toEqual([1, 3, 8, 15]);
  });

  it('ordena texto con reglas de español ubicando Ñuble después de Nicolás', () => {
    const res = filtrarYOrdenar(filasPrueba, {
      busqueda: '',
      camposBusqueda,
      columnas,
      orden: { columna: 'nombre', direccion: 'asc' },
    });
    const nombres = res.map((r) => r.nombre);
    const posNicolas = nombres.indexOf('Nicolás Núñez');
    const posNuble = nombres.indexOf('Ñuble Peña');
    expect(posNicolas).toBeLessThan(posNuble);
  });

  it('ubica valores nulos y vacios al final tanto en asc como en desc', () => {
    const resAsc = filtrarYOrdenar(filasPrueba, {
      busqueda: '',
      camposBusqueda,
      columnas,
      orden: { columna: 'monto', direccion: 'asc' },
    });
    expect(resAsc[resAsc.length - 1]?.id).toBe(4);

    const resDesc = filtrarYOrdenar(filasPrueba, {
      busqueda: '',
      camposBusqueda,
      columnas,
      orden: { columna: 'monto', direccion: 'desc' },
    });
    expect(resDesc[resDesc.length - 1]?.id).toBe(4);
  });

  it('filtra por busqueda ignorando tildes y mayusculas', () => {
    const res = filtrarYOrdenar(filasPrueba, {
      busqueda: 'nunez',
      camposBusqueda,
      columnas,
      orden: null,
    });
    expect(res.map((r) => r.nombre)).toEqual(['Nicolás Núñez']);
  });

  it('siguienteOrden conmuta correctamente entre asc y desc y reinicia al cambiar de columna', () => {
    expect(siguienteOrden(null, 'nombre')).toEqual({
      columna: 'nombre',
      direccion: 'asc',
    });
    expect(siguienteOrden({ columna: 'nombre', direccion: 'asc' }, 'nombre')).toEqual({
      columna: 'nombre',
      direccion: 'desc',
    });
    expect(siguienteOrden({ columna: 'nombre', direccion: 'desc' }, 'nombre')).toEqual({
      columna: 'nombre',
      direccion: 'asc',
    });
    expect(siguienteOrden({ columna: 'nombre', direccion: 'desc' }, 'monto')).toEqual({
      columna: 'monto',
      direccion: 'asc',
    });
  });

  it('atributoAriaSort entrega valores aria conformes', () => {
    expect(atributoAriaSort(null, 'nombre')).toBe('none');
    expect(atributoAriaSort({ columna: 'monto', direccion: 'asc' }, 'nombre')).toBe('none');
    expect(atributoAriaSort({ columna: 'nombre', direccion: 'asc' }, 'nombre')).toBe('ascending');
    expect(atributoAriaSort({ columna: 'nombre', direccion: 'desc' }, 'nombre')).toBe('descending');
  });

  it('compara booleanos ubicando true antes de false', () => {
    expect(compararValores(true, false)).toBeLessThan(0);
    expect(compararValores(false, true)).toBeGreaterThan(0);
    expect(compararValores(true, true)).toBe(0);
  });
});
