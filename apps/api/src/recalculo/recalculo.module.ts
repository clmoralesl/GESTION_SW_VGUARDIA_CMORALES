import { Module } from '@nestjs/common';
import { Reloj } from '../comun/reloj/reloj';
import { ArbolTareasService } from '../tareas/arbol-tareas.service';
import { PasoFechas } from './paso-fechas';
import { PasoCostos } from './paso-costos';
import { PasoAlertas } from './paso-alertas';
import { PasoHitos } from './paso-hitos';
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
    Reloj,
    {
      provide: PASOS_RECALCULO,
      useFactory: (
        fechas: PasoFechas,
        costos: PasoCostos,
        alertas: PasoAlertas,
        hitos: PasoHitos,
      ) => [fechas, costos, alertas, hitos],
      inject: [PasoFechas, PasoCostos, PasoAlertas, PasoHitos],
    },
  ],
  exports: [RecalculoService, ArbolTareasService],
})
export class RecalculoModule {}
