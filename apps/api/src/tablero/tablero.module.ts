import { Module } from '@nestjs/common';
import { Reloj } from '../comun/reloj/reloj';
import { PrismaModule } from '../prisma/prisma.module';
import { TableroController } from './tablero.controller';
import { TableroService } from './tablero.service';

@Module({
  imports: [PrismaModule],
  controllers: [TableroController],
  providers: [TableroService, Reloj],
  exports: [TableroService],
})
export class TableroModule {}
