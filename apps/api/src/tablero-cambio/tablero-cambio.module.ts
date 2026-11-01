import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { Reloj } from '../comun/reloj/reloj';
import { TableroCambioController } from './tablero-cambio.controller';
import { TableroCambioService } from './tablero-cambio.service';

@Module({
  imports: [PrismaModule],
  controllers: [TableroCambioController],
  providers: [TableroCambioService, Reloj],
  exports: [TableroCambioService],
})
export class TableroCambioModule {}
