import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  esquemaActualizarAccionCorrectiva,
  esquemaActualizarEtapa,
  esquemaActualizarSolicitud,
  esquemaCrearAccionCorrectiva,
  esquemaCrearImpacto,
  esquemaCrearSolicitud,
  esquemaOmitirEtapa,
  esquemaRechazarSolicitud,
  PERMISOS,
  type EntradaActualizarAccionCorrectiva,
  type EntradaActualizarEtapa,
  type EntradaActualizarSolicitud,
  type EntradaCrearAccionCorrectiva,
  type EntradaCrearImpacto,
  type EntradaCrearSolicitud,
  type EntradaOmitirEtapa,
  type EntradaRechazarSolicitud,
  type ResultadoSimulacion,
  type Rol,
} from '@autofix/core';
import { memoryStorage } from 'multer';
import { RolActual } from '../comun/roles/rol-actual.decorator';
import { Roles } from '../comun/roles/roles.decorator';
import { PipeCuerpoObjeto } from '../comun/validacion/cuerpo-objeto.pipe';
import { PipeIdRuta } from '../comun/validacion/id-ruta.pipe';
import { PipeValidacionZod } from '../comun/validacion/validacion-zod.pipe';
import { PipeNumeroEtapa } from './pipe-numero-etapa';
import type { DetalleImpacto } from './cambio-aplicador.service';
import {
  ArchivoSubido,
  DetalleAccionCorrectiva,
  DetalleEtapaCambio,
  DetalleEvidencia,
  DetalleSolicitudCambio,
  SolicitudesCambioService,
} from './solicitudes-cambio.service';

interface RespuestaDescarga {
  setHeader(nombre: string, valor: string): void;
  sendFile(ruta: string): void;
}

@Controller()
export class SolicitudesCambioController {
  constructor(private readonly service: SolicitudesCambioService) {}

  @Get('proyectos/:proyectoId/solicitudes-cambio')
  listar(
    @Param('proyectoId', new PipeIdRuta('proyectoId')) proyectoId: number,
  ): Promise<DetalleSolicitudCambio[]> {
    return this.service.listar(proyectoId);
  }

  @Roles(...PERMISOS.gestionarSolicitudesCambio)
  @HttpCode(HttpStatus.CREATED)
  @Post('proyectos/:proyectoId/solicitudes-cambio')
  crear(
    @Param('proyectoId', new PipeIdRuta('proyectoId')) proyectoId: number,
    @Body(new PipeCuerpoObjeto(), new PipeValidacionZod(esquemaCrearSolicitud))
    datos: EntradaCrearSolicitud,
    @RolActual() rol: Rol,
  ): Promise<DetalleSolicitudCambio> {
    return this.service.crear(proyectoId, datos, rol);
  }

  @Get('solicitudes-cambio/:id')
  obtener(@Param('id', new PipeIdRuta('id')) id: number): Promise<DetalleSolicitudCambio> {
    return this.service.obtener(id);
  }

  @Roles(...PERMISOS.gestionarSolicitudesCambio)
  @Patch('solicitudes-cambio/:id')
  actualizar(
    @Param('id', new PipeIdRuta('id')) id: number,
    @Body(new PipeCuerpoObjeto(), new PipeValidacionZod(esquemaActualizarSolicitud))
    datos: EntradaActualizarSolicitud,
    @RolActual() rol: Rol,
  ): Promise<DetalleSolicitudCambio> {
    return this.service.actualizar(id, datos, rol);
  }

  @Roles(...PERMISOS.avanzarEtapasCambio)
  @Patch('solicitudes-cambio/:id/etapas/:numero')
  actualizarEtapa(
    @Param('id', new PipeIdRuta('id')) id: number,
    @Param('numero', new PipeNumeroEtapa()) numero: number,
    @Body(new PipeCuerpoObjeto(), new PipeValidacionZod(esquemaActualizarEtapa))
    datos: EntradaActualizarEtapa,
    @RolActual() rol: Rol,
  ): Promise<DetalleEtapaCambio> {
    return this.service.actualizarEtapa(id, numero, datos, rol);
  }

  @Roles(...PERMISOS.avanzarEtapasCambio)
  @HttpCode(HttpStatus.OK)
  @Post('solicitudes-cambio/:id/etapas/:numero/iniciar')
  iniciarEtapa(
    @Param('id', new PipeIdRuta('id')) id: number,
    @Param('numero', new PipeNumeroEtapa()) numero: number,
    @RolActual() rol: Rol,
  ): Promise<DetalleSolicitudCambio> {
    return this.service.ejecutarAccionEtapa(id, numero, 'iniciar', undefined, rol);
  }

  @Roles(...PERMISOS.avanzarEtapasCambio)
  @HttpCode(HttpStatus.OK)
  @Post('solicitudes-cambio/:id/etapas/:numero/completar')
  completarEtapa(
    @Param('id', new PipeIdRuta('id')) id: number,
    @Param('numero', new PipeNumeroEtapa()) numero: number,
    @RolActual() rol: Rol,
  ): Promise<DetalleSolicitudCambio> {
    return this.service.ejecutarAccionEtapa(id, numero, 'completar', undefined, rol);
  }

