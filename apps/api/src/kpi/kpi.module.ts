import { Module } from '@nestjs/common';
import { Reloj } from '../comun/reloj/reloj';
import { KpiController } from './kpi.controller';
import { KpiService } from './kpi.service';

@Module({
  controllers: [KpiController],
  providers: [KpiService, Reloj],
  exports: [KpiService],
})
export class KpiModule {}
