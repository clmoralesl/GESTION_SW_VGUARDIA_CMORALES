import { Module } from '@nestjs/common';
import { LineasBaseController } from './lineas-base.controller';
import { LineasBaseService } from './lineas-base.service';

@Module({
  controllers: [LineasBaseController],
  providers: [LineasBaseService],
  exports: [LineasBaseService],
})
export class LineasBaseModule {}
