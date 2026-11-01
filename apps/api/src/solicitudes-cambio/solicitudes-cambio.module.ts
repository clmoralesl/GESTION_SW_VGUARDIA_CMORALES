import { Module } from '@nestjs/common';
import { BitacoraModule } from '../comun/bitacora/bitacora.module';
import { Reloj } from '../comun/reloj/reloj';
import { PrismaModule } from '../prisma/prisma.module';
import { RecalculoModule } from '../recalculo/recalculo.module';
import { CambioAplicadorService } from './cambio-aplicador.service';
import { SolicitudesCambioController } from './solicitudes-cambio.controller';
import { SolicitudesCambioService } from './solicitudes-cambio.service';

@Module({
  imports: [PrismaModule, BitacoraModule, RecalculoModule],
  controllers: [SolicitudesCambioController],
  providers: [SolicitudesCambioService, CambioAplicadorService, Reloj],
  exports: [SolicitudesCambioService, CambioAplicadorService],
})
export class SolicitudesCambioModule {}
