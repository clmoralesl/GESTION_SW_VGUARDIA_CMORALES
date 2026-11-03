import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AccionBitacora, NivelTarea, PrismaClient, RolUsuario } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { RegistroBitacora } from '@autofix/core';
import { AppModule } from '../../app.module';
import { Reloj } from '../reloj/reloj';
import { configurarApp } from '../../configurar-app';
import { sembrar } from '../../../prisma/seed';

async function vaciarBase(prisma: PrismaClient): Promise<void> {
  const tablas = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (tablas.length === 0) return;
  const lista = tablas.map((t) => `"${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${lista} RESTART IDENTITY CASCADE;`);
}

describe('Bitacora BD integración PostgreSQL (A7)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let proyectoId: number;
  let tareaId: number;
  let solicitudId: number;
  let codigoSolicitud: string;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();

    const modulo: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(Reloj)
      .useValue({ hoy: () => '2026-11-02' })
      .compile();

    app = modulo.createNestApplication();
    configurarApp(app);
    await app.init();

    await sembrar();

    const sufijo = Date.now();
    const proyecto = await prisma.proyecto.create({
      data: {
        nombre: `Proyecto Bitacora ${sufijo}`,
        responsable: 'Valeria Guardia',
        fechaInicio: new Date('2026-11-02T00:00:00Z'),
      },
    });
    proyectoId = proyecto.id;

    const tarea = await prisma.tarea.create({
      data: {
        proyectoId,
        codigo: 'T-1',
        nombre: 'Tarea Prueba Bitacora',
        nivel: NivelTarea.ETAPA,
        duracionDias: 5,
        inicioPlan: new Date('2026-11-02T00:00:00Z'),
        finPlan: new Date('2026-11-06T00:00:00Z'),
        orden: 1,
      },
    });
    tareaId = tarea.id;

    codigoSolicitud = `SC-${String(sufijo).slice(-3)}`;
    const solicitud = await prisma.solicitudCambio.create({
      data: {
        proyectoId,
        codigo: codigoSolicitud,
        titulo: 'Solicitud Trazabilidad',
        descripcion: 'Descripcion trazabilidad',
        justificacion: 'Justificacion trazabilidad',
        solicitante: 'Valeria Guardia',
        responsable: 'Carlos Morales',
        categoria: 'ALCANCE',
        probabilidadRiesgo: 2,
        impactoRiesgo: 3,
      },
    });
    solicitudId = solicitud.id;

    await prisma.bitacora.create({
      data: {
        proyectoId,
        entidad: 'Tarea',
        entidadId: tareaId,
        rol: RolUsuario.JEFE_PROYECTO,
        accion: AccionBitacora.ACTUALIZAR,
        campo: 'duracionDias',
        valorAnterior: 5,
        valorNuevo: 8,
        fecha: new Date('2026-11-02T10:00:00.000Z'),
        origen: null,
      },
    });

    await prisma.bitacora.create({
      data: {
        proyectoId,
        entidad: 'Tarea',
        entidadId: tareaId,
        rol: RolUsuario.COMITE_CAMBIOS,
        accion: AccionBitacora.ACTUALIZAR,
        campo: 'duracionDias',
        valorAnterior: 8,
        valorNuevo: 12,
        fecha: new Date('2026-11-02T11:00:00.000Z'),
        origen: 'Aprobación de impacto',
        solicitudCambioId: solicitudId,
      },
    });

    await prisma.bitacora.create({
      data: {
        proyectoId,
        entidad: 'SolicitudCambio',
        entidadId: solicitudId,
        rol: RolUsuario.COMITE_CAMBIOS,
        accion: AccionBitacora.RECHAZAR,
        campo: null,
        valorAnterior: null,
        valorNuevo: null,
        fecha: new Date('2026-11-02T11:30:00.000Z'),
        origen: 'Rechazo por comite',
        solicitudCambioId: solicitudId,
      },
    });

    await prisma.bitacora.create({
      data: {
        proyectoId,
        entidad: 'Proyecto',
        entidadId: proyectoId,
        rol: RolUsuario.JEFE_PROYECTO,
        accion: AccionBitacora.RECALCULAR,
        campo: null,
        valorAnterior: null,
        valorNuevo: { tareasAfectadas: 1 },
        fecha: new Date('2026-11-02T12:00:00.000Z'),
        origen: 'Recálculo tras mover tarea',
      },
    });

    await prisma.bitacora.create({
      data: {
        proyectoId,
        entidad: 'Proyecto',
        entidadId: proyectoId,
        rol: RolUsuario.JEFE_PROYECTO,
        accion: AccionBitacora.IMPORTAR,
        campo: null,
        valorAnterior: null,
        valorNuevo: { tareas: 1 },
        fecha: new Date('2026-11-01T15:00:00.000Z'),
        origen: 'Importación de plantilla',
      },
    });
  });

  afterAll(async () => {
    await vaciarBase(prisma);
    await app.close();
    await prisma.$disconnect();
  });

  it('verifica el origen de cada categoria D1 derivado al leer', async () => {
    const res = await request(app.getHttpServer())
      .get(`/bitacora?proyectoId=${proyectoId}&tamanoPagina=100`)
      .set('X-Rol', 'JP');

    expect(res.status).toBe(200);
    const filas = res.body.registros;
    expect(filas.length).toBe(5);

    const manual = filas.find(
      (f: RegistroBitacora) => f.accion === 'ACTUALIZAR' && !f.origen.solicitudCambioId,
    );
    expect(manual).toBeDefined();
    expect(manual?.origen.tipo).toBe('MANUAL');
    expect(manual?.origen.etiqueta).toBe('Manual');
    expect(manual?.origen.detalle).toBeNull();

    const aprobacion = filas.find(
      (f: RegistroBitacora) => f.accion === 'ACTUALIZAR' && f.origen.solicitudCambioId,
    );
    expect(aprobacion).toBeDefined();
    expect(aprobacion?.origen.tipo).toBe('APROBACION');
    expect(aprobacion?.origen.etiqueta).toBe(`Aprobación ${codigoSolicitud}`);
    expect(aprobacion?.origen.solicitudCambioId).toBe(solicitudId);
    expect(aprobacion?.origen.detalle).toBe('Aprobación de impacto');

    const rechazo = filas.find((f: RegistroBitacora) => f.accion === 'RECHAZAR');
    expect(rechazo).toBeDefined();
    expect(rechazo?.origen.tipo).toBe('RECHAZO');
    expect(rechazo?.origen.etiqueta).toBe(`Rechazo ${codigoSolicitud}`);
    expect(rechazo?.origen.solicitudCambioId).toBe(solicitudId);

    const recalculo = filas.find((f: RegistroBitacora) => f.accion === 'RECALCULAR');
    expect(recalculo).toBeDefined();
    expect(recalculo?.origen.tipo).toBe('RECALCULO');
    expect(recalculo?.origen.etiqueta).toBe('Recálculo');
    expect(recalculo?.origen.detalle).toBe('Recálculo tras mover tarea');

    const importacion = filas.find((f: RegistroBitacora) => f.accion === 'IMPORTAR');
    expect(importacion).toBeDefined();
    expect(importacion?.origen.tipo).toBe('IMPORTACION');
    expect(importacion?.origen.etiqueta).toBe('Importación');
    expect(importacion?.origen.detalle).toBe('Importación de plantilla');
  });

  it('comprueba cada filtro solo y combinado', async () => {
    const fEntidad = await request(app.getHttpServer())
      .get(`/bitacora?proyectoId=${proyectoId}&entidad=Tarea`)
      .set('X-Rol', 'JP');
    expect(fEntidad.status).toBe(200);
    expect(fEntidad.body.total).toBe(2);
    expect(fEntidad.body.registros.every((r: RegistroBitacora) => r.entidad === 'Tarea')).toBe(
      true,
    );

    const fEntidadId = await request(app.getHttpServer())
      .get(`/bitacora?proyectoId=${proyectoId}&entidad=Tarea&entidadId=${tareaId}`)
      .set('X-Rol', 'JP');
    expect(fEntidadId.status).toBe(200);
    expect(fEntidadId.body.total).toBe(2);

    const fRol = await request(app.getHttpServer())
      .get(`/bitacora?proyectoId=${proyectoId}&rol=CC`)
      .set('X-Rol', 'JP');
    expect(fRol.status).toBe(200);
    expect(fRol.body.total).toBe(2);
    expect(fRol.body.registros.every((r: RegistroBitacora) => r.rol === 'CC')).toBe(true);

    const fAccion = await request(app.getHttpServer())
      .get(`/bitacora?proyectoId=${proyectoId}&accion=RECALCULAR`)
      .set('X-Rol', 'JP');
    expect(fAccion.status).toBe(200);
    expect(fAccion.body.total).toBe(1);
    expect(fAccion.body.registros[0].accion).toBe('RECALCULAR');

    const fDesde = await request(app.getHttpServer())
      .get(`/bitacora?proyectoId=${proyectoId}&desde=2026-11-02`)
      .set('X-Rol', 'JP');
    expect(fDesde.status).toBe(200);
    expect(fDesde.body.total).toBe(4);

    const fHasta = await request(app.getHttpServer())
      .get(`/bitacora?proyectoId=${proyectoId}&hasta=2026-11-01`)
      .set('X-Rol', 'JP');
    expect(fHasta.status).toBe(200);
    expect(fHasta.body.total).toBe(1);
    expect(fHasta.body.registros[0].accion).toBe('IMPORTAR');

    const fCombinado = await request(app.getHttpServer())
      .get(
        `/bitacora?proyectoId=${proyectoId}&entidad=Tarea&rol=JP&desde=2026-11-02&hasta=2026-11-02`,
      )
      .set('X-Rol', 'JP');
    expect(fCombinado.status).toBe(200);
    expect(fCombinado.body.total).toBe(1);
    expect(fCombinado.body.registros[0].accion).toBe('ACTUALIZAR');
    expect(fCombinado.body.registros[0].campo).toBe('duracionDias');
    expect(fCombinado.body.registros[0].origen.tipo).toBe('MANUAL');
  });

  it('paginacion total y totalPaginas en 3 paginas con orden estable sin filas repetidas de createMany', async () => {
    const sufijo = Date.now();
    const proyPag = await prisma.proyecto.create({
      data: {
        nombre: `Proyecto Pag ${sufijo}`,
        responsable: 'Valeria Guardia',
        fechaInicio: new Date('2026-11-02T00:00:00Z'),
      },
    });

    const fechaFija = new Date('2026-11-02T15:30:00.000Z');
    await prisma.bitacora.createMany({
      data: [
        {
          proyectoId: proyPag.id,
          entidad: 'Tarea',
          entidadId: 1,
          rol: RolUsuario.JEFE_PROYECTO,
          accion: AccionBitacora.CREAR,
          fecha: fechaFija,
        },
        {
          proyectoId: proyPag.id,
          entidad: 'Tarea',
          entidadId: 2,
          rol: RolUsuario.JEFE_PROYECTO,
          accion: AccionBitacora.CREAR,
          fecha: fechaFija,
        },
        {
          proyectoId: proyPag.id,
          entidad: 'Tarea',
          entidadId: 3,
          rol: RolUsuario.JEFE_PROYECTO,
          accion: AccionBitacora.CREAR,
          fecha: fechaFija,
        },
        {
          proyectoId: proyPag.id,
          entidad: 'Tarea',
          entidadId: 4,
          rol: RolUsuario.JEFE_PROYECTO,
          accion: AccionBitacora.CREAR,
          fecha: fechaFija,
        },
        {
          proyectoId: proyPag.id,
          entidad: 'Tarea',
          entidadId: 5,
          rol: RolUsuario.JEFE_PROYECTO,
          accion: AccionBitacora.CREAR,
          fecha: fechaFija,
        },
      ],
    });

    const filasCreadas = await prisma.bitacora.findMany({
      where: { proyectoId: proyPag.id },
      orderBy: { id: 'asc' },
    });
    await prisma.bitacora.update({
      where: { id: filasCreadas[0].id },
      data: { campo: 'reordenado' },
    });

    const pag1 = await request(app.getHttpServer())
      .get(`/bitacora?proyectoId=${proyPag.id}&pagina=1&tamanoPagina=2`)
      .set('X-Rol', 'JP');
    expect(pag1.status).toBe(200);
    expect(pag1.body.total).toBe(5);
    expect(pag1.body.totalPaginas).toBe(3);
    expect(pag1.body.registros.length).toBe(2);

    const pag2 = await request(app.getHttpServer())
      .get(`/bitacora?proyectoId=${proyPag.id}&pagina=2&tamanoPagina=2`)
      .set('X-Rol', 'JP');
    expect(pag2.status).toBe(200);
    expect(pag2.body.registros.length).toBe(2);

    const pag3 = await request(app.getHttpServer())
      .get(`/bitacora?proyectoId=${proyPag.id}&pagina=3&tamanoPagina=2`)
      .set('X-Rol', 'JP');
    expect(pag3.status).toBe(200);
    expect(pag3.body.registros.length).toBe(1);

    const idsPag1 = pag1.body.registros.map((r: RegistroBitacora) => r.id);
    const idsPag2 = pag2.body.registros.map((r: RegistroBitacora) => r.id);
    const idsPag3 = pag3.body.registros.map((r: RegistroBitacora) => r.id);
    const todosIds = [...idsPag1, ...idsPag2, ...idsPag3];

    expect(new Set(todosIds).size).toBe(5);
    expect(todosIds).toHaveLength(5);
    for (let i = 0; i < todosIds.length - 1; i++) {
      expect(todosIds[i]).toBeGreaterThan(todosIds[i + 1]);
    }
  });

  it('GET /solicitudes-cambio/:id/historial reune la solicitud y sus entidades asociadas', async () => {
    const res = await request(app.getHttpServer())
      .get(`/solicitudes-cambio/${solicitudId}/historial`)
      .set('X-Rol', 'JP');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.registros.length).toBe(2);

    const codigos = res.body.registros.map((r: RegistroBitacora) => r.origen.etiqueta);
    expect(codigos).toContain(`Aprobación ${codigoSolicitud}`);
    expect(codigos).toContain(`Rechazo ${codigoSolicitud}`);
  });

  it('el historial de solicitud incluye sus etapas sin solicitudCambioId y excluye las de otra solicitud', async () => {
    const otra = await prisma.solicitudCambio.create({
      data: {
        proyectoId,
        codigo: `SC-O${String(Date.now()).slice(-3)}`,
        titulo: 'Otra solicitud',
        descripcion: 'Otra',
        justificacion: 'Otra',
        solicitante: 'Valeria Guardia',
        responsable: 'Carlos Morales',
        categoria: 'ALCANCE',
        probabilidadRiesgo: 1,
        impactoRiesgo: 1,
      },
    });
    const etapaPropia = await prisma.etapaCambio.create({
      data: { solicitudId, numero: 1, nombre: 'Identificar la necesidad del cambio' },
    });
    const etapaAjena = await prisma.etapaCambio.create({
      data: { solicitudId: otra.id, numero: 1, nombre: 'Identificar la necesidad del cambio' },
    });
    for (const etapa of [etapaPropia, etapaAjena]) {
      await prisma.bitacora.create({
        data: {
          proyectoId,
          entidad: 'EtapaCambio',
          entidadId: etapa.id,
          rol: RolUsuario.COMITE_CAMBIOS,
          accion: AccionBitacora.ACTUALIZAR,
          campo: 'estado',
          valorAnterior: 'EN_CURSO',
          valorNuevo: 'COMPLETADA',
        },
      });
    }

    const res = await request(app.getHttpServer())
      .get(`/solicitudes-cambio/${solicitudId}/historial`)
      .set('X-Rol', 'CC');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    const etapas = res.body.registros.filter((r: RegistroBitacora) => r.entidad === 'EtapaCambio');
    expect(etapas.map((r: RegistroBitacora) => r.entidadId)).toEqual([etapaPropia.id]);
    expect(etapas[0].origen.etiqueta).toBe('Manual');
  });

  it('importar caso_prueba.xlsx deja exactamente un registro IMPORTAR en la bitacora', async () => {
    const rutaExcel = resolve(__dirname, '../../../../../docs/caso_prueba.xlsx');
    const buffer = readFileSync(rutaExcel);

    const res = await request(app.getHttpServer())
      .post('/importaciones')
      .set('X-Rol', 'JP')
      .attach('archivo', buffer, 'caso_prueba.xlsx');

    expect(res.status).toBe(201);
    const idImportado = res.body.proyectoId;

    const filasImportar = await prisma.bitacora.findMany({
      where: { proyectoId: idImportado, accion: 'IMPORTAR' },
    });

    expect(filasImportar.length).toBe(1);
    expect(filasImportar[0].entidad).toBe('Proyecto');
    expect(filasImportar[0].entidadId).toBe(idImportado);
    expect(filasImportar[0].valorNuevo).toMatchObject({
      tareas: expect.any(Number),
      dependencias: expect.any(Number),
    });
  });
});
