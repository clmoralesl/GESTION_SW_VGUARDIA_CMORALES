import { Injectable } from '@nestjs/common';
import { AccionBitacora, Prisma } from '@prisma/client';
import type { Rol } from '@autofix/core';
import { ROL_BD } from '../roles/rol-bd';
import { CambioCampo, ValorBitacora } from './diferencias';

export interface ContextoBitacora {
  proyectoId: number | null;
  entidad: string;
  entidadId: number;
  rol: Rol;
  solicitudCambioId?: number | null;
}

const aJson = (
  valor: ValorBitacora | Record<string, ValorBitacora>,
): Prisma.InputJsonValue | typeof Prisma.DbNull =>
  valor === null ? Prisma.DbNull : (valor as Prisma.InputJsonValue);

@Injectable()
export class BitacoraService {
  async registrarCambios(
    tx: Prisma.TransactionClient,
    contexto: ContextoBitacora,
    accion: AccionBitacora,
    cambios: readonly CambioCampo[],
    origen?: string,
  ): Promise<void> {
    if (cambios.length === 0) return;
    await tx.bitacora.createMany({
      data: cambios.map((cambio) => ({
        proyectoId: contexto.proyectoId,
        entidad: contexto.entidad,
        entidadId: contexto.entidadId,
        rol: ROL_BD[contexto.rol],
        accion,
        campo: cambio.campo,
        valorAnterior: aJson(cambio.anterior),
        valorNuevo: aJson(cambio.nuevo),
        origen,
        ...(contexto.solicitudCambioId !== undefined
          ? { solicitudCambioId: contexto.solicitudCambioId }
          : {}),
      })),
    });
  }

  async registrarCreacion(
    tx: Prisma.TransactionClient,
    contexto: ContextoBitacora,
    instantanea: Record<string, ValorBitacora>,
  ): Promise<void> {
    await tx.bitacora.create({
      data: {
        proyectoId: contexto.proyectoId,
        entidad: contexto.entidad,
        entidadId: contexto.entidadId,
        rol: ROL_BD[contexto.rol],
        accion: AccionBitacora.CREAR,
        valorNuevo: aJson(instantanea),
        ...(contexto.solicitudCambioId !== undefined
          ? { solicitudCambioId: contexto.solicitudCambioId }
          : {}),
      },
    });
  }

  async registrarEliminacion(
    tx: Prisma.TransactionClient,
    contexto: ContextoBitacora,
    instantanea: Record<string, ValorBitacora>,
  ): Promise<void> {
    await tx.bitacora.create({
      data: {
        proyectoId: contexto.proyectoId,
        entidad: contexto.entidad,
        entidadId: contexto.entidadId,
        rol: ROL_BD[contexto.rol],
        accion: AccionBitacora.ELIMINAR,
        valorAnterior: aJson(instantanea),
        ...(contexto.solicitudCambioId !== undefined
          ? { solicitudCambioId: contexto.solicitudCambioId }
          : {}),
      },
    });
  }

  async registrarRecalculo(
    tx: Prisma.TransactionClient,
    contexto: ContextoBitacora,
    detalle: Record<string, ValorBitacora>,
    origen: string,
  ): Promise<void> {
    await tx.bitacora.create({
      data: {
        proyectoId: contexto.proyectoId,
        entidad: contexto.entidad,
        entidadId: contexto.entidadId,
        rol: ROL_BD[contexto.rol],
        accion: AccionBitacora.RECALCULAR,
        valorNuevo: aJson(detalle),
        origen,
        ...(contexto.solicitudCambioId !== undefined
          ? { solicitudCambioId: contexto.solicitudCambioId }
          : {}),
      },
    });
  }
}
