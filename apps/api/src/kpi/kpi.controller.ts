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
  Query,
} from '@nestjs/common';
import {
  esquemaActualizarKpi,
  esquemaConsultaVariablesKpi,
  esquemaCrearKpi,
  esquemaValidarFormula,
  PERMISOS,
  z,
  type ActualizarKpi,
  type AmbitoKpi,
  type ConsultaVariablesKpi,
  type CrearKpi,
  type KpiDetalleRespuesta,
  type KpiMedicionRespuesta,
  type KpiProyectoResumen,
  type Rol,
  type ValidarFormulaDto,
} from '@autofix/core';
import { RolActual } from '../comun/roles/rol-actual.decorator';
import { Roles } from '../comun/roles/roles.decorator';
import { PipeIdRuta } from '../comun/validacion/id-ruta.pipe';
import { PipeValidacionZod } from '../comun/validacion/validacion-zod.pipe';
import { KpiService } from './kpi.service';

const esquemaLimite = z.coerce.number().int().min(1).max(500).default(100);

const esquemaConsultaKpiProyecto = z.strictObject({
  ambito: z
    .enum(['PROYECTO', 'CAMBIO'], {
      error: 'Seleccione un ámbito válido (PROYECTO o CAMBIO).',
    })
    .default('PROYECTO'),
});

type ConsultaKpiProyecto = z.infer<typeof esquemaConsultaKpiProyecto>;

@Controller()
export class KpiController {
  constructor(private readonly kpi: KpiService) {}

  @Get('variables-kpi')
  obtenerVariables(
    @Query(new PipeValidacionZod(esquemaConsultaVariablesKpi)) query: ConsultaVariablesKpi,
  ) {
    return this.kpi.obtenerVariables(query.proyectoId, query.fechaCorte);
  }

  @Get('kpi')
  listar(): Promise<KpiDetalleRespuesta[]> {
    return this.kpi.listar();
  }

  @Roles(...PERMISOS.editarKpi)
  @HttpCode(HttpStatus.CREATED)
  @Post('kpi')
  crear(
    @Body(new PipeValidacionZod(esquemaCrearKpi)) datos: CrearKpi,
    @RolActual() rol: Rol,
  ): Promise<KpiDetalleRespuesta> {
    return this.kpi.crear(datos, rol);
  }

  @Roles(...PERMISOS.editarKpi)
  @Patch('kpi/:id')
  actualizar(
    @Param('id', new PipeIdRuta('id')) id: number,
    @Body(new PipeValidacionZod(esquemaActualizarKpi)) datos: ActualizarKpi,
    @RolActual() rol: Rol,
  ): Promise<KpiDetalleRespuesta> {
    return this.kpi.actualizar(id, datos, rol);
  }

  @Roles(...PERMISOS.editarKpi)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('kpi/:id')
  eliminar(@Param('id', new PipeIdRuta('id')) id: number, @RolActual() rol: Rol): Promise<void> {
    return this.kpi.eliminar(id, rol);
  }

  @Roles(...PERMISOS.editarKpi)
  @HttpCode(HttpStatus.OK)
  @Post('kpi/validar-formula')
  validarFormula(@Body(new PipeValidacionZod(esquemaValidarFormula)) datos: ValidarFormulaDto) {
    return this.kpi.validarFormula(datos);
  }

  @Get('proyectos/:proyectoId/kpi')
  listarPorProyecto(
    @Param('proyectoId', new PipeIdRuta('proyectoId')) proyectoId: number,
    @Query(new PipeValidacionZod(esquemaConsultaKpiProyecto)) query: ConsultaKpiProyecto,
  ): Promise<KpiProyectoResumen[]> {
    return this.kpi.listarPorProyecto(proyectoId, query.ambito as AmbitoKpi);
  }

  @Get('proyectos/:proyectoId/kpi/:kpiId/mediciones')
  listarMediciones(
    @Param('proyectoId', new PipeIdRuta('proyectoId')) proyectoId: number,
    @Param('kpiId', new PipeIdRuta('kpiId')) kpiId: number,
    @Query('limite', new PipeValidacionZod(esquemaLimite)) limite: number,
  ): Promise<KpiMedicionRespuesta[]> {
    return this.kpi.listarMediciones(proyectoId, kpiId, limite);
  }
}
