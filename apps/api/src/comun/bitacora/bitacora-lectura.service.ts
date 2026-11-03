import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  derivarOrigen,
  rangoFechasBitacora,
  type AccionBitacora,
  type ConsultaBitacora,
  type ParametrosPaginacion,
  type RegistroBitacora,
  type RespuestaBitacora,
} from '@autofix/core';
import { ExcepcionApi } from '../errores/excepcion-api';
import { PrismaService } from '../../prisma/prisma.service';
import { ROL_BD, ROL_DESDE_BD } from '../roles/rol-bd';

@Injectable()
export class BitacoraLecturaService {
  constructor(private readonly prisma: PrismaService) {}

  async consultar(c: ConsultaBitacora): Promise<RespuestaBitacora> {
    const where: Prisma.BitacoraWhereInput = {
      ...(c.proyectoId !== undefined ? { proyectoId: c.proyectoId } : {}),
      ...(c.entidad !== undefined ? { entidad: c.entidad } : {}),
      ...(c.entidadId !== undefined ? { entidadId: c.entidadId } : {}),
      ...(c.rol !== undefined ? { rol: ROL_BD[c.rol] } : {}),
      ...(c.accion !== undefined ? { accion: c.accion } : {}),
      ...(c.desde !== undefined || c.hasta !== undefined
        ? { fecha: rangoFechasBitacora(c.desde, c.hasta) }
        : {}),
    };

    const [total, filas] = await this.prisma.$transaction([
      this.prisma.bitacora.count({ where }),
      this.prisma.bitacora.findMany({
        where,
        orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
        skip: (c.pagina - 1) * c.tamanoPagina,
        take: c.tamanoPagina,
        include: { solicitudCambio: { select: { codigo: true } } },
      }),
    ]);

    const registros: RegistroBitacora[] = filas.map((fila) => ({
      id: fila.id,
      proyectoId: fila.proyectoId,
      fecha: fila.fecha.toISOString(),
      rol: fila.rol ? ROL_DESDE_BD[fila.rol] : null,
      entidad: fila.entidad,
      entidadId: fila.entidadId,
      accion: fila.accion as AccionBitacora,
      campo: fila.campo,
      valorAnterior: fila.valorAnterior,
      valorNuevo: fila.valorNuevo,
      origen: derivarOrigen({
        accion: fila.accion,
        solicitudCambioId: fila.solicitudCambioId,
        solicitudCambioCodigo: fila.solicitudCambio?.codigo,
        origen: fila.origen,
      }),
    }));

    const totalPaginas = total === 0 ? 0 : Math.ceil(total / c.tamanoPagina);

    return {
      registros,
      total,
      pagina: c.pagina,
      tamanoPagina: c.tamanoPagina,
      totalPaginas,
    };
  }

  async obtenerHistorialSolicitud(
    solicitudId: number,
    paginacion: ParametrosPaginacion,
  ): Promise<RespuestaBitacora> {
    const solicitud = await this.prisma.solicitudCambio.findUnique({
      where: { id: solicitudId },
      select: {
        id: true,
        etapas: {
          select: {
            id: true,
            evidencias: { select: { id: true } },
            acciones: { select: { id: true } },
          },
        },
        impactos: { select: { id: true } },
      },
    });

    if (!solicitud) {
      throw new ExcepcionApi(
        HttpStatus.NOT_FOUND,
        'RECURSO_NO_ENCONTRADO',
        'La solicitud de cambio no existe.',
      );
    }

    const etapaIds = solicitud.etapas.map((e) => e.id);
    const impactoIds = solicitud.impactos.map((i) => i.id);
    const evidenciaIds = solicitud.etapas.flatMap((e) => e.evidencias.map((ev) => ev.id));
    const accionIds = solicitud.etapas.flatMap((e) => e.acciones.map((ac) => ac.id));

    const condicionesOr: Prisma.BitacoraWhereInput[] = [
      { solicitudCambioId: solicitudId },
      { entidad: 'SolicitudCambio', entidadId: solicitudId },
    ];
    if (etapaIds.length > 0) {
      condicionesOr.push({ entidad: 'EtapaCambio', entidadId: { in: etapaIds } });
    }
    if (impactoIds.length > 0) {
      condicionesOr.push({ entidad: 'ImpactoCambio', entidadId: { in: impactoIds } });
    }
    if (evidenciaIds.length > 0) {
      condicionesOr.push({ entidad: 'Evidencia', entidadId: { in: evidenciaIds } });
    }
    if (accionIds.length > 0) {
      condicionesOr.push({ entidad: 'AccionCorrectiva', entidadId: { in: accionIds } });
    }

    const where: Prisma.BitacoraWhereInput = {
      OR: condicionesOr,
    };

    const [total, filas] = await this.prisma.$transaction([
      this.prisma.bitacora.count({ where }),
      this.prisma.bitacora.findMany({
        where,
        orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
        skip: (paginacion.pagina - 1) * paginacion.tamanoPagina,
        take: paginacion.tamanoPagina,
        include: { solicitudCambio: { select: { codigo: true } } },
      }),
    ]);

    const registros: RegistroBitacora[] = filas.map((fila) => ({
      id: fila.id,
      proyectoId: fila.proyectoId,
      fecha: fila.fecha.toISOString(),
      rol: fila.rol ? ROL_DESDE_BD[fila.rol] : null,
      entidad: fila.entidad,
      entidadId: fila.entidadId,
      accion: fila.accion as AccionBitacora,
      campo: fila.campo,
      valorAnterior: fila.valorAnterior,
      valorNuevo: fila.valorNuevo,
      origen: derivarOrigen({
        accion: fila.accion,
        solicitudCambioId: fila.solicitudCambioId,
        solicitudCambioCodigo: fila.solicitudCambio?.codigo,
        origen: fila.origen,
      }),
    }));

    const totalPaginas = total === 0 ? 0 : Math.ceil(total / paginacion.tamanoPagina);

    return {
      registros,
      total,
      pagina: paginacion.pagina,
      tamanoPagina: paginacion.tamanoPagina,
      totalPaginas,
    };
  }
}
