import { Module } from '@nestjs/common';
import { AlertasModule } from './alertas/alertas.module';
import { AppController } from './app.controller';
import { AsignacionesModule } from './asignaciones/asignaciones.module';
import { BitacoraModule } from './comun/bitacora/bitacora.module';
import { CalendarioModule } from './calendario/calendario.module';
import { CatalogosModule } from './catalogos/catalogos.module';
import { DependenciasModule } from './dependencias/dependencias.module';
import { HitosModule } from './hitos/hitos.module';
import { ImportacionesModule } from './importaciones/importaciones.module';
import { KpiModule } from './kpi/kpi.module';
import { LineasBaseModule } from './lineas-base/lineas-base.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProyectosModule } from './proyectos/proyectos.module';
import { RecalculoModule } from './recalculo/recalculo.module';
import { SaludModule } from './salud/salud.module';
import { SolicitudesCambioModule } from './solicitudes-cambio/solicitudes-cambio.module';
import { TableroModule } from './tablero/tablero.module';
import { TableroCambioModule } from './tablero-cambio/tablero-cambio.module';
import { TareasModule } from './tareas/tareas.module';

@Module({
  imports: [
    PrismaModule,
    BitacoraModule,
    SaludModule,
    ProyectosModule,
    RecalculoModule,
    TareasModule,
    CalendarioModule,
    CatalogosModule,
    DependenciasModule,
    HitosModule,
    LineasBaseModule,
    AsignacionesModule,
    AlertasModule,
    KpiModule,
    SolicitudesCambioModule,
    TableroModule,
    TableroCambioModule,
    ImportacionesModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
