import { Global, Module } from '@nestjs/common';
import { BitacoraController } from './bitacora.controller';
import { BitacoraLecturaService } from './bitacora-lectura.service';
import { BitacoraService } from './bitacora.service';

@Global()
@Module({
  controllers: [BitacoraController],
  providers: [BitacoraService, BitacoraLecturaService],
  exports: [BitacoraService, BitacoraLecturaService],
})
export class BitacoraModule {}
