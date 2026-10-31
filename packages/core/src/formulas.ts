import { create, parseDependencies, type MathNode } from 'mathjs';

const math = create(parseDependencies ?? {});

export const LONGITUD_MAXIMA_FORMULA = 500;
export const PROFUNDIDAD_MAXIMA_FORMULA = 25;
export const NODOS_MAXIMOS_FORMULA = 200;

export const FUNCIONES_PERMITIDAS = {
  min: { aridadMin: 1, aridadMax: 20 },
  max: { aridadMin: 1, aridadMax: 20 },
  abs: { aridadMin: 1, aridadMax: 1 },
  round: { aridadMin: 1, aridadMax: 2 },
} as const;

type Funcion = keyof typeof FUNCIONES_PERMITIDAS;

const OPERADORES = {
  add: '+',
  subtract: '-',
  multiply: '*',
  divide: '/',
  unaryMinus: '-u',
  unaryPlus: '+u',
  larger: '>',
  smaller: '<',
  largerEq: '>=',
  smallerEq: '<=',
  equal: '==',
  unequal: '!=',
} as const;

type Operador = (typeof OPERADORES)[keyof typeof OPERADORES];

export type NodoFormula =
  | { t: 'num'; v: number }
  | { t: 'var'; n: string }
  | { t: 'op'; o: Operador; a: NodoFormula[] }
  | { t: 'fn'; f: Funcion; a: NodoFormula[] }
  | { t: 'si'; c: NodoFormula; s: NodoFormula; n: NodoFormula };

export type CodigoErrorFormula =
  | 'FORMULA_VACIA'
  | 'FORMULA_DEMASIADO_LARGA'
  | 'FORMULA_DEMASIADO_COMPLEJA'
  | 'SINTAXIS_INVALIDA'
  | 'VARIABLE_DESCONOCIDA'
  | 'FUNCION_NO_PERMITIDA'
  | 'ELEMENTO_NO_PERMITIDO';

export interface ErrorFormula {
  codigo: CodigoErrorFormula;
  mensaje: string;
  simbolo?: string;
}

export type AnalisisFormula =
  | { valida: true; arbol: NodoFormula; variables: string[] }
  | { valida: false; errores: ErrorFormula[] };

class Rechazo extends Error {
  constructor(readonly detalle: ErrorFormula) {
    super(detalle.mensaje);
  }
}

function rechazar(codigo: CodigoErrorFormula, mensaje: string, simbolo?: string): never {
  throw new Rechazo(simbolo === undefined ? { codigo, mensaje } : { codigo, mensaje, simbolo });
}

export function analizarFormula(
  texto: string,
  variablesValidas: ReadonlySet<string>,
): AnalisisFormula {
  const limpio = texto.trim();
  if (limpio === '') {
    return {
      valida: false,
      errores: [{ codigo: 'FORMULA_VACIA', mensaje: 'La fórmula está vacía.' }],
    };
  }
  if (limpio.length > LONGITUD_MAXIMA_FORMULA) {
    return {
      valida: false,
      errores: [
        {
          codigo: 'FORMULA_DEMASIADO_LARGA',
          mensaje: `La fórmula supera ${LONGITUD_MAXIMA_FORMULA} caracteres.`,
        },
      ],
    };
  }
  let raiz: MathNode;
  try {
    raiz = math.parse(limpio);
  } catch (e) {
    const car = (e as { char?: number }).char;
    return {
      valida: false,
      errores: [
        {
          codigo: 'SINTAXIS_INVALIDA',
          mensaje:
            car === undefined
              ? 'La sintaxis de la fórmula no es válida.'
              : `La sintaxis no es válida cerca del carácter ${car}.`,
        },
      ],
    };
  }
  const errores: ErrorFormula[] = [];
  const usadas = new Set<string>();
  let nodos = 0;
  const convertir = (nodo: MathNode, prof: number): NodoFormula => {
    nodos += 1;
    if (prof > PROFUNDIDAD_MAXIMA_FORMULA || nodos > NODOS_MAXIMOS_FORMULA) {
      return rechazar('FORMULA_DEMASIADO_COMPLEJA', 'La fórmula es demasiado compleja.');
    }
    const n = nodo as MathNode & Record<string, unknown>;
    switch (nodo.type) {
      case 'ConstantNode':
        if (typeof n.value !== 'number' || !Number.isFinite(n.value)) {
          return rechazar('ELEMENTO_NO_PERMITIDO', 'Solo se permiten constantes numéricas.');
        }
        return { t: 'num', v: n.value as number };
      case 'SymbolNode': {
        const nombre = n.name as string;
        if (!variablesValidas.has(nombre)) {
          errores.push({
            codigo: 'VARIABLE_DESCONOCIDA',
            mensaje: `La variable ${nombre} no existe.`,
            simbolo: nombre,
          });
        }
        usadas.add(nombre);
        return { t: 'var', n: nombre };
      }
      case 'ParenthesisNode':
        return convertir(n.content as MathNode, prof + 1);
      case 'OperatorNode': {
        const o = OPERADORES[n.fn as keyof typeof OPERADORES];
        if (o === undefined || n.implicit === true) {
          return rechazar(
            'ELEMENTO_NO_PERMITIDO',
            `El operador ${String(n.op)} no está permitido.`,
            String(n.op),
          );
        }
        return { t: 'op', o, a: (n.args as MathNode[]).map((x) => convertir(x, prof + 1)) };
      }
      case 'FunctionNode': {
        const fn = n.fn as MathNode & { name?: string };
        const nombre = fn.type === 'SymbolNode' ? (fn.name ?? '') : '';
        const regla = Object.hasOwn(FUNCIONES_PERMITIDAS, nombre)
          ? FUNCIONES_PERMITIDAS[nombre as Funcion]
          : undefined;
        if (!regla) {
          return rechazar(
            'FUNCION_NO_PERMITIDA',
            `La función ${nombre || '(expresión)'} no está permitida.`,
            nombre || undefined,
          );
        }
        const args = n.args as MathNode[];
        if (args.length < regla.aridadMin || args.length > regla.aridadMax) {
          return rechazar(
            'FUNCION_NO_PERMITIDA',
            `La función ${nombre} recibe una cantidad de argumentos no válida.`,
            nombre,
          );
        }
        return { t: 'fn', f: nombre as Funcion, a: args.map((x) => convertir(x, prof + 1)) };
      }
      case 'ConditionalNode':
        return {
          t: 'si',
          c: convertir(n.condition as MathNode, prof + 1),
          s: convertir(n.trueExpr as MathNode, prof + 1),
          n: convertir(n.falseExpr as MathNode, prof + 1),
        };
      default:
        return rechazar(
          'ELEMENTO_NO_PERMITIDO',
          'La fórmula contiene un elemento no permitido.',
          nodo.type,
        );
    }
  };
  try {
    const arbol = convertir(raiz, 1);
    if (errores.length > 0) return { valida: false, errores };
    return { valida: true, arbol, variables: [...usadas].sort() };
  } catch (e) {
    if (e instanceof Rechazo) return { valida: false, errores: [...errores, e.detalle] };
    throw e;
  }
}

