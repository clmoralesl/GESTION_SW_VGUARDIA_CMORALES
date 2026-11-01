import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PERMISOS, ROLES, type Rol } from '@autofix/core';
import { Roles } from '../comun/roles/roles.decorator';
import { RolActual } from '../comun/roles/rol-actual.decorator';
import { PipeIdRuta } from '../comun/validacion/id-ruta.pipe';
import {
  ImportacionesService,
  type ArchivoEntrada,
  type ResultadoConfirmacionImportacion,
  type ResultadoVistaPrevia,
} from './importaciones.service';

interface RespuestaDescarga {
  setHeader(nombre: string, valor: string): void;
  send(cuerpo: Buffer): void;
}

@Controller()
export class ImportacionesController {
  constructor(private readonly service: ImportacionesService) {}

  @Roles(...ROLES)
  @Get('importaciones/plantilla')
  async descargarPlantilla(@Res() res: RespuestaDescarga): Promise<void> {
    const buffer = await this.service.obtenerPlantilla();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="plantilla_carga_autofix.xlsx"');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(buffer);
  }

  @Roles(...ROLES)
  @Get('proyectos/:proyectoId/exportacion')
  async exportarProyecto(
    @Param('proyectoId', new PipeIdRuta('proyectoId')) proyectoId: number,
    @Res() res: RespuestaDescarga,
  ): Promise<void> {
    const { buffer, nombreArchivo } = await this.service.exportarProyecto(proyectoId);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(buffer);
  }

  @Roles(...PERMISOS.importarDatos)
  @HttpCode(HttpStatus.OK)
  @Post('importaciones/vista-previa')
  @UseInterceptors(
    FileInterceptor('archivo', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    }),
  )
  vistaPrevia(
    @UploadedFile() archivo: ArchivoEntrada | undefined,
    @Query('proyectoId') proyectoId?: string,
  ): Promise<ResultadoVistaPrevia> {
    const pId = proyectoId !== undefined && proyectoId !== '' ? Number(proyectoId) : undefined;
    return this.service.vistaPrevia(archivo, pId);
  }

  @Roles(...PERMISOS.importarDatos)
  @HttpCode(HttpStatus.CREATED)
  @Post('importaciones')
  @UseInterceptors(
    FileInterceptor('archivo', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    }),
  )
  confirmar(
    @UploadedFile() archivo: ArchivoEntrada | undefined,
    @Query('proyectoId') proyectoId?: string,
    @Query('reemplazar') reemplazar?: string,
    @RolActual() rol?: Rol,
  ): Promise<ResultadoConfirmacionImportacion> {
    const pId = proyectoId !== undefined && proyectoId !== '' ? Number(proyectoId) : undefined;
    const debeReemplazar = reemplazar === 'true' || reemplazar === '1';
    return this.service.confirmar(archivo, pId, debeReemplazar, rol);
  }
}
