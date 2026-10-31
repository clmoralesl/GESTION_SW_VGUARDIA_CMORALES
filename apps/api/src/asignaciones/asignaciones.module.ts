import { Module } from '@nestjs/common';
import { BitacoraModule } from '../comun/bitacora/bitacora.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RecalculoModule } from '../recalculo/recalculo.module';
import { AsignacionesController } from './asignaciones.controller';
import { AsignacionesService } from './asignaciones.service';

@Module({
  imports: [PrismaModule, BitacoraModule, RecalculoModule],
  controllers: [AsignacionesController],
  providers: [AsignacionesService],
  exports: [AsignacionesService],
})
export class AsignacionesModule {}
