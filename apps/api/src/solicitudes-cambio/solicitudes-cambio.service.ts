import { HttpStatus, Injectable } from '@nestjs/common';
import {
  AccionBitacora,
  CategoriaCambio as CategoriaCambioPrisma,
  EstadoAccion as EstadoAccionPrisma,
  EstadoEtapa as EstadoEtapaPrisma,
  EstadoSolicitud as EstadoSolicitudPrisma,
  Prioridad as PrioridadPrisma,
  Prisma,
} from '@prisma/client';
import {
  aplicarAccionEtapa,
  dateAFechaIso,
  duracionRealDias,
  ErrorArchivoEvidencia,
  ErrorTransicion,
  extraerExtension,
  fechaIsoADate,
  NOMBRES_ETAPAS,
  nivelRiesgo,
  sanearNombreArchivo,
  siguienteCodigo,
  validarArchivoEvidencia,
  type CategoriaCambio,
  type EntradaActualizarAccionCorrectiva,
  type EntradaActualizarEtapa,
  type EntradaActualizarSolicitud,
  type EntradaCrearAccionCorrectiva,
  type EntradaCrearSolicitud,
  type EstadoAccion,
  type EstadoEtapa,
  type EstadoSolicitud,
  type NivelRiesgo,
  type PrioridadSolicitud,
  type EntradaCrearImpacto,
  type EntradaRechazarSolicitud,
  type ResultadoSimulacion,
  type Rol,
  type TipoAccionEtapa,
} from '@autofix/core';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { BitacoraService } from '../comun/bitacora/bitacora.service';
import { diferencias } from '../comun/bitacora/diferencias';
import { ExcepcionApi } from '../comun/errores/excepcion-api';
import { Reloj } from '../comun/reloj/reloj';
import { ROL_BD } from '../comun/roles/rol-bd';
import { PrismaService } from '../prisma/prisma.service';
import { obtenerProyectoAbierto } from '../proyectos/proyecto-abierto';
import { PasoKpi } from '../recalculo/paso-kpi';
import { CambioAplicadorService, type DetalleImpacto } from './cambio-aplicador.service';

const ESTADOS_TERMINALES_SOLICITUD: readonly EstadoSolicitudPrisma[] = [
  EstadoSolicitudPrisma.RECHAZADA,
  EstadoSolicitudPrisma.CERRADA,
];

export interface DetalleAccionCorrectiva {
  id: number;
  etapaId: number;
  descripcion: string;
  responsable: string;
  fechaCompromiso: string;
  fechaCierre: string | null;
  estado: EstadoAccion;
}

export interface ArchivoSubido {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface DetalleEvidencia {
  id: number;
  etapaId: number;
  nombreArchivo: string;
  tipoMime: string;
  tamanoBytes: number;
  subidoPor: Rol;
  subidoEn: string;
}

export interface DetalleEtapaCambio {
  id: number;
  solicitudId: number;
  numero: number;
  nombre: string;
  responsable: string | null;
  estado: EstadoEtapa;
  fechaInicio: string | null;
  fechaFin: string | null;
  fechaIniciada: string | null;
  fechaCompletada: string | null;
  duracionRealDias: number | null;
  comentario: string | null;
  porcentajeAdopcion: number | null;
  evidencias: DetalleEvidencia[];
  acciones: DetalleAccionCorrectiva[];
}

export interface DetalleSolicitudCambio {
  id: number;
  proyectoId: number;
  codigo: string;
  titulo: string;
  descripcion: string;
  justificacion: string;
  solicitante: string;
  responsable: string;
  prioridad: PrioridadSolicitud;
  categoria: CategoriaCambio;
  probabilidadRiesgo: number;
  impactoRiesgo: number;
  nivelRiesgo: NivelRiesgo;
  estado: EstadoSolicitud;
  etapaActual: number;
  motivoRechazo: string | null;
  fechaRegistro: string;
  fechaDecision: string | null;
  fechaCierre: string | null;
  actualizadoEn: string;
  etapas: DetalleEtapaCambio[];
}

@Injectable()
export class SolicitudesCambioService {
  private readonly rutaUploads: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly bitacora: BitacoraService,
    private readonly reloj: Reloj,
    private readonly aplicador: CambioAplicadorService,
    private readonly pasoKpi: PasoKpi,
  ) {
    this.rutaUploads = process.env.RUTA_UPLOADS || path.resolve(process.cwd(), 'uploads');
  }

  private async asegurarDirectorioUploads(): Promise<void> {
    await fs.mkdir(this.rutaUploads, { recursive: true });
  }

  private mapearAccion(a: {
    id: number;
    etapaId: number;
    descripcion: string;
    responsable: string;
    fechaCompromiso: Date;
    fechaCierre: Date | null;
    estado: EstadoAccionPrisma;
  }): DetalleAccionCorrectiva {
    return {
      id: a.id,
      etapaId: a.etapaId,
      descripcion: a.descripcion,
      responsable: a.responsable,
      fechaCompromiso: dateAFechaIso(a.fechaCompromiso),
      fechaCierre: a.fechaCierre ? dateAFechaIso(a.fechaCierre) : null,
      estado: a.estado as EstadoAccion,
    };
  }

