import { HttpStatus, Injectable } from '@nestjs/common';
import { AccionBitacora, Prisma } from '@prisma/client';
import {
  claveNombre,
  mensajeTieneAsignaciones,
  type ActualizarRecurso,
  type CrearRecurso,
  type RecursoResumen,
  type Rol,
} from '@autofix/core';
import { BitacoraService, ContextoBitacora } from '../comun/bitacora/bitacora.service';
import { CambioCampo, diferencias } from '../comun/bitacora/diferencias';
import { ExcepcionApi } from '../comun/errores/excepcion-api';
import { PrismaService } from '../prisma/prisma.service';
import { instantaneaRecurso, mapearRecurso } from './catalogos.mapeo';

const ENTIDAD = 'Recurso';
const CON_INCLUDES = {
  tipoRecurso: true,
  _count: { select: { asignaciones: true } },
} as const;

const CAMPOS_AUDITADOS = ['nombre', 'unidad', 'costoUnitario', 'activo'] as const;

const errorNoEncontrado = () =>
  new ExcepcionApi(HttpStatus.NOT_FOUND, 'REGISTRO_NO_ENCONTRADO', 'El recurso no existe.');

const errorTipoNoEncontrado = () =>
  new ExcepcionApi(HttpStatus.BAD_REQUEST, 'VALIDACION_FALLIDA', 'El tipo de recurso no existe.', [
    { campo: 'tipoRecursoId', mensaje: 'El tipo de recurso no existe.' },
  ]);

const errorDuplicado = (nombre?: string) => {
  const mensaje = nombre
    ? `Ya existe un recurso con el nombre «${nombre}».`
    : 'Ya existe un recurso con ese nombre.';
  return new ExcepcionApi(HttpStatus.CONFLICT, 'REGISTRO_DUPLICADO', mensaje, [
    { campo: 'nombre', mensaje },
  ]);
};

const esDuplicado = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

@Injectable()
export class RecursosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bitacora: BitacoraService,
  ) {}

  private contexto(entidadId: number, rol: Rol): ContextoBitacora {
    return { proyectoId: null, entidad: ENTIDAD, entidadId, rol };
  }

  private async verificarNombreLibre(
    tx: Prisma.TransactionClient,
    nombre: string,
    excluirId?: number,
  ) {
    const existente = await tx.recurso.findUnique({
      where: { claveNombre: claveNombre(nombre) },
    });
    if (existente && existente.id !== excluirId) {
      throw errorDuplicado(existente.nombre);
    }
  }

  private async verificarTipoExiste(tx: Prisma.TransactionClient, tipoRecursoId: number) {
    const tipo = await tx.tipoRecurso.findUnique({
      where: { id: tipoRecursoId },
    });
    if (!tipo) throw errorTipoNoEncontrado();
    return tipo;
  }

  async listar(): Promise<RecursoResumen[]> {
    const recursos = await this.prisma.recurso.findMany({
      include: CON_INCLUDES,
      orderBy: { nombre: 'asc' },
    });
    return recursos.map(mapearRecurso);
  }

  async obtenerPorId(id: number): Promise<RecursoResumen> {
    const recurso = await this.prisma.recurso.findUnique({
      where: { id },
      include: CON_INCLUDES,
    });
    if (!recurso) throw errorNoEncontrado();
    return mapearRecurso(recurso);
  }

  async crear(datos: CrearRecurso, rol: Rol): Promise<RecursoResumen> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.verificarTipoExiste(tx, datos.tipoRecursoId);
        await this.verificarNombreLibre(tx, datos.nombre);
        const creado = await tx.recurso.create({
          data: { ...datos, claveNombre: claveNombre(datos.nombre) },
          include: CON_INCLUDES,
        });
        await this.bitacora.registrarCreacion(
          tx,
          this.contexto(creado.id, rol),
          instantaneaRecurso(creado),
        );
        return mapearRecurso(creado);
      });
    } catch (error) {
      if (esDuplicado(error)) throw errorDuplicado();
      throw error;
    }
  }

  async actualizar(id: number, datos: ActualizarRecurso, rol: Rol): Promise<RecursoResumen> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM recursos WHERE id = ${id} FOR UPDATE`;
        const antes = await tx.recurso.findUnique({
          where: { id },
          include: CON_INCLUDES,
        });
        if (!antes) throw errorNoEncontrado();

        if (datos.tipoRecursoId !== undefined) {
          await this.verificarTipoExiste(tx, datos.tipoRecursoId);
        }

        const dataUpdate: Prisma.RecursoUpdateInput = { ...datos };
        if (datos.nombre !== undefined) {
          await this.verificarNombreLibre(tx, datos.nombre, id);
          dataUpdate.claveNombre = claveNombre(datos.nombre);
        }

        const despues = await tx.recurso.update({
          where: { id },
          data: dataUpdate,
          include: CON_INCLUDES,
        });

        const camposAfectados = CAMPOS_AUDITADOS.filter((c) => c in datos);
        const cambios: CambioCampo[] = diferencias(antes, despues, camposAfectados);

        if (datos.tipoRecursoId !== undefined && antes.tipoRecursoId !== despues.tipoRecursoId) {
          cambios.push({
            campo: 'tipoRecurso',
            anterior: antes.tipoRecurso.nombre,
            nuevo: despues.tipoRecurso.nombre,
          });
        }

        await this.bitacora.registrarCambios(
          tx,
          this.contexto(id, rol),
          AccionBitacora.ACTUALIZAR,
          cambios,
        );

        return mapearRecurso(despues);
      });
    } catch (error) {
      if (esDuplicado(error)) throw errorDuplicado();
      throw error;
    }
  }

  async eliminar(id: number, rol: Rol): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM recursos WHERE id = ${id} FOR UPDATE`;
      const recurso = await tx.recurso.findUnique({
        where: { id },
        include: CON_INCLUDES,
      });
      if (!recurso) throw errorNoEncontrado();

      const asignaciones = await tx.asignacion.count({
        where: { recursoId: id },
      });
      if (asignaciones > 0) {
        throw new ExcepcionApi(
          HttpStatus.CONFLICT,
          'TIENE_ASIGNACIONES',
          mensajeTieneAsignaciones('El recurso', recurso.nombre, asignaciones),
          { asignaciones },
        );
      }

      await this.bitacora.registrarEliminacion(
        tx,
        this.contexto(id, rol),
        instantaneaRecurso(recurso),
      );
      await tx.recurso.delete({ where: { id } });
    });
  }
}
