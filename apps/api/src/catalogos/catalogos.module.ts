import { Module } from '@nestjs/common';
import { BitacoraModule } from '../comun/bitacora/bitacora.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProfesionalesController } from './profesionales.controller';
import { ProfesionalesService } from './profesionales.service';
import { RecursosController } from './recursos.controller';
import { RecursosService } from './recursos.service';
import { TiposRecursoController } from './tipos-recurso.controller';
import { TiposRecursoService } from './tipos-recurso.service';

@Module({
  imports: [PrismaModule, BitacoraModule],
  controllers: [ProfesionalesController, RecursosController, TiposRecursoController],
  providers: [ProfesionalesService, RecursosService, TiposRecursoService],
  exports: [ProfesionalesService, RecursosService, TiposRecursoService],
})
export class CatalogosModule {}
