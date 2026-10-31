import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { BitacoraModule } from './comun/bitacora/bitacora.module';
import { CalendarioModule } from './calendario/calendario.module';
import { DependenciasModule } from './dependencias/dependencias.module';
import { HitosModule } from './hitos/hitos.module';
import { LineasBaseModule } from './lineas-base/lineas-base.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProyectosModule } from './proyectos/proyectos.module';
import { RecalculoModule } from './recalculo/recalculo.module';
import { SaludModule } from './salud/salud.module';
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
    DependenciasModule,
    HitosModule,
    LineasBaseModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
