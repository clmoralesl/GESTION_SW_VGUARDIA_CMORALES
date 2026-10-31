import { coincideBusqueda } from '@autofix/core';

export type DireccionOrden = 'asc' | 'desc';
export type ValorOrdenable = string | number | boolean | null | undefined;

export interface Orden<C extends string> {
  columna: C;
  direccion: DireccionOrden;
}

export interface OpcionesTabla<T, C extends string> {
  busqueda: string;
  camposBusqueda: readonly ((fila: T) => string | null | undefined)[];
  columnas: Record<C, (fila: T) => ValorOrdenable>;
  orden: Orden<C> | null;
}

const COLADOR = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

const esVacio = (valor: ValorOrdenable): valor is null | undefined =>
  valor === null || valor === undefined || (typeof valor === 'number' && Number.isNaN(valor));

export function compararValores(
  a: string | number | boolean,
  b: string | number | boolean,
): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(b) - Number(a);
  return COLADOR.compare(String(a), String(b));
}

export function filtrarYOrdenar<T extends { id: number }, C extends string>(
  filas: readonly T[],
  { busqueda, camposBusqueda, columnas, orden }: OpcionesTabla<T, C>,
): T[] {
  const termino = busqueda.trim();
  const filtradas =
    termino === ''
      ? [...filas]
      : filas.filter((fila) =>
          camposBusqueda.some((campo) => coincideBusqueda(campo(fila) ?? '', termino)),
        );
  if (!orden) return filtradas;
  const valor = columnas[orden.columna];
  const signo = orden.direccion === 'asc' ? 1 : -1;
  return filtradas.sort((filaA, filaB) => {
    const a = valor(filaA);
    const b = valor(filaB);
    if (esVacio(a) || esVacio(b)) {
      if (esVacio(a) && esVacio(b)) return filaA.id - filaB.id;
      return esVacio(a) ? 1 : -1;
    }
    return signo * compararValores(a, b) || filaA.id - filaB.id;
  });
}

export function siguienteOrden<C extends string>(actual: Orden<C> | null, columna: C): Orden<C> {
  if (!actual || actual.columna !== columna) return { columna, direccion: 'asc' };
  return { columna, direccion: actual.direccion === 'asc' ? 'desc' : 'asc' };
}

export function atributoAriaSort<C extends string>(
  actual: Orden<C> | null,
  columna: C,
): 'ascending' | 'descending' | 'none' {
  if (!actual || actual.columna !== columna) return 'none';
  return actual.direccion === 'asc' ? 'ascending' : 'descending';
}
