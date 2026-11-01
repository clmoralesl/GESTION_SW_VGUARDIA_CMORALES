import { describe, expect, it } from 'vitest';
import { costoPorEtapa, esquemaConsultaTablero, hojasFiltradas, type NodoFiltro } from './tablero';

const nodos: NodoFiltro[] = [
  { id: 1, padreId: null, inicioPlan: '2026-11-02', finPlan: '2026-11-20' },
  { id: 11, padreId: 1, inicioPlan: '2026-11-02', finPlan: '2026-11-06' },
  { id: 12, padreId: 1, inicioPlan: '2026-11-09', finPlan: '2026-11-20' },
  { id: 2, padreId: null, inicioPlan: '2026-11-23', finPlan: '2026-12-04' },
  { id: 20, padreId: 2, inicioPlan: '2026-11-23', finPlan: '2026-12-04' },
  { id: 21, padreId: 20, inicioPlan: '2026-11-23', finPlan: '2026-12-04' },
];

const asign = [
  { tareaId: 11, profesionalId: 7 },
  { tareaId: 12, profesionalId: 8 },
  { tareaId: 21, profesionalId: 7 },
];

const costosHoja = new Map([
  [11, { costoPlan: 500, costoReal: 450 }],
  [12, { costoPlan: 1000, costoReal: 520 }],
  [21, { costoPlan: 1500, costoReal: 0 }],
]);

describe('tablero', () => {
  it('sin filtros el costo por etapa iguala la consolidación del árbol', () => {
    const r = costoPorEtapa(nodos, costosHoja, hojasFiltradas(nodos, asign, {}));
    expect(r).toEqual([
      { etapaId: 1, costoPlan: 1500, costoReal: 970 },
      { etapaId: 2, costoPlan: 1500, costoReal: 0 },
    ]);
  });

  it('filtro por etapa incluye nietos y excluye otras etapas', () => {
    expect([...hojasFiltradas(nodos, asign, { etapaId: 2 })]).toEqual([21]);
  });

  it('filtros se combinan con intersección', () => {
    expect([...hojasFiltradas(nodos, asign, { profesionalId: 7 })].sort()).toEqual([11, 21]);
    expect([...hojasFiltradas(nodos, asign, { profesionalId: 7, etapaId: 1 })]).toEqual([11]);
    expect([...hojasFiltradas(nodos, asign, { desde: '2026-11-10', hasta: '2026-11-15' })]).toEqual(
      [12],
    );
  });

  it('filtro sin coincidencias da conjunto vacío y etapas vacías', () => {
    const vacias = hojasFiltradas(nodos, asign, { profesionalId: 99 });
    expect(vacias.size).toBe(0);
    expect(costoPorEtapa(nodos, costosHoja, vacias)).toEqual([]);
  });

  it('zod de la consulta del tablero', () => {
    expect(esquemaConsultaTablero.parse({ etapaId: '3', desde: '2026-11-01' })).toEqual({
      etapaId: 3,
      desde: '2026-11-01',
    });
    expect(
      esquemaConsultaTablero.safeParse({ desde: '2026-11-20', hasta: '2026-11-01' }).success,
    ).toBe(false);
    expect(esquemaConsultaTablero.safeParse({ desde: '2026-02-30' }).success).toBe(false);
    expect(esquemaConsultaTablero.safeParse({ etapaId: '0' }).success).toBe(false);
    expect(esquemaConsultaTablero.safeParse({ etapaId: 'abc' }).success).toBe(false);
    expect(esquemaConsultaTablero.safeParse({ fase: '1' }).success).toBe(false);
    expect(esquemaConsultaTablero.safeParse({ etapaId: '' }).success).toBe(false);
  });
});
