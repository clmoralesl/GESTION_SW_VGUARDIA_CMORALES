import {
  type ProfesionalResumen,
  type RecursoResumen,
  type TipoRecursoResumen,
} from '@autofix/core';
import { type Decimal } from '@prisma/client/runtime/library';

export interface ProfesionalConConteo {
  id: number;
  nombre: string;
  claveNombre: string;
  cargo: string;
  tarifaHora: Decimal | number;
  horasDiarias: Decimal | number;
  activo: boolean;
  _count?: { asignaciones: number };
}

export interface RecursoConTipoYConteo {
  id: number;
  nombre: string;
  claveNombre: string;
  tipoRecursoId: number;
  unidad: string;
  costoUnitario: Decimal | number;
  activo: boolean;
  tipoRecurso: { id: number; nombre: string };
  _count?: { asignaciones: number };
}

export interface TipoRecursoEntidad {
  id: number;
  nombre: string;
  descripcion: string | null;
}

export function mapearProfesional(p: ProfesionalConConteo): ProfesionalResumen {
  return {
    id: p.id,
    nombre: p.nombre,
    cargo: p.cargo,
    tarifaHora: Number(p.tarifaHora),
    horasDiarias: Number(p.horasDiarias),
    activo: p.activo,
    numeroAsignaciones: p._count?.asignaciones ?? 0,
  };
}

export function mapearRecurso(r: RecursoConTipoYConteo): RecursoResumen {
  return {
    id: r.id,
    nombre: r.nombre,
    tipoRecurso: {
      id: r.tipoRecurso.id,
      nombre: r.tipoRecurso.nombre,
    },
    unidad: r.unidad,
    costoUnitario: Number(r.costoUnitario),
    activo: r.activo,
    numeroAsignaciones: r._count?.asignaciones ?? 0,
  };
}

export function mapearTipoRecurso(t: TipoRecursoEntidad): TipoRecursoResumen {
  return {
    id: t.id,
    nombre: t.nombre,
    descripcion: t.descripcion,
  };
}

export function instantaneaProfesional(
  p: ProfesionalConConteo,
): Record<string, string | number | boolean | null> {
  return {
    nombre: p.nombre,
    cargo: p.cargo,
    tarifaHora: Number(p.tarifaHora),
    horasDiarias: Number(p.horasDiarias),
    activo: p.activo,
  };
}

export function instantaneaRecurso(
  r: RecursoConTipoYConteo,
): Record<string, string | number | boolean | null> {
  return {
    nombre: r.nombre,
    tipoRecurso: r.tipoRecurso.nombre,
    unidad: r.unidad,
    costoUnitario: Number(r.costoUnitario),
    activo: r.activo,
  };
}
