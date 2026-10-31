import { HttpStatus, Injectable } from '@nestjs/common';
import { AccionBitacora, Prisma } from '@prisma/client';
import {
  claveNombre,
  mensajeTieneAsignaciones,
  type ActualizarProfesional,
  type CrearProfesional,
  type ProfesionalResumen,
  type Rol,
} from '@autofix/core';
import { BitacoraService, ContextoBitacora } from '../comun/bitacora/bitacora.service';
import { diferencias } from '../comun/bitacora/diferencias';
import { ExcepcionApi } from '../comun/errores/excepcion-api';
import { PrismaService } from '../prisma/prisma.service';
import { instantaneaProfesional, mapearProfesional } from './catalogos.mapeo';

const ENTIDAD = 'Profesional';
const CON_CONTEO = { _count: { select: { asignaciones: true } } } as const;
const CAMPOS_AUDITADOS = ['nombre', 'cargo', 'tarifaHora', 'horasDiarias', 'activo'] as const;

const errorNoEncontrado = () =>
  new ExcepcionApi(HttpStatus.NOT_FOUND, 'REGISTRO_NO_ENCONTRADO', 'El profesional no existe.');

const errorDuplicado = (nombre?: string) => {
  const mensaje = nombre
    ? `Ya existe un profesional con el nombre «${nombre}».`
    : 'Ya existe un profesional con ese nombre.';
  return new ExcepcionApi(HttpStatus.CONFLICT, 'REGISTRO_DUPLICADO', mensaje, [
    { campo: 'nombre', mensaje },
  ]);
};

const esDuplicado = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

@Injectable()
export class ProfesionalesService {
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
    const existente = await tx.profesional.findUnique({
      where: { claveNombre: claveNombre(nombre) },
    });
    if (existente && existente.id !== excluirId) {
      throw errorDuplicado(existente.nombre);
    }
  }

  async listar(): Promise<ProfesionalResumen[]> {
    const profesionales = await this.prisma.profesional.findMany({
      include: CON_CONTEO,
      orderBy: { nombre: 'asc' },
    });
    return profesionales.map(mapearProfesional);
  }

  async obtenerPorId(id: number): Promise<ProfesionalResumen> {
    const profesional = await this.prisma.profesional.findUnique({
      where: { id },
      include: CON_CONTEO,
    });
    if (!profesional) throw errorNoEncontrado();
    return mapearProfesional(profesional);
  }

  async crear(datos: CrearProfesional, rol: Rol): Promise<ProfesionalResumen> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.verificarNombreLibre(tx, datos.nombre);
        const creado = await tx.profesional.create({
          data: { ...datos, claveNombre: claveNombre(datos.nombre) },
          include: CON_CONTEO,
        });
        await this.bitacora.registrarCreacion(
          tx,
          this.contexto(creado.id, rol),
          instantaneaProfesional(creado),
        );
        return mapearProfesional(creado);
      });
    } catch (error) {
      if (esDuplicado(error)) throw errorDuplicado();
      throw error;
    }
  }

  async actualizar(
    id: number,
    datos: ActualizarProfesional,
    rol: Rol,
  ): Promise<ProfesionalResumen> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM profesionales WHERE id = ${id} FOR UPDATE`;
        const antes = await tx.profesional.findUnique({
          where: { id },
          include: CON_CONTEO,
        });
        if (!antes) throw errorNoEncontrado();

        const dataUpdate: Prisma.ProfesionalUpdateInput = { ...datos };
        if (datos.nombre !== undefined) {
          await this.verificarNombreLibre(tx, datos.nombre, id);
          dataUpdate.claveNombre = claveNombre(datos.nombre);
        }

        const despues = await tx.profesional.update({
          where: { id },
          data: dataUpdate,
          include: CON_CONTEO,
        });

        const camposAfectados = CAMPOS_AUDITADOS.filter((c) => c in datos);
        const cambios = diferencias(antes, despues, camposAfectados);
        await this.bitacora.registrarCambios(
          tx,
          this.contexto(id, rol),
          AccionBitacora.ACTUALIZAR,
          cambios,
        );

        return mapearProfesional(despues);
      });
    } catch (error) {
      if (esDuplicado(error)) throw errorDuplicado();
      throw error;
    }
  }

  async eliminar(id: number, rol: Rol): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM profesionales WHERE id = ${id} FOR UPDATE`;
      const profesional = await tx.profesional.findUnique({
        where: { id },
        include: CON_CONTEO,
      });
      if (!profesional) throw errorNoEncontrado();
      const asignaciones = await tx.asignacion.count({
        where: { profesionalId: id },
      });
      if (asignaciones > 0) {
        throw new ExcepcionApi(
          HttpStatus.CONFLICT,
          'TIENE_ASIGNACIONES',
          mensajeTieneAsignaciones('El profesional', profesional.nombre, asignaciones),
          { asignaciones },
        );
      }
      await this.bitacora.registrarEliminacion(
        tx,
        this.contexto(id, rol),
        instantaneaProfesional(profesional),
      );
      await tx.profesional.delete({ where: { id } });
    });
  }
}
