import { Prisma } from '@prisma/client';
import {
  diasHabilesEntre,
  type CalendarioLaboral,
  type DatosCalculoVariablesCambio,
  type LineaBaseCambioItem,
  type SolicitudCambioItem,
} from '@autofix/core';
import type { PrismaService } from '../prisma/prisma.service';

export type ClientePrismaKpi = PrismaService | Prisma.TransactionClient;

export async function cargarDatosVariablesCambio(
  cliente: ClientePrismaKpi,
  proyectoId: number,
  calendario: CalendarioLaboral,
  corte: string,
): Promise<DatosCalculoVariablesCambio> {
  const tx = cliente as Prisma.TransactionClient;

  const solicitudesDb = await tx.solicitudCambio.findMany({
    where: { proyectoId },
    orderBy: { id: 'asc' },
    include: {
      etapas: {
        orderBy: { numero: 'asc' },
        include: {
          acciones: {
            select: { estado: true },
          },
        },
      },
    },
  });

  const lineasBaseDb = await tx.lineaBase.findMany({
    where: { proyectoId },
    select: {
      version: true,
      costoPlanTotal: true,
      fechaFinProyecto: true,
      solicitudCambioId: true,
    },
    orderBy: { version: 'asc' },
  });

  const solicitudes: SolicitudCambioItem[] = solicitudesDb.map((s) => ({
    id: s.id,
    codigo: s.codigo,
    estado: s.estado,
    fechaRegistro: s.fechaRegistro.toISOString(),
    fechaDecision: s.fechaDecision ? s.fechaDecision.toISOString() : null,
    fechaCierre: s.fechaCierre ? s.fechaCierre.toISOString() : null,
    probabilidadRiesgo: s.probabilidadRiesgo,
    impactoRiesgo: s.impactoRiesgo,
    etapas: s.etapas.map((e) => ({
      id: e.id,
      numero: e.numero,
      estado: e.estado,
      fechaInicio: e.fechaInicio ? e.fechaInicio.toISOString() : null,
      fechaFin: e.fechaFin ? e.fechaFin.toISOString() : null,
      fechaIniciada: e.fechaIniciada ? e.fechaIniciada.toISOString() : null,
      fechaCompletada: e.fechaCompletada ? e.fechaCompletada.toISOString() : null,
      porcentajeAdopcion: e.porcentajeAdopcion !== null ? Number(e.porcentajeAdopcion) : null,
      acciones: e.acciones.map((a) => ({
        estado: a.estado,
      })),
    })),
  }));

  const lineasBase: LineaBaseCambioItem[] = lineasBaseDb.map((lb) => ({
    version: lb.version,
    costoPlanTotal: Number(lb.costoPlanTotal),
    fechaFinProyecto: lb.fechaFinProyecto ? lb.fechaFinProyecto.toISOString() : null,
    solicitudCambioId: lb.solicitudCambioId,
  }));

  return {
    solicitudes,
    lineasBase,
    corte,
    diasHabilesEntre: (desdeIso: string, hastaIso: string) =>
      diasHabilesEntre(desdeIso, hastaIso, calendario),
  };
}
