import { formatearMonto, type Semaforo, type UnidadKpi } from '@autofix/core';

export function formatearValorKpi(valor: number | null | undefined, unidad: UnidadKpi): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) {
    return 'N/D';
  }

  switch (unidad) {
    case 'PORCENTAJE':
      return `${valor.toLocaleString('es-CL', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 2,
      })}%`;
    case 'INDICE':
      return valor.toLocaleString('es-CL', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
      });
    case 'CLP':
      return formatearMonto(valor);
    case 'DIAS':
      return `${valor.toLocaleString('es-CL', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 1,
      })} d`;
    case 'NUMERO':
      return valor.toLocaleString('es-CL', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
    default:
      return String(valor);
  }
}

export function obtenerColorSemaforo(
  semaforo: Semaforo | null | undefined,
): 'green' | 'yellow' | 'red' | 'gray' {
  switch (semaforo) {
    case 'VERDE':
      return 'green';
    case 'AMARILLO':
      return 'yellow';
    case 'ROJO':
      return 'red';
    default:
      return 'gray';
  }
}

export function obtenerEtiquetaSemaforo(
  semaforo: Semaforo | null | undefined,
  valor?: number | null,
): string {
  switch (semaforo) {
    case 'VERDE':
      return 'Verde';
    case 'AMARILLO':
      return 'Amarillo';
    case 'ROJO':
      return 'Rojo';
    default:
      if (valor !== null && valor !== undefined && !Number.isNaN(valor)) {
        return 'Sin umbral';
      }
      return 'N/D';
  }
}

export function formatearUnidadKpi(unidad: UnidadKpi): string {
  switch (unidad) {
    case 'PORCENTAJE':
      return 'Porcentaje';
    case 'INDICE':
      return 'Índice';
    case 'DIAS':
      return 'Días';
    case 'CLP':
      return 'CLP';
    case 'NUMERO':
      return 'Número';
    default:
      return unidad;
  }
}
