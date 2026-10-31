import { Module } from '@nestjs/common';
import { Reloj } from '../comun/reloj/reloj';
import { ArbolTareasService } from '../tareas/arbol-tareas.service';
import { PasoFechas } from './paso-fechas';
import { PasoCostos } from './paso-costos';
import { PasoAlertas } from './paso-alertas';
import { PasoHitos } from './paso-hitos';
import { PasoKpi } from './paso-kpi';
import { RecalculoService } from './recalculo.service';
import { PASOS_RECALCULO } from './recalculo.tipos';

@Module({
  providers: [
    RecalculoService,
    ArbolTareasService,
    PasoFechas,
    PasoCostos,
    PasoAlertas,
    PasoHitos,
    PasoKpi,
    Reloj,
    {
      provide: PASOS_RECALCULO,
      useFactory: (
        fechas: PasoFechas,
        costos: PasoCostos,
        alertas: PasoAlertas,
        hitos: PasoHitos,
        kpi: PasoKpi,
      ) => [fechas, costos, alertas, hitos, kpi],
      inject: [PasoFechas, PasoCostos, PasoAlertas, PasoHitos, PasoKpi],
    },
  ],
  exports: [RecalculoService, ArbolTareasService],
})
export class RecalculoModule {}