  private mapearEvidencia(e: {
    id: number;
    etapaId: number;
    nombreArchivo: string;
    tipoMime: string;
    tamanoBytes: number;
    subidoPor: string;
    subidoEn: Date;
  }): DetalleEvidencia {
    return {
      id: e.id,
      etapaId: e.etapaId,
      nombreArchivo: e.nombreArchivo,
      tipoMime: e.tipoMime,
      tamanoBytes: e.tamanoBytes,
      subidoPor: e.subidoPor as Rol,
      subidoEn: e.subidoEn.toISOString(),
    };
  }

  private mapearEtapa(
    e: {
      id: number;
      solicitudId: number;
      numero: number;
      nombre: string;
      responsable: string | null;
      estado: EstadoEtapaPrisma;
      fechaInicio: Date | null;
      fechaFin: Date | null;
      fechaIniciada: Date | null;
      fechaCompletada: Date | null;
      comentario: string | null;
      porcentajeAdopcion: Prisma.Decimal | null;
      evidencias?: {
        id: number;
        etapaId: number;
        nombreArchivo: string;
        tipoMime: string;
        tamanoBytes: number;
        subidoPor: string;
        subidoEn: Date;
      }[];
      acciones?: {
        id: number;
        etapaId: number;
        descripcion: string;
        responsable: string;
        fechaCompromiso: Date;
        fechaCierre: Date | null;
        estado: EstadoAccionPrisma;
      }[];
    },
    hoy: string,
  ): DetalleEtapaCambio {
    const estadoEtapa = e.estado as EstadoEtapa;
    return {
      id: e.id,
      solicitudId: e.solicitudId,
      numero: e.numero,
      nombre: e.nombre,
      responsable: e.responsable,
      estado: estadoEtapa,
      fechaInicio: e.fechaInicio ? dateAFechaIso(e.fechaInicio) : null,
      fechaFin: e.fechaFin ? dateAFechaIso(e.fechaFin) : null,
      fechaIniciada: e.fechaIniciada ? dateAFechaIso(e.fechaIniciada) : null,
      fechaCompletada: e.fechaCompletada ? dateAFechaIso(e.fechaCompletada) : null,
      duracionRealDias: duracionRealDias(
        {
          estado: estadoEtapa,
          fechaIniciada: e.fechaIniciada,
          fechaCompletada: e.fechaCompletada,
        },
        hoy,
      ),
      comentario: e.comentario,
      porcentajeAdopcion: e.porcentajeAdopcion !== null ? Number(e.porcentajeAdopcion) : null,
      evidencias: (e.evidencias ?? []).map((ev) => this.mapearEvidencia(ev)),
      acciones: (e.acciones ?? []).map((ac) => this.mapearAccion(ac)),
    };
  }

  private mapearSolicitud(
    s: {
      id: number;
      proyectoId: number;
      codigo: string;
      titulo: string;
      descripcion: string;
      justificacion: string;
      solicitante: string;
      responsable: string;
      prioridad: PrioridadPrisma;
      categoria: CategoriaCambioPrisma;
      probabilidadRiesgo: number;
      impactoRiesgo: number;
      estado: EstadoSolicitudPrisma;
      etapaActual: number;
      motivoRechazo: string | null;
      fechaRegistro: Date;
      fechaDecision: Date | null;
      fechaCierre: Date | null;
      actualizadoEn: Date;
      etapas?: {
        id: number;
        solicitudId: number;
        numero: number;
        nombre: string;
        responsable: string | null;
        estado: EstadoEtapaPrisma;
        fechaInicio: Date | null;
        fechaFin: Date | null;
        fechaIniciada: Date | null;
        fechaCompletada: Date | null;
        comentario: string | null;
        porcentajeAdopcion: Prisma.Decimal | null;
        evidencias?: {
          id: number;
          etapaId: number;
          nombreArchivo: string;
          tipoMime: string;
          tamanoBytes: number;
          subidoPor: string;
          subidoEn: Date;
        }[];
        acciones?: {
          id: number;
          etapaId: number;
          descripcion: string;
          responsable: string;
          fechaCompromiso: Date;
          fechaCierre: Date | null;
          estado: EstadoAccionPrisma;
        }[];
      }[];
    },
    hoy: string,
  ): DetalleSolicitudCambio {
    const etapasOrdenadas = (s.etapas ?? [])
      .slice()
      .sort((a, b) => a.numero - b.numero)
      .map((e) => this.mapearEtapa(e, hoy));

    return {
      id: s.id,
      proyectoId: s.proyectoId,
      codigo: s.codigo,
      titulo: s.titulo,
      descripcion: s.descripcion,
      justificacion: s.justificacion,
      solicitante: s.solicitante,
      responsable: s.responsable,
      prioridad: s.prioridad as PrioridadSolicitud,
      categoria: s.categoria as CategoriaCambio,
      probabilidadRiesgo: s.probabilidadRiesgo,
      impactoRiesgo: s.impactoRiesgo,
      nivelRiesgo: nivelRiesgo(s.probabilidadRiesgo, s.impactoRiesgo),
      estado: s.estado as EstadoSolicitud,
      etapaActual: s.etapaActual,
      motivoRechazo: s.motivoRechazo,
      fechaRegistro: s.fechaRegistro.toISOString(),
      fechaDecision: s.fechaDecision ? s.fechaDecision.toISOString() : null,
      fechaCierre: s.fechaCierre ? s.fechaCierre.toISOString() : null,
      actualizadoEn: s.actualizadoEn.toISOString(),
      etapas: etapasOrdenadas,
    };
  }