  @Roles(...PERMISOS.avanzarEtapasCambio)
  @HttpCode(HttpStatus.OK)
  @Post('solicitudes-cambio/:id/etapas/:numero/omitir')
  omitirEtapa(
    @Param('id', new PipeIdRuta('id')) id: number,
    @Param('numero', new PipeNumeroEtapa()) numero: number,
    @Body(new PipeCuerpoObjeto(), new PipeValidacionZod(esquemaOmitirEtapa))
    datos: EntradaOmitirEtapa,
    @RolActual() rol: Rol,
  ): Promise<DetalleSolicitudCambio> {
    return this.service.ejecutarAccionEtapa(id, numero, 'omitir', datos.comentario, rol);
  }

  @Roles(...PERMISOS.adjuntarEvidencias)
  @HttpCode(HttpStatus.CREATED)
  @Post('solicitudes-cambio/:id/etapas/:numero/evidencias')
  @UseInterceptors(
    FileInterceptor('archivo', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    }),
  )
  adjuntarEvidencia(
    @Param('id', new PipeIdRuta('id')) id: number,
    @Param('numero', new PipeNumeroEtapa()) numero: number,
    @UploadedFile() archivo: ArchivoSubido | undefined,
    @RolActual() rol: Rol,
  ): Promise<DetalleEvidencia> {
    return this.service.adjuntarEvidencia(id, numero, archivo, rol);
  }

  @Get('evidencias/:id/descarga')
  async descargarEvidencia(
    @Param('id', new PipeIdRuta('id')) id: number,
    @Res() res: RespuestaDescarga,
  ): Promise<void> {
    const { ruta, nombreArchivo, tipoMime } = await this.service.obtenerEvidenciaParaDescarga(id);

    res.setHeader('Content-Type', tipoMime);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(nombreArchivo)}`,
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(ruta);
  }

  @Roles(...PERMISOS.adjuntarEvidencias)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('evidencias/:id')
  eliminarEvidencia(
    @Param('id', new PipeIdRuta('id')) id: number,
    @RolActual() rol: Rol,
  ): Promise<void> {
    return this.service.eliminarEvidencia(id, rol);
  }

  @Roles(...PERMISOS.avanzarEtapasCambio)
  @HttpCode(HttpStatus.CREATED)
  @Post('solicitudes-cambio/:id/etapas/:numero/acciones-correctivas')
  crearAccionCorrectiva(
    @Param('id', new PipeIdRuta('id')) id: number,
    @Param('numero', new PipeNumeroEtapa()) numero: number,
    @Body(new PipeCuerpoObjeto(), new PipeValidacionZod(esquemaCrearAccionCorrectiva))
    datos: EntradaCrearAccionCorrectiva,
    @RolActual() rol: Rol,
  ): Promise<DetalleAccionCorrectiva> {
    return this.service.crearAccionCorrectiva(id, numero, datos, rol);
  }

  @Roles(...PERMISOS.avanzarEtapasCambio)
  @Patch('acciones-correctivas/:id')
  actualizarAccionCorrectiva(
    @Param('id', new PipeIdRuta('id')) id: number,
    @Body(new PipeCuerpoObjeto(), new PipeValidacionZod(esquemaActualizarAccionCorrectiva))
    datos: EntradaActualizarAccionCorrectiva,
    @RolActual() rol: Rol,
  ): Promise<DetalleAccionCorrectiva> {
    return this.service.actualizarAccionCorrectiva(id, datos, rol);
  }

  @Get('solicitudes-cambio/:id/impactos')
  listarImpactos(@Param('id', new PipeIdRuta('id')) id: number): Promise<DetalleImpacto[]> {
    return this.service.listarImpactos(id);
  }

  @Roles(...PERMISOS.gestionarSolicitudesCambio)
  @HttpCode(HttpStatus.CREATED)
  @Post('solicitudes-cambio/:id/impactos')
  crearImpacto(
    @Param('id', new PipeIdRuta('id')) id: number,
    @Body(new PipeCuerpoObjeto(), new PipeValidacionZod(esquemaCrearImpacto))
    datos: EntradaCrearImpacto,
    @RolActual() rol: Rol,
  ): Promise<DetalleImpacto> {
    return this.service.crearImpacto(id, datos, rol);
  }

  @Roles(...PERMISOS.gestionarSolicitudesCambio)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('impactos-cambio/:id')
  eliminarImpacto(
    @Param('id', new PipeIdRuta('id')) id: number,
    @RolActual() rol: Rol,
  ): Promise<void> {
    return this.service.eliminarImpacto(id, rol);
  }

  @HttpCode(HttpStatus.OK)
  @Post('solicitudes-cambio/:id/simular')
  simular(
    @Param('id', new PipeIdRuta('id')) id: number,
    @RolActual() rol: Rol,
  ): Promise<ResultadoSimulacion> {
    return this.service.simular(id, rol);
  }

  @Roles(...PERMISOS.decidirSolicitudesCambio)
  @HttpCode(HttpStatus.OK)
  @Post('solicitudes-cambio/:id/aprobar')
  aprobar(
    @Param('id', new PipeIdRuta('id')) id: number,
    @RolActual() rol: Rol,
  ): Promise<ResultadoSimulacion> {
    return this.service.aprobar(id, rol);
  }

  @Roles(...PERMISOS.decidirSolicitudesCambio)
  @HttpCode(HttpStatus.OK)
  @Post('solicitudes-cambio/:id/rechazar')
  rechazar(
    @Param('id', new PipeIdRuta('id')) id: number,
    @Body(new PipeCuerpoObjeto(), new PipeValidacionZod(esquemaRechazarSolicitud))
    datos: EntradaRechazarSolicitud,
    @RolActual() rol: Rol,
  ): Promise<DetalleSolicitudCambio> {
    return this.service.rechazar(id, datos, rol);
  }
}
