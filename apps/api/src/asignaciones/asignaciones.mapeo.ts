import { redondearMonto, type AsignacionResumen } from '@autofix/core';
import type { Asignacion, Profesional, Recurso, TipoRecurso } from '@prisma/client';

export type AsignacionConRelaciones = Asignacion & {
  profesional?: Profesional | null;
  recurso?: (Recurso & { tipoRecurso?: TipoRecurso | null }) | null;
};

export function mapearAsignacion(a: AsignacionConRelaciones): AsignacionResumen {
  let costoPlan = 0;
  let costoReal = 0;

  if (a.profesionalId !== null && a.tarifaAplicada !== null) {
    const tarifa = Number(a.tarifaAplicada);
    costoPlan = redondearMonto((a.horasPlan !== null ? Number(a.horasPlan) : 0) * tarifa);
    costoReal = redondearMonto((a.horasReales !== null ? Number(a.horasReales) : 0) * tarifa);
  } else if (a.recursoId !== null && a.costoUnitarioAplicado !== null) {
    const costoUnitario = Number(a.costoUnitarioAplicado);
    costoPlan = redondearMonto(
      (a.cantidadPlan !== null ? Number(a.cantidadPlan) : 0) * costoUnitario,
    );
    costoReal = redondearMonto(
      (a.cantidadReal !== null ? Number(a.cantidadReal) : 0) * costoUnitario,
    );
  }

  return {
    id: a.id,
    tareaId: a.tareaId,
    profesionalId: a.profesionalId,
    recursoId: a.recursoId,
    dedicacion: a.dedicacion !== null ? Number(a.dedicacion) : null,
    horasPlan: a.horasPlan !== null ? Number(a.horasPlan) : null,
    horasPlanManual: a.horasPlanManual,
    horasReales: a.horasReales !== null ? Number(a.horasReales) : null,
    tarifaAplicada: a.tarifaAplicada !== null ? Number(a.tarifaAplicada) : null,
    cantidadPlan: a.cantidadPlan !== null ? Number(a.cantidadPlan) : null,
    cantidadReal: a.cantidadReal !== null ? Number(a.cantidadReal) : null,
    costoUnitarioAplicado:
      a.costoUnitarioAplicado !== null ? Number(a.costoUnitarioAplicado) : null,
    costoPlan,
    costoReal,
    profesional: a.profesional
      ? {
          id: a.profesional.id,
          nombre: a.profesional.nombre,
          cargo: a.profesional.cargo,
          activo: a.profesional.activo,
          tarifaHora: Number(a.profesional.tarifaHora),
          horasDiarias: Number(a.profesional.horasDiarias),
        }
      : null,
    recurso: a.recurso
      ? {
          id: a.recurso.id,
          nombre: a.recurso.nombre,
          activo: a.recurso.activo,
          costoUnitario: Number(a.recurso.costoUnitario),
          unidad: a.recurso.unidad,
          tipoRecurso: a.recurso.tipoRecurso
            ? {
                id: a.recurso.tipoRecurso.id,
                nombre: a.recurso.tipoRecurso.nombre,
              }
            : null,
        }
      : null,
  };
}

export function instantaneaAsignacion(
  a: AsignacionConRelaciones,
): Record<string, string | number | boolean | null> {
  return {
    tareaId: a.tareaId,
    profesionalId: a.profesionalId,
    recursoId: a.recursoId,
    dedicacion: a.dedicacion !== null ? Number(a.dedicacion) : null,
    horasPlan: a.horasPlan !== null ? Number(a.horasPlan) : null,
    horasPlanManual: a.horasPlanManual,
    horasReales: a.horasReales !== null ? Number(a.horasReales) : null,
    tarifaAplicada: a.tarifaAplicada !== null ? Number(a.tarifaAplicada) : null,
    cantidadPlan: a.cantidadPlan !== null ? Number(a.cantidadPlan) : null,
    cantidadReal: a.cantidadReal !== null ? Number(a.cantidadReal) : null,
    costoUnitarioAplicado:
      a.costoUnitarioAplicado !== null ? Number(a.costoUnitarioAplicado) : null,
  };
}