  async listar(proyectoId: number): Promise<DetalleSolicitudCambio[]> {
    const hoy = this.reloj.hoy();
    const solicitudes = await this.prisma.solicitudCambio.findMany({
      where: { proyectoId },
      include: {
        etapas: {
          include: {
            evidencias: true,
            acciones: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    });

    return solicitudes.map((s) => this.mapearSolicitud(s, hoy));
  }

  async obtener(id: number): Promise<DetalleSolicitudCambio> {
    const hoy = this.reloj.hoy();
    const solicitud = await this.prisma.solicitudCambio.findUnique({
      where: { id },
      include: {
        etapas: {
          include: {
            evidencias: true,
            acciones: true,
          },
        },
      },
    });

    if (!solicitud) {
      throw new ExcepcionApi(
        HttpStatus.NOT_FOUND,
        'RECURSO_NO_ENCONTRADO',
        'La solicitud de cambio no existe.',
      );
    }

    return this.mapearSolicitud(solicitud, hoy);
  }

  async crear(
    proyectoId: number,
    datos: EntradaCrearSolicitud,
    rol: Rol,
  ): Promise<DetalleSolicitudCambio> {
    const hoy = this.reloj.hoy();
    return this.prisma.$transaction(async (tx) => {
      await obtenerProyectoAbierto(tx, proyectoId, { bloquear: true });

      const existentes = await tx.solicitudCambio.findMany({
        where: { proyectoId },
        select: { codigo: true },
      });
      const codigo = siguienteCodigo(existentes.map((e) => e.codigo));

      const creada = await tx.solicitudCambio.create({
        data: {
          proyectoId,
          codigo,
          titulo: datos.titulo,
          descripcion: datos.descripcion,
          justificacion: datos.justificacion,
          solicitante: datos.solicitante,
          responsable: datos.responsable,
          prioridad: datos.prioridad as PrioridadPrisma,
          categoria: datos.categoria as CategoriaCambioPrisma,
          probabilidadRiesgo: datos.probabilidadRiesgo,
          impactoRiesgo: datos.impactoRiesgo,
          estado: EstadoSolicitudPrisma.REGISTRADA,
          etapaActual: 1,
        },
      });

      const etapasData = Array.from({ length: 10 }, (_, i) => ({
        solicitudId: creada.id,
        numero: i + 1,
        nombre: NOMBRES_ETAPAS[i + 1] ?? `Etapa ${i + 1}`,
        estado: EstadoEtapaPrisma.PENDIENTE,
      }));

      await tx.etapaCambio.createMany({ data: etapasData });

      await this.bitacora.registrarCreacion(
        tx,
        {
          proyectoId,
          entidad: 'SolicitudCambio',
          entidadId: creada.id,
          rol,
        },
        {
          id: creada.id,
          codigo: creada.codigo,
          titulo: creada.titulo,
        },
      );

      const completa = await tx.solicitudCambio.findUniqueOrThrow({
        where: { id: creada.id },
        include: {
          etapas: {
            include: {
              evidencias: true,
              acciones: true,
            },
          },
        },
      });

      await this.pasoKpi.medirAmbitoCambio(tx, proyectoId);

      return this.mapearSolicitud(completa, hoy);
    });
  }

  async actualizar(
    id: number,
    datos: EntradaActualizarSolicitud,
    rol: Rol,
  ): Promise<DetalleSolicitudCambio> {
    const hoy = this.reloj.hoy();
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM solicitudes_cambio WHERE id = ${id} FOR UPDATE`;

      const solicitud = await tx.solicitudCambio.findUnique({
        where: { id },
      });
      if (!solicitud) {
        throw new ExcepcionApi(
          HttpStatus.NOT_FOUND,
          'RECURSO_NO_ENCONTRADO',
          'La solicitud de cambio no existe.',
        );
      }

      await obtenerProyectoAbierto(tx, solicitud.proyectoId, { bloquear: true });

      if (
        solicitud.estado !== EstadoSolicitudPrisma.REGISTRADA &&
        solicitud.estado !== EstadoSolicitudPrisma.EN_EVALUACION
      ) {
        throw new ExcepcionApi(
          HttpStatus.CONFLICT,
          'TRANSICION_INVALIDA',
          'No se puede editar una solicitud después de haber sido aprobada, rechazada o cerrada.',
          {
            motivo: 'ESTADO_SOLICITUD_NO_PERMITE',
            estadoSolicitud: solicitud.estado,
          },
        );
      }

      const actualizada = await tx.solicitudCambio.update({
        where: { id },
        data: {
          titulo: datos.titulo,
          descripcion: datos.descripcion,
          justificacion: datos.justificacion,
          solicitante: datos.solicitante,
          responsable: datos.responsable,
          prioridad: datos.prioridad ? (datos.prioridad as PrioridadPrisma) : undefined,
          categoria: datos.categoria ? (datos.categoria as CategoriaCambioPrisma) : undefined,
          probabilidadRiesgo: datos.probabilidadRiesgo,
          impactoRiesgo: datos.impactoRiesgo,
        },
        include: {
          etapas: {
            include: {
              evidencias: true,
              acciones: true,
            },
          },
        },
      });

      const cambios = diferencias(solicitud, actualizada, [
        'titulo',
        'descripcion',
        'justificacion',
        'solicitante',
        'responsable',
        'prioridad',
        'categoria',
        'probabilidadRiesgo',
        'impactoRiesgo',
      ]);

      if (cambios.length > 0) {
        await this.bitacora.registrarCambios(
          tx,
          {
            proyectoId: solicitud.proyectoId,
            entidad: 'SolicitudCambio',
            entidadId: solicitud.id,
            rol,
          },
          AccionBitacora.ACTUALIZAR,
          cambios,
        );
      }

      await this.pasoKpi.medirAmbitoCambio(tx, solicitud.proyectoId);

      return this.mapearSolicitud(actualizada, hoy);
    });
  }

  async actualizarEtapa(
    solicitudId: number,
    numeroEtapa: number,
    datos: EntradaActualizarEtapa,
    rol: Rol,
  ): Promise<DetalleEtapaCambio> {
    const hoy = this.reloj.hoy();

    if (datos.porcentajeAdopcion !== undefined && numeroEtapa !== 10) {
      throw new ExcepcionApi(
        HttpStatus.BAD_REQUEST,
        'VALIDACION_FALLIDA',
        'El porcentaje de adopción solo puede registrarse en la etapa 10.',
        [{ campo: 'porcentajeAdopcion', mensaje: 'Solo permitido en etapa 10.' }],
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM solicitudes_cambio WHERE id = ${solicitudId} FOR UPDATE`;

      const etapa = await tx.etapaCambio.findUnique({
        where: {
          solicitudId_numero: {
            solicitudId,
            numero: numeroEtapa,
          },
        },
        include: {
          solicitud: true,
          evidencias: true,
          acciones: true,
        },
      });

      if (!etapa) {
        throw new ExcepcionApi(
          HttpStatus.NOT_FOUND,
          'RECURSO_NO_ENCONTRADO',
          'La etapa no existe.',
        );
      }

      await obtenerProyectoAbierto(tx, etapa.solicitud.proyectoId, { bloquear: true });

      if (ESTADOS_TERMINALES_SOLICITUD.includes(etapa.solicitud.estado)) {
        throw new ExcepcionApi(
          HttpStatus.CONFLICT,
          'TRANSICION_INVALIDA',
          'No se puede modificar una etapa en una solicitud terminal.',
          {
            motivo: 'SOLICITUD_TERMINAL',
            estadoSolicitud: etapa.solicitud.estado,
            etapa: numeroEtapa,
          },
        );
      }

      if (
        etapa.estado === EstadoEtapaPrisma.OMITIDA &&
        datos.comentario !== undefined &&
        (datos.comentario === null || datos.comentario.trim() === '')
      ) {
        throw new ExcepcionApi(
          HttpStatus.CONFLICT,
          'TRANSICION_INVALIDA',
          'Una etapa omitida debe mantener una justificación obligatoria.',
          {
            motivo: 'COMENTARIO_REQUERIDO',
            estadoSolicitud: etapa.solicitud.estado,
            etapa: numeroEtapa,
          },
        );
      }

      const actualizada = await tx.etapaCambio.update({
        where: { id: etapa.id },
        data: {
          responsable: datos.responsable,
          fechaInicio: datos.fechaInicio
            ? fechaIsoADate(datos.fechaInicio)
            : datos.fechaInicio === null
              ? null
              : undefined,
          fechaFin: datos.fechaFin
            ? fechaIsoADate(datos.fechaFin)
            : datos.fechaFin === null
              ? null
              : undefined,
          comentario: datos.comentario,
          porcentajeAdopcion:
            datos.porcentajeAdopcion !== undefined
              ? datos.porcentajeAdopcion === null
                ? null
                : new Prisma.Decimal(datos.porcentajeAdopcion)
              : undefined,
        },
        include: {
          evidencias: true,
          acciones: true,
        },
      });

      const cambios = diferencias(etapa, actualizada, [
        'responsable',
        'fechaInicio',
        'fechaFin',
        'comentario',
        'porcentajeAdopcion',
      ]);

      if (cambios.length > 0) {
        await this.bitacora.registrarCambios(
          tx,
          {
            proyectoId: etapa.solicitud.proyectoId,
            entidad: 'EtapaCambio',
            entidadId: etapa.id,
            rol,
          },
          AccionBitacora.ACTUALIZAR,
          cambios,
        );
      }

      await this.pasoKpi.medirAmbitoCambio(tx, etapa.solicitud.proyectoId);

      return this.mapearEtapa(actualizada, hoy);
    });
  }

  async ejecutarAccionEtapa(
    solicitudId: number,
    numeroEtapa: number,
    accion: TipoAccionEtapa,
    comentario: string | undefined,
    rol: Rol,
  ): Promise<DetalleSolicitudCambio> {
    const hoy = this.reloj.hoy();
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM solicitudes_cambio WHERE id = ${solicitudId} FOR UPDATE`;

      const solicitud = await tx.solicitudCambio.findUnique({
        where: { id: solicitudId },
        include: {
          etapas: {
            include: {
              acciones: true,
            },
          },
        },
      });

      if (!solicitud) {
        throw new ExcepcionApi(
          HttpStatus.NOT_FOUND,
          'RECURSO_NO_ENCONTRADO',
          'La solicitud de cambio no existe.',
        );
      }

      await obtenerProyectoAbierto(tx, solicitud.proyectoId, { bloquear: true });

      const etapaActual = solicitud.etapas.find((e) => e.numero === numeroEtapa);
      if (!etapaActual) {
        throw new ExcepcionApi(
          HttpStatus.NOT_FOUND,
          'RECURSO_NO_ENCONTRADO',
          'La etapa no existe.',
        );
      }

      const etapasParaAccion = solicitud.etapas
        .slice()
        .sort((a, b) => a.numero - b.numero)
        .map((e) => ({
          numero: e.numero,
          estado: e.estado as EstadoEtapa,
          fechaIniciada: e.fechaIniciada ? dateAFechaIso(e.fechaIniciada) : null,
          fechaCompletada: e.fechaCompletada ? dateAFechaIso(e.fechaCompletada) : null,
          comentario: e.comentario,
          porcentajeAdopcion: e.porcentajeAdopcion !== null ? Number(e.porcentajeAdopcion) : null,
          accionesAbiertas: e.acciones.filter((a) => a.estado !== EstadoAccionPrisma.CERRADA)
            .length,
          accionesTotales: e.acciones.length,
        }));

      let resultado;
      try {
        resultado = aplicarAccionEtapa(
          {
            estado: solicitud.estado as EstadoSolicitud,
            etapaActual: solicitud.etapaActual,
            etapas: etapasParaAccion,
          },
          numeroEtapa,
          accion,
          { hoy, comentario },
        );
      } catch (error) {
        if (error instanceof ErrorTransicion) {
          throw new ExcepcionApi(
            HttpStatus.CONFLICT,
            'TRANSICION_INVALIDA',
            'La transición solicitada no es válida.',
            error.detalles,
          );
        }
        throw error;
      }

      const etapaModificada = resultado.etapas.find((e) => e.numero === numeroEtapa);
      if (!etapaModificada) {
        throw new ExcepcionApi(
          HttpStatus.NOT_FOUND,
          'RECURSO_NO_ENCONTRADO',
          'La etapa no existe.',
        );
      }

      const actualizaEtapaData: Prisma.EtapaCambioUpdateInput = {
        estado: etapaModificada.estado as EstadoEtapaPrisma,
        comentario: etapaModificada.comentario,
      };

      if (accion === 'iniciar') {
        actualizaEtapaData.fechaIniciada = fechaIsoADate(hoy);
      } else if (accion === 'completar') {
        actualizaEtapaData.fechaCompletada = fechaIsoADate(hoy);
      }

      await tx.etapaCambio.update({
        where: {
          solicitudId_numero: {
            solicitudId,
            numero: numeroEtapa,
          },
        },
        data: actualizaEtapaData,
      });

      const actualizaSolicitudData: Prisma.SolicitudCambioUpdateInput = {
        estado: resultado.estado as EstadoSolicitudPrisma,
        etapaActual: resultado.etapaActual,
      };

      if (resultado.estado === 'CERRADA') {
        actualizaSolicitudData.fechaCierre = fechaIsoADate(hoy);
      }

      await tx.solicitudCambio.update({
        where: { id: solicitudId },
        data: actualizaSolicitudData,
      });

      await this.bitacora.registrarCambios(
        tx,
        {
          proyectoId: solicitud.proyectoId,
          entidad: 'EtapaCambio',
          entidadId: etapaActual.id,
          rol,
        },
        AccionBitacora.ACTUALIZAR,
        [{ campo: 'estado', anterior: etapaActual.estado, nuevo: etapaModificada.estado }],
      );

      if (resultado.estado === 'CERRADA' && accion === 'completar') {
        await this.bitacora.registrarCambios(
          tx,
          {
            proyectoId: solicitud.proyectoId,
            entidad: 'SolicitudCambio',
            entidadId: solicitud.id,
            rol,
          },
          AccionBitacora.CERRAR,
          [{ campo: 'estado', anterior: solicitud.estado, nuevo: 'CERRADA' }],
        );
      }

      const completa = await tx.solicitudCambio.findUniqueOrThrow({
        where: { id: solicitudId },
        include: {
          etapas: {
            include: {
              evidencias: true,
              acciones: true,
            },
          },
        },
      });

      await this.pasoKpi.medirAmbitoCambio(tx, solicitud.proyectoId);

      return this.mapearSolicitud(completa, hoy);
    });
  }

  async adjuntarEvidencia(
    solicitudId: number,
    numeroEtapa: number,
    archivo: ArchivoSubido | undefined,
    rol: Rol,
  ): Promise<DetalleEvidencia> {
    if (!archivo || !archivo.buffer) {
      throw new ExcepcionApi(
        HttpStatus.BAD_REQUEST,
        'SOLICITUD_INVALIDA',
        'Debe adjuntar un archivo para la evidencia.',
      );
    }

    const nombreSaneado = sanearNombreArchivo(archivo.originalname);
    const extension = extraerExtension(nombreSaneado);

    try {
      validarArchivoEvidencia(nombreSaneado, archivo.mimetype, new Uint8Array(archivo.buffer));
    } catch (error) {
      if (error instanceof ErrorArchivoEvidencia) {
        throw new ExcepcionApi(
          HttpStatus.UNSUPPORTED_MEDIA_TYPE,
          'TIPO_ARCHIVO_NO_PERMITIDO',
          error.message,
        );
      }
      throw error;
    }

    await this.asegurarDirectorioUploads();
    const nombreDisco = `${randomUUID()}${extension}`;
    const rutaEnDisco = path.join(this.rutaUploads, nombreDisco);

    await fs.writeFile(rutaEnDisco, archivo.buffer);

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM solicitudes_cambio WHERE id = ${solicitudId} FOR UPDATE`;

        const etapa = await tx.etapaCambio.findUnique({
          where: {
            solicitudId_numero: {
              solicitudId,
              numero: numeroEtapa,
            },
          },
          include: { solicitud: true },
        });

        if (!etapa) {
          throw new ExcepcionApi(
            HttpStatus.NOT_FOUND,
            'RECURSO_NO_ENCONTRADO',
            'La etapa no existe.',
          );
        }

        await obtenerProyectoAbierto(tx, etapa.solicitud.proyectoId, { bloquear: true });

        if (ESTADOS_TERMINALES_SOLICITUD.includes(etapa.solicitud.estado)) {
          throw new ExcepcionApi(
            HttpStatus.CONFLICT,
            'TRANSICION_INVALIDA',
            'No se pueden adjuntar evidencias a una solicitud terminal.',
            {
              motivo: 'SOLICITUD_TERMINAL',
              estadoSolicitud: etapa.solicitud.estado,
              etapa: numeroEtapa,
            },
          );
        }

        const evidencia = await tx.evidencia.create({
          data: {
            etapaId: etapa.id,
            nombreArchivo: nombreSaneado,
            rutaArchivo: nombreDisco,
            tipoMime: archivo.mimetype,
            tamanoBytes: archivo.size,
            subidoPor: ROL_BD[rol],
          },
        });

        await this.bitacora.registrarCreacion(
          tx,
          {
            proyectoId: etapa.solicitud.proyectoId,
            entidad: 'Evidencia',
            entidadId: evidencia.id,
            rol,
          },
          {
            id: evidencia.id,
            nombreArchivo: evidencia.nombreArchivo,
            tamanoBytes: evidencia.tamanoBytes,
          },
        );

        return this.mapearEvidencia(evidencia);
      });
    } catch (error) {
      await fs.unlink(rutaEnDisco).catch(() => {});
      throw error;
    }
  }

  async obtenerEvidenciaParaDescarga(
    evidenciaId: number,
  ): Promise<{ ruta: string; nombreArchivo: string; tipoMime: string }> {
    const evidencia = await this.prisma.evidencia.findUnique({
      where: { id: evidenciaId },
    });

    if (!evidencia) {
      throw new ExcepcionApi(
        HttpStatus.NOT_FOUND,
        'RECURSO_NO_ENCONTRADO',
        'La evidencia solicitada no existe.',
      );
    }

    const baseAbsoluta = path.resolve(this.rutaUploads);
    const rutaAbsoluta = path.resolve(this.rutaUploads, evidencia.rutaArchivo);

    if (!rutaAbsoluta.startsWith(baseAbsoluta)) {
      throw new ExcepcionApi(
        HttpStatus.BAD_REQUEST,
        'SOLICITUD_INVALIDA',
        'Ruta de archivo no permitida.',
      );
    }

    try {
      await fs.access(rutaAbsoluta);
    } catch {
      throw new ExcepcionApi(
        HttpStatus.NOT_FOUND,
        'RECURSO_NO_ENCONTRADO',
        'El archivo de la evidencia no existe en el almacenamiento.',
      );
    }

    return {
      ruta: rutaAbsoluta,
      nombreArchivo: evidencia.nombreArchivo,
      tipoMime: evidencia.tipoMime,
    };
  }

  async eliminarEvidencia(evidenciaId: number, rol: Rol): Promise<void> {
    const rutaEnDisco = await this.prisma.$transaction(async (tx) => {
      const evidencia = await tx.evidencia.findUnique({
        where: { id: evidenciaId },
        include: {
          etapa: {
            include: { solicitud: true },
          },
        },
      });

      if (!evidencia) {
        throw new ExcepcionApi(
          HttpStatus.NOT_FOUND,
          'RECURSO_NO_ENCONTRADO',
          'La evidencia no existe.',
        );
      }

      await tx.$queryRaw`SELECT id FROM solicitudes_cambio WHERE id = ${evidencia.etapa.solicitudId} FOR UPDATE`;
      await obtenerProyectoAbierto(tx, evidencia.etapa.solicitud.proyectoId, { bloquear: true });

      if (ESTADOS_TERMINALES_SOLICITUD.includes(evidencia.etapa.solicitud.estado)) {
        throw new ExcepcionApi(
          HttpStatus.CONFLICT,
          'TRANSICION_INVALIDA',
          'No se pueden eliminar evidencias en una solicitud terminal.',
          {
            motivo: 'SOLICITUD_TERMINAL',
            estadoSolicitud: evidencia.etapa.solicitud.estado,
          },
        );
      }

      await tx.evidencia.delete({ where: { id: evidenciaId } });
      await this.bitacora.registrarEliminacion(
        tx,
        {
          proyectoId: evidencia.etapa.solicitud.proyectoId,
          entidad: 'Evidencia',
          entidadId: evidencia.id,
          rol,
        },
        {
          id: evidencia.id,
          nombreArchivo: evidencia.nombreArchivo,
        },
      );

      return path.resolve(this.rutaUploads, evidencia.rutaArchivo);
    });

    await fs.unlink(rutaEnDisco).catch(() => {});
  }

  async crearAccionCorrectiva(
    solicitudId: number,
    numeroEtapa: number,
    datos: EntradaCrearAccionCorrectiva,
    rol: Rol,
  ): Promise<DetalleAccionCorrectiva> {
    if (numeroEtapa !== 9) {
      throw new ExcepcionApi(
        HttpStatus.CONFLICT,
        'TRANSICION_INVALIDA',
        'Las acciones correctivas solo se pueden registrar en la etapa 9.',
        {
          motivo: 'ACCION_CORRECTIVA_SOLO_ETAPA_9',
          etapa: numeroEtapa,
        },
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM solicitudes_cambio WHERE id = ${solicitudId} FOR UPDATE`;

      const etapa = await tx.etapaCambio.findUnique({
        where: {
          solicitudId_numero: {
            solicitudId,
            numero: 9,
          },
        },
        include: { solicitud: true },
      });

      if (!etapa) {
        throw new ExcepcionApi(
          HttpStatus.NOT_FOUND,
          'RECURSO_NO_ENCONTRADO',
          'La etapa 9 no existe.',
        );
      }

      await obtenerProyectoAbierto(tx, etapa.solicitud.proyectoId, { bloquear: true });

      if (etapa.estado !== EstadoEtapaPrisma.EN_CURSO) {
        throw new ExcepcionApi(
          HttpStatus.CONFLICT,
          'TRANSICION_INVALIDA',
          'La etapa 9 debe estar en curso para registrar acciones correctivas.',
          {
            motivo: 'ETAPA_NO_EN_CURSO',
            etapa: 9,
            estadoEtapa: etapa.estado,
          },
        );
      }

      if (ESTADOS_TERMINALES_SOLICITUD.includes(etapa.solicitud.estado)) {
        throw new ExcepcionApi(
          HttpStatus.CONFLICT,
          'TRANSICION_INVALIDA',
          'No se pueden agregar acciones correctivas a una solicitud terminal.',
          {
            motivo: 'SOLICITUD_TERMINAL',
            estadoSolicitud: etapa.solicitud.estado,
          },
        );
      }

      const accion = await tx.accionCorrectiva.create({
        data: {
          etapaId: etapa.id,
          descripcion: datos.descripcion,
          responsable: datos.responsable,
          fechaCompromiso: fechaIsoADate(datos.fechaCompromiso),
          estado: EstadoAccionPrisma.PENDIENTE,
        },
      });

      await this.bitacora.registrarCreacion(
        tx,
        {
          proyectoId: etapa.solicitud.proyectoId,
          entidad: 'AccionCorrectiva',
          entidadId: accion.id,
          rol,
        },
        {
          id: accion.id,
          descripcion: accion.descripcion,
          responsable: accion.responsable,
        },
      );

      await this.pasoKpi.medirAmbitoCambio(tx, etapa.solicitud.proyectoId);

      return this.mapearAccion(accion);
    });
  }

  async actualizarAccionCorrectiva(
    accionId: number,
    datos: EntradaActualizarAccionCorrectiva,
    rol: Rol,
  ): Promise<DetalleAccionCorrectiva> {
    const hoy = this.reloj.hoy();
    return this.prisma.$transaction(async (tx) => {
      const accion = await tx.accionCorrectiva.findUnique({
        where: { id: accionId },
        include: {
          etapa: {
            include: { solicitud: true },
          },
        },
      });

      if (!accion) {
        throw new ExcepcionApi(
          HttpStatus.NOT_FOUND,
          'RECURSO_NO_ENCONTRADO',
          'La acción correctiva no existe.',
        );
      }

      await tx.$queryRaw`SELECT id FROM solicitudes_cambio WHERE id = ${accion.etapa.solicitudId} FOR UPDATE`;
      await obtenerProyectoAbierto(tx, accion.etapa.solicitud.proyectoId, { bloquear: true });

      if (ESTADOS_TERMINALES_SOLICITUD.includes(accion.etapa.solicitud.estado)) {
        throw new ExcepcionApi(
          HttpStatus.CONFLICT,
          'TRANSICION_INVALIDA',
          'No se pueden modificar acciones correctivas en una solicitud terminal.',
          {
            motivo: 'SOLICITUD_TERMINAL',
            estadoSolicitud: accion.etapa.solicitud.estado,
          },
        );
      }

      let fechaCierreValida: Date | null | undefined = undefined;
      if (datos.estado === 'CERRADA') {
        fechaCierreValida = datos.fechaCierre
          ? fechaIsoADate(datos.fechaCierre)
          : fechaIsoADate(hoy);
      } else if (datos.fechaCierre !== undefined) {
        fechaCierreValida = datos.fechaCierre ? fechaIsoADate(datos.fechaCierre) : null;
      }

      const actualizada = await tx.accionCorrectiva.update({
        where: { id: accionId },
        data: {
          descripcion: datos.descripcion,
          responsable: datos.responsable,
          fechaCompromiso: datos.fechaCompromiso ? fechaIsoADate(datos.fechaCompromiso) : undefined,
          estado: datos.estado ? (datos.estado as EstadoAccionPrisma) : undefined,
          fechaCierre: fechaCierreValida,
        },
      });

      const cambios = diferencias(accion, actualizada, [
        'descripcion',
        'responsable',
        'fechaCompromiso',
        'fechaCierre',
        'estado',
      ]);

      if (cambios.length > 0) {
        await this.bitacora.registrarCambios(
          tx,
          {
            proyectoId: accion.etapa.solicitud.proyectoId,
            entidad: 'AccionCorrectiva',
            entidadId: accion.id,
            rol,
          },
          AccionBitacora.ACTUALIZAR,
          cambios,
        );
      }

      await this.pasoKpi.medirAmbitoCambio(tx, accion.etapa.solicitud.proyectoId);

      return this.mapearAccion(actualizada);
    });
  }

  async listarImpactos(solicitudId: number): Promise<DetalleImpacto[]> {
    return this.aplicador.listarImpactos(solicitudId);
  }

  async crearImpacto(
    solicitudId: number,
    datos: EntradaCrearImpacto,
    rol: Rol,
  ): Promise<DetalleImpacto> {
    return this.aplicador.crearImpacto(solicitudId, datos, rol);
  }

  async eliminarImpacto(impactoId: number, rol: Rol): Promise<void> {
    return this.aplicador.eliminarImpacto(impactoId, rol);
  }

  async simular(solicitudId: number, rol: Rol): Promise<ResultadoSimulacion> {
    return this.aplicador.simular(solicitudId, rol);
  }

  async aprobar(solicitudId: number, rol: Rol): Promise<ResultadoSimulacion> {
    return this.aplicador.aprobar(solicitudId, rol);
  }

  async rechazar(
    solicitudId: number,
    datos: EntradaRechazarSolicitud,
    rol: Rol,
  ): Promise<DetalleSolicitudCambio> {
    const actualizada = await this.aplicador.rechazar(solicitudId, datos, rol);
    return this.mapearSolicitud(actualizada, this.reloj.hoy());
  }
}
