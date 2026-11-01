import { Module } from '@nestjs/common';
import { Reloj } from '../comun/reloj/reloj';
import { PrismaModule } from '../prisma/prisma.module';
import { RecalculoModule } from '../recalculo/recalculo.module';
import { ImportacionesController } from './importaciones.controller';
import { ImportacionesService } from './importaciones.service';

@Module({
  imports: [PrismaModule, RecalculoModule],
  controllers: [ImportacionesController],
  providers: [ImportacionesService, Reloj],
  exports: [ImportacionesService],
})
export class ImportacionesModule {}
