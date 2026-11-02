import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { NivelTarea, PrismaClient, TipoAlerta, TipoDependencia } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../app.module';
import { Reloj } from '../comun/reloj/reloj';
import { configurarApp } from '../configurar-app';
import { sembrar } from '../../prisma/seed';

async function vaciarBase(prisma: PrismaClient): Promise<void> {
  const tablas = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (tablas.length === 0) return;
  const lista = tablas.map((t) => `"${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${lista} RESTART IDENTITY CASCADE;`);
}

describe('Caso de prueba mínimo completo BD integración PostgreSQL (A5, A6)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();

    const modulo: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(Reloj)
      .useValue({ hoy: () => '2026-11-16' })
      .compile();

    app = modulo.createNestApplication();
    configurarApp(app);
    await app.init();
  });

  afterAll(async () => {
    await vaciarBase(prisma);
    await app.close();
    await prisma.$disconnect();
  });

  it('sembrar() carga exactamente la estructura y conteos esperados en toda la base', async () => {
    await vaciarBase(prisma);
    await sembrar();

    const conteoProyectos = await prisma.proyecto.count();
    expect(conteoProyectos).toBe(1);

    const etapas = await prisma.tarea.count({ where: { nivel: NivelTarea.ETAPA } });
    const actividades = await prisma.tarea.count({ where: { nivel: NivelTarea.ACTIVIDAD } });
    const subactividades = await prisma.tarea.count({ where: { nivel: NivelTarea.SUBACTIVIDAD } });
    const totalTareas = await prisma.tarea.count();

    expect(etapas).toBe(4);
    expect(actividades).toBe(12);
    expect(subactividades).toBe(20);
    expect(totalTareas).toBe(36);

    const dependencias = await prisma.dependencia.findMany();
    const tipos = new Set(dependencias.map((d) => d.tipo));
    expect(tipos.has(TipoDependencia.FS)).toBe(true);
    expect(tipos.has(TipoDependencia.SS)).toBe(true);
    expect(tipos.has(TipoDependencia.FF)).toBe(true);
    expect(tipos.has(TipoDependencia.SF)).toBe(true);

    const conDesfase = dependencias.filter((d) => d.desfaseDias !== 0);
    expect(conDesfase.length).toBeGreaterThanOrEqual(1);

    const profesionales = await prisma.profesional.count();
    expect(profesionales).toBe(5);

    const tiposRecurso = await prisma.tipoRecurso.count();
    expect(tiposRecurso).toBe(4);

    const hitos = await prisma.hito.count();
    expect(hitos).toBe(6);

    const kpisProyecto = await prisma.kpiDefinicion.count({ where: { ambito: 'PROYECTO' } });
    const kpisCambio = await prisma.kpiDefinicion.count({ where: { ambito: 'CAMBIO' } });
    expect(kpisProyecto).toBe(8);
    expect(kpisCambio).toBe(12);

    const solicitudes = await prisma.solicitudCambio.count();
    expect(solicitudes).toBe(5);

    const lineasBase = await prisma.lineaBase.count();
    expect(lineasBase).toBe(0);

    const alertaSobreasignacion = await prisma.alerta.findFirst({
      where: { tipo: TipoAlerta.SOBREASIGNACION, activa: true },
    });
    expect(alertaSobreasignacion).not.toBeNull();
    expect(alertaSobreasignacion?.mensaje).toContain('Valentina Muñoz');

    const resTablero = await request(app.getHttpServer())
      .get('/proyectos/1/tablero')
      .set('X-Rol', 'JP');

    expect(resTablero.status).toBe(200);
    expect(resTablero.body.atrasadas.length).toBeGreaterThanOrEqual(1);
    const codigosAtrasadas = resTablero.body.atrasadas.map((t: { codigo: string }) => t.codigo);
    expect(codigosAtrasadas).toContain('1.1.2');
    expect(codigosAtrasadas).toContain('1.2.1');
  });

  it('comprueba equivalencia D3 de datos importados con docs/caso_prueba.xlsx', async () => {
    await vaciarBase(prisma);
    await sembrar();

    const tareasSemilla = await prisma.tarea.findMany({
      where: { proyectoId: 1 },
      orderBy: { codigo: 'asc' },
    });
    const mapaCodigo = new Map(tareasSemilla.map((t) => [t.id, t.codigo]));

    const firmaTareas = (tareas: typeof tareasSemilla) =>
      tareas
        .map((t) =>
          [
            t.codigo,
            t.nivel,
            t.duracionDias,
            t.inicioPlan ? t.inicioPlan.toISOString().slice(0, 10) : null,
            t.finPlan ? t.finPlan.toISOString().slice(0, 10) : null,
            t.esCritica,
            t.inicioReal ? t.inicioReal.toISOString().slice(0, 10) : null,
            t.finReal ? t.finReal.toISOString().slice(0, 10) : null,
            Number(t.porcentajeAvance),
          ].join('|'),
        )
        .sort();

    const depsSemilla = await prisma.dependencia.findMany({ where: { proyectoId: 1 } });
    const firmaDependencias = (deps: typeof depsSemilla, mapa: Map<number, string>) =>
      deps
        .map(
          (d) =>
            `${mapa.get(d.predecesoraId)}>${mapa.get(d.sucesoraId)}:${d.tipo}:${d.desfaseDias}`,
        )
        .sort();

    const asigsSemilla = await prisma.asignacion.findMany({
      where: { tarea: { proyectoId: 1 } },
      include: { profesional: true, recurso: true },
    });
    const firmaAsignaciones = (asigs: typeof asigsSemilla, mapa: Map<number, string>) =>
      asigs
        .map(
          (a) =>
            `${mapa.get(a.tareaId)}|${a.profesional?.nombre ?? ''}|${a.recurso?.nombre ?? ''}|${Number(a.dedicacion ?? 0)}|${Number(a.horasPlan ?? 0)}|${Number(a.horasReales ?? 0)}|${Number(a.cantidadPlan ?? 0)}`,
        )
        .sort();

    const hitosSemilla = await prisma.hito.findMany({
      where: { proyectoId: 1 },
      orderBy: { nombre: 'asc' },
    });
    const firmaHitos = (hitos: typeof hitosSemilla) =>
      hitos
        .map(
          (h) =>
            `${h.nombre}|${h.fechaObjetivo.toISOString().slice(0, 10)}|${h.fechaCumplimiento ? h.fechaCumplimiento.toISOString().slice(0, 10) : 'null'}|${h.estado}`,
        )
        .sort();

    const padresIds = new Set(
      tareasSemilla.map((t) => t.padreId).filter((id): id is number => id !== null),
    );
    const hojasSemilla = tareasSemilla.filter((t) => !padresIds.has(t.id));
    const costoPlanSemilla = hojasSemilla.reduce((s, t) => s + Number(t.costoPlan), 0);
    const costoRealSemilla = hojasSemilla.reduce((s, t) => s + Number(t.costoReal), 0);

    const resTableroSemilla = await request(app.getHttpServer())
      .get('/proyectos/1/tablero')
      .set('X-Rol', 'JP');

    const rutaExcel = resolve(__dirname, '../../../../docs/caso_prueba.xlsx');
    const buffer = readFileSync(rutaExcel);

    const resImport = await request(app.getHttpServer())
      .post('/importaciones?proyectoId=1&reemplazar=true')
      .set('X-Rol', 'JP')
      .attach('archivo', buffer, 'caso_prueba.xlsx');

    expect(resImport.status).toBe(201);

    const tareasImportadas = await prisma.tarea.findMany({
      where: { proyectoId: 1 },
      orderBy: { codigo: 'asc' },
    });
    const mapaCodigoImport = new Map(tareasImportadas.map((t) => [t.id, t.codigo]));

    expect(firmaTareas(tareasImportadas)).toEqual(firmaTareas(tareasSemilla));

    const depsImportadas = await prisma.dependencia.findMany({ where: { proyectoId: 1 } });
    expect(firmaDependencias(depsImportadas, mapaCodigoImport)).toEqual(
      firmaDependencias(depsSemilla, mapaCodigo),
    );

    const asigsImportadas = await prisma.asignacion.findMany({
      where: { tarea: { proyectoId: 1 } },
      include: { profesional: true, recurso: true },
    });
    expect(firmaAsignaciones(asigsImportadas, mapaCodigoImport)).toEqual(
      firmaAsignaciones(asigsSemilla, mapaCodigo),
    );

    const hitosImportados = await prisma.hito.findMany({
      where: { proyectoId: 1 },
      orderBy: { nombre: 'asc' },
    });
    expect(firmaHitos(hitosImportados)).toEqual(firmaHitos(hitosSemilla));

    const padresImportIds = new Set(
      tareasImportadas.map((t) => t.padreId).filter((id): id is number => id !== null),
    );
    const hojasImportadas = tareasImportadas.filter((t) => !padresImportIds.has(t.id));
    const costoPlanImportado = hojasImportadas.reduce((s, t) => s + Number(t.costoPlan), 0);
    const costoRealImportado = hojasImportadas.reduce((s, t) => s + Number(t.costoReal), 0);

    expect(costoPlanImportado).toBe(costoPlanSemilla);
    expect(costoRealImportado).toBe(costoRealSemilla);

    const resTableroImportado = await request(app.getHttpServer())
      .get('/proyectos/1/tablero')
      .set('X-Rol', 'JP');

    expect(resTableroImportado.body.tarjetas.cpi.valor).toBe(
      resTableroSemilla.body.tarjetas.cpi.valor,
    );

    const atrasadasSemilla = resTableroSemilla.body.atrasadas.map(
      (t: { codigo: string }) => t.codigo,
    );
    const atrasadasImportadas = resTableroImportado.body.atrasadas.map(
      (t: { codigo: string }) => t.codigo,
    );
    expect(atrasadasImportadas.sort()).toEqual(atrasadasSemilla.sort());

    const solicitudesImportadas = await prisma.solicitudCambio.count({
      where: { proyectoId: 1 },
    });
    expect(solicitudesImportadas).toBe(5);

    const kpisTotales = await prisma.kpiDefinicion.count();
    expect(kpisTotales).toBe(20);
  });
});
