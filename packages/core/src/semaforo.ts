export type Semaforo = 'VERDE' | 'AMARILLO' | 'ROJO';
export type Direccion = 'MAYOR_MEJOR' | 'MENOR_MEJOR';

export interface UmbralesKpi {
  verde: number | null;
  amarillo: number | null;
}

const a4 = (v: number) => Math.round(v * 10_000) / 10_000;

export function validarUmbrales(direccion: Direccion, u: UmbralesKpi): string | null {
  if (u.verde === null && u.amarillo !== null) {
    return 'El umbral amarillo requiere un umbral verde.';
  }
  if (u.verde === null || u.amarillo === null) return null;
  if (direccion === 'MAYOR_MEJOR' && u.amarillo > u.verde) {
    return 'Con mayor es mejor, el umbral amarillo no puede superar al verde.';
  }
  if (direccion === 'MENOR_MEJOR' && u.amarillo < u.verde) {
    return 'Con menor es mejor, el umbral amarillo no puede ser menor que el verde.';
  }
  return null;
}

export function calcularSemaforo(
  valor: number | null,
  direccion: Direccion,
  u: UmbralesKpi,
): Semaforo | null {
  if (valor === null || u.verde === null) return null;
  const v = a4(valor);
  const cumple = (cota: number) => (direccion === 'MAYOR_MEJOR' ? v >= cota : v <= cota);
  if (cumple(u.verde)) return 'VERDE';
  if (u.amarillo !== null && cumple(u.amarillo)) return 'AMARILLO';
  return 'ROJO';
}
