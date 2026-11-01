import { Module } from '@nestjs/common';
import { BitacoraModule } from '../comun/bitacora/bitacora.module';
import { Reloj } from '../comun/reloj/reloj';
import { PrismaModule } from '../prisma/prisma.module';
import { SolicitudesCambioController } from './solicitudes-cambio.controller';
import { SolicitudesCambioService } from './solicitudes-cambio.service';

@Module({
  imports: [PrismaModule, BitacoraModule],
  controllers: [SolicitudesCambioController],
  providers: [SolicitudesCambioService, Reloj],
  exports: [SolicitudesCambioService],
})
export class SolicitudesCambioModule {}