export type ValoresVariables = Readonly<Record<string, number | null>>;

export function evaluarArbol(nodo: NodoFormula, valores: ValoresVariables): number | null {
  const ev = (x: NodoFormula) => evaluarArbol(x, valores);
  switch (nodo.t) {
    case 'num':
      return nodo.v;
    case 'var': {
      const v = Object.hasOwn(valores, nodo.n) ? valores[nodo.n] : null;
      return v === null || v === undefined || !Number.isFinite(v) ? null : v;
    }
    case 'si': {
      const c = ev(nodo.c);
      if (c === null) return null;
      return c !== 0 ? ev(nodo.s) : ev(nodo.n);
    }
    case 'fn': {
      const args: number[] = [];
      for (const sub of nodo.a) {
        const v = ev(sub);
        if (v === null) return null;
        args.push(v);
      }
      if (nodo.f === 'min') return Math.min(...args);
      if (nodo.f === 'max') return Math.max(...args);
      const primero = args[0];
      if (primero === undefined) return null;
      if (nodo.f === 'abs') return Math.abs(primero);
      const dec = args[1] ?? 0;
      if (!Number.isInteger(dec) || dec < 0 || dec > 6) return null;
      return Math.round(primero * 10 ** dec) / 10 ** dec;
    }
    case 'op': {
      const args: number[] = [];
      for (const sub of nodo.a) {
        const v = ev(sub);
        if (v === null) return null;
        args.push(v);
      }
      const x = args[0];
      if (x === undefined) return null;
      if (nodo.o === '-u') return -x;
      if (nodo.o === '+u') return x;
      const y = args[1];
      if (y === undefined) return null;
      let r: number;
      switch (nodo.o) {
        case '+':
          r = x + y;
          break;
        case '-':
          r = x - y;
          break;
        case '*':
          r = x * y;
          break;
        case '/':
          if (y === 0) return null;
          r = x / y;
          break;
        case '>':
          r = x > y ? 1 : 0;
          break;
        case '<':
          r = x < y ? 1 : 0;
          break;
        case '>=':
          r = x >= y ? 1 : 0;
          break;
        case '<=':
          r = x <= y ? 1 : 0;
          break;
        case '==':
          r = x === y ? 1 : 0;
          break;
        case '!=':
          r = x !== y ? 1 : 0;
          break;
      }
      return Number.isFinite(r) ? r : null;
    }
  }
}

export function evaluarFormula(
  texto: string,
  variablesValidas: ReadonlySet<string>,
  valores: ValoresVariables,
) {
  const analisis = analizarFormula(texto, variablesValidas);
  if (!analisis.valida) return analisis;
  return { ...analisis, valor: evaluarArbol(analisis.arbol, valores) };
}
