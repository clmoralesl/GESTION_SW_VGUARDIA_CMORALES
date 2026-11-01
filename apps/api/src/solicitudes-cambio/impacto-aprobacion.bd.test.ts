import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EstadoEtapa, EstadoSolicitud, PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  crearCalendarioLaboral,
  dateAFechaIso,
  DIAS_LABORABLES_POR_DEFECTO,
  diasHabilesEntre,
  feriadosChileDesde,
  type TareaArbol,
} from '@autofix/core';
import { AppModule } from '../app.module';
import { configurarApp } from '../configurar-app';

describe('Impacto y aprobación BD integración PostgreSQL', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let proyectoId: number;
  let kpiId: number;
  let profesionalId: number;

  const calendario = crearCalendarioLaboral({
    diasLaborables: DIAS_LABORABLES_POR_DEFECTO,
    feriados: feriadosChileDesde('2026-01-01').map((f) => f.fecha),
  });

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();

    const modulo: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = modulo.createNestApplication();
    configurarApp(app);
    await app.init();

    const resProyecto = await request(app.getHttpServer())
      .post('/proyectos')
      .set('X-Rol', 'JP')
      .send({
        nombre: 'Proyecto Test Impacto BD',
        descripcion: 'Verificación de impactos y aprobación',
        responsable: 'Carlos Morales',
        presupuesto: 30000000,
        fechaInicio: '2026-11-02',
      });
    expect(resProyecto.status).toBe(201);
    proyectoId = resProyecto.body.id as number;

    const resEtapa = await request(app.getHttpServer())
      .post(`/proyectos/${proyectoId}/tareas`)
      .set('X-Rol', 'JP')
      .send({
        nivel: 'ETAPA',
        padreId: null,
        nombre: 'Etapa 1',
        duracionDias: 1,
      });
    expect(resEtapa.status).toBe(201);
    const etapaId = resEtapa.body.arbol.tareas[0].id as number;

    const resTareaA = await request(app.getHttpServer())
      .post(`/proyectos/${proyectoId}/tareas`)
      .set('X-Rol', 'JP')
      .send({
        nivel: 'ACTIVIDAD',
        padreId: etapaId,
        nombre: 'Tarea Inicial',
        duracionDias: 5,
      });
    expect(resTareaA.status).toBe(201);
    const tareaA = resTareaA.body.arbol.tareas.find(
      (t: TareaArbol) => t.nombre === 'Tarea Inicial',
    );

    const resTareaB = await request(app.getHttpServer())
      .post(`/proyectos/${proyectoId}/tareas`)
      .set('X-Rol', 'JP')
      .send({
        nivel: 'ACTIVIDAD',
        padreId: etapaId,
        nombre: 'Tarea Final',
        duracionDias: 3,
      });
    expect(resTareaB.status).toBe(201);
    const tareaB = resTareaB.body.arbol.tareas.find((t: TareaArbol) => t.nombre === 'Tarea Final');

    const resDep = await request(app.getHttpServer())
      .post(`/proyectos/${proyectoId}/dependencias`)
      .set('X-Rol', 'JP')
      .send({
        predecesoraId: tareaA.id,
        sucesoraId: tareaB.id,
        tipo: 'FS',
        desfaseDias: 0,
      });
    expect(resDep.status).toBe(201);

    const prof = await prisma.profesional.create({
      data: {
        nombre: 'Carlos Desarrollador',
        claveNombre: 'carlos desarrollador',
        cargo: 'Senior Dev',
        tarifaHora: 10000,
        horasDiarias: 8,
        activo: true,
      },
    });
    profesionalId = prof.id;

    await request(app.getHttpServer())
      .post(`/tareas/${tareaA.id}/asignaciones`)
      .set('X-Rol', 'JP')
      .send({ profesionalId: prof.id, dedicacion: 100 });

    const resEstado = await request(app.getHttpServer())
      .post(`/proyectos/${proyectoId}/iniciar`)
      .set('X-Rol', 'JP');
    expect(resEstado.status).toBe(200);

    await prisma.tarea.update({
      where: { id: tareaA.id },
      data: { porcentajeAvance: 50 },
    });
    process.env.FECHA_CORTE = '2026-11-04';

    const lineasBaseIniciales = await prisma.lineaBase.findMany({
      where: { proyectoId },
    });
    expect(lineasBaseIniciales).toHaveLength(1);
    expect(lineasBaseIniciales[0]!.version).toBe(1);

    const kpi = await prisma.kpiDefinicion.create({
      data: {
        codigo: `SPI_BD_${Date.now()}`,
        nombre: 'SPI BD Integración',
        ambito: 'PROYECTO',
        formula: 'EV / PV',
        unidad: 'INDICE',
        meta: 1,
        direccion: 'MAYOR_MEJOR',
        umbrales: {
          create: [
            { semaforo: 'VERDE', valorDesde: 0.95 },
            { semaforo: 'AMARILLO', valorDesde: 0.85 },
          ],
        },
      },
    });
    kpiId = kpi.id;
  });

  afterAll(async () => {
    delete process.env.FECHA_CORTE;
    if (kpiId) {
      await prisma.kpiMedicion.deleteMany({ where: { kpiId } });
      await prisma.kpiDefinicion.delete({ where: { id: kpiId } });
    }
    if (proyectoId) {
      await prisma.solicitudCambio.deleteMany({ where: { proyectoId } });
      await prisma.asignacion.deleteMany({ where: { tarea: { proyectoId } } });
      await prisma.proyecto.delete({ where: { id: proyectoId } });
    }
    if (profesionalId) {
      await prisma.profesional.delete({ where: { id: profesionalId } });
    }
    await app.close();
    await prisma.$disconnect();
  });

  it('criterio de 3 dias habiles: fin desplazado 3 dias habiles, v2 con solicitudCambioId y aplicado true', async () => {
    const tareasAntes = await prisma.tarea.findMany({
      where: { proyectoId, nivel: 'ACTIVIDAD' },
      orderBy: { id: 'asc' },
    });
    const tareaA = tareasAntes[0]!;
    const tareaB = tareasAntes[1]!;

    const lbV1 = await prisma.lineaBase.findUnique({
      where: { proyectoId_version: { proyectoId, version: 1 } },
    });
    expect(lbV1?.fechaFinProyecto).not.toBeNull();
    const fechaFinIsoAntes = dateAFechaIso(lbV1!.fechaFinProyecto!);

    const resSol = await request(app.getHttpServer())
      .post(`/proyectos/${proyectoId}/solicitudes-cambio`)
      .set('X-Rol', 'JP')
      .send({
        titulo: 'Aumento plazo tarea crítica',
        descripcion: 'Requiere 3 dias adicionales',
        justificacion: 'Ajuste de alcance',
        solicitante: 'Carlos Morales',
        responsable: 'Carlos Morales',
        prioridad: 'ALTA',
        categoria: 'PLAZO',
        probabilidadRiesgo: 2,
        impactoRiesgo: 3,
      });
    expect(resSol.status).toBe(201);
    const solicitudId = resSol.body.id as number;

    const resImpacto = await request(app.getHttpServer())
      .post(`/solicitudes-cambio/${solicitudId}/impactos`)
      .set('X-Rol', 'JP')
      .send({
        tipo: 'DURACION',
        tareaId: tareaA.id,
        duracionDias: tareaA.duracionDias + 3,
      });
    expect(resImpacto.status).toBe(201);

    const resImpactoPresupuesto = await request(app.getHttpServer())
      .post(`/solicitudes-cambio/${solicitudId}/impactos`)
      .set('X-Rol', 'JP')
      .send({
        tipo: 'PRESUPUESTO',
        presupuesto: 60000000,
      });
    expect(resImpactoPresupuesto.status).toBe(201);

    await prisma.etapaCambio.updateMany({
      where: { solicitudId, numero: { in: [1, 2, 3] } },
      data: { estado: EstadoEtapa.COMPLETADA },
    });
    await prisma.solicitudCambio.update({
      where: { id: solicitudId },
      data: { estado: EstadoSolicitud.EN_EVALUACION, etapaActual: 3 },
    });

    const resAprobar = await request(app.getHttpServer())
      .post(`/solicitudes-cambio/${solicitudId}/aprobar`)
      .set('X-Rol', 'CC');
    expect(resAprobar.status).toBe(200);
    expect(resAprobar.body.antes.spi).not.toBeNull();
    expect(resAprobar.body.despues.spi).not.toBeNull();
    expect(resAprobar.body.despues.spi).not.toBe(resAprobar.body.antes.spi);

    const lineaBaseV2 = await prisma.lineaBase.findUnique({
      where: { proyectoId_version: { proyectoId, version: 2 } },
      include: { tareas: true },
    });
    expect(lineaBaseV2).not.toBeNull();
    expect(lineaBaseV2?.solicitudCambioId).toBe(solicitudId);
    expect(lineaBaseV2?.fechaFinProyecto).not.toBeNull();

    const fechaFinIsoDespues = dateAFechaIso(lineaBaseV2!.fechaFinProyecto!);
    const diasDiferencia = diasHabilesEntre(fechaFinIsoAntes, fechaFinIsoDespues, calendario);
    expect(diasDiferencia).toBe(3);

    const tareaBDespues = await prisma.tarea.findUnique({
      where: { id: tareaB.id },
    });
    const diasTareaB = diasHabilesEntre(
      dateAFechaIso(tareaB.finPlan!),
      dateAFechaIso(tareaBDespues!.finPlan!),
      calendario,
    );
    expect(diasTareaB).toBe(3);

    const lbTareaA = lineaBaseV2?.tareas.find((t) => t.tareaId === tareaA.id);
    expect(lbTareaA?.duracionDias).toBe(tareaA.duracionDias + 3);

    const impactoDb = await prisma.impactoCambio.findUnique({
      where: { id: resImpacto.body.id },
    });
    expect(impactoDb?.aplicado).toBe(true);

    const solicitudDb = await prisma.solicitudCambio.findUnique({
      where: { id: solicitudId },
    });
    expect(solicitudDb?.estado).toBe(EstadoSolicitud.APROBADA);
    expect(solicitudDb?.fechaDecision).not.toBeNull();

    const bitacoraAprobacion = await prisma.bitacora.findFirst({
      where: {
        proyectoId,
        entidad: 'SolicitudCambio',
        entidadId: solicitudId,
        accion: 'APROBAR',
      },
    });
    expect(bitacoraAprobacion).not.toBeNull();
    expect(bitacoraAprobacion?.solicitudCambioId).toBe(solicitudId);

    const bitacoraLineaBase = await prisma.bitacora.findFirst({
      where: {
        proyectoId,
        entidad: 'LineaBase',
        accion: 'CREAR',
        solicitudCambioId: solicitudId,
      },
    });
    expect(bitacoraLineaBase).not.toBeNull();

    const bitacoraPresupuesto = await prisma.bitacora.findFirst({
      where: {
        proyectoId,
        entidad: 'Proyecto',
        entidadId: proyectoId,
        campo: 'presupuesto',
        solicitudCambioId: solicitudId,
      },
    });
    expect(bitacoraPresupuesto).not.toBeNull();
    expect(Number(bitacoraPresupuesto?.valorNuevo)).toBe(60000000);

    const medicionesRecientes = await prisma.kpiMedicion.findMany({
      where: { proyectoId },
      include: { kpi: true },
      orderBy: { id: 'desc' },
      take: 5,
    });
    expect(medicionesRecientes.length).toBeGreaterThan(0);
  });

  it('registro de impacto con ciclo: 409 y sin cambios en BD', async () => {
    const resSol = await request(app.getHttpServer())
      .post(`/proyectos/${proyectoId}/solicitudes-cambio`)
      .set('X-Rol', 'JP')
      .send({
        titulo: 'Solicitud con ciclo de dependencias',
        descripcion: 'Prueba de validacion y rollback ante ciclo',
        justificacion: 'Verificar proteccion de integridad',
        solicitante: 'Carlos Morales',
        responsable: 'Carlos Morales',
        prioridad: 'MEDIA',
        categoria: 'ALCANCE',
        probabilidadRiesgo: 2,
        impactoRiesgo: 2,
      });
    expect(resSol.status).toBe(201);
    const solicitudId = resSol.body.id as number;

    const [conteoLbAntes, conteoMedAntes, conteoBitAntes, tareasAntes] = await Promise.all([
      prisma.lineaBase.count({ where: { proyectoId } }),
      prisma.kpiMedicion.count({ where: { proyectoId } }),
      prisma.bitacora.count({ where: { proyectoId } }),
      prisma.tarea.findMany({
        where: { proyectoId },
        select: { id: true, duracionDias: true },
        orderBy: { id: 'asc' },
      }),
    ]);

    const resImpactoCiclo = await request(app.getHttpServer())
      .post(`/solicitudes-cambio/${solicitudId}/impactos`)
      .set('X-Rol', 'JP')
      .send({
        tipo: 'NUEVA_TAREA',
        clave: 'N1',
        padreId: tareasAntes[0]!.id,
        nombre: 'Tarea ciclica',
        duracionDias: 2,
        predecesoras: [{ clave: 'N1', tipo: 'FS', desfaseDias: 0 }],
      });

    expect(resImpactoCiclo.status).toBe(409);
    expect(resImpactoCiclo.body.codigo).toBe('IMPACTO_INVALIDO');

    const [conteoLbDespues, conteoMedDespues, conteoBitDespues, tareasDespues] = await Promise.all([
      prisma.lineaBase.count({ where: { proyectoId } }),
      prisma.kpiMedicion.count({ where: { proyectoId } }),
      prisma.bitacora.count({ where: { proyectoId } }),
      prisma.tarea.findMany({
        where: { proyectoId },
        select: { id: true, duracionDias: true },
        orderBy: { id: 'asc' },
      }),
    ]);

    expect(conteoLbDespues).toBe(conteoLbAntes);
    expect(conteoMedDespues).toBe(conteoMedAntes);
    expect(conteoBitDespues).toBe(conteoBitAntes);
    expect(tareasDespues).toEqual(tareasAntes);
  });

  it('falla en aprobacion: 409 por profesional inactivo y rollback total sin cambios en BD', async () => {
    const resSol = await request(app.getHttpServer())
      .post(`/proyectos/${proyectoId}/solicitudes-cambio`)
      .set('X-Rol', 'JP')
      .send({
        titulo: 'Solicitud con falla de aprobacion',
        descripcion: 'Verificar rollback integral al fallar paso de aprobacion',
        justificacion: 'Prueba de atomicidad transaccional',
        solicitante: 'Carlos Morales',
        responsable: 'Carlos Morales',
        prioridad: 'ALTA',
        categoria: 'COSTO',
        probabilidadRiesgo: 2,
        impactoRiesgo: 3,
      });
    expect(resSol.status).toBe(201);
    const solicitudId = resSol.body.id as number;

    const resImpPresupuesto = await request(app.getHttpServer())
      .post(`/solicitudes-cambio/${solicitudId}/impactos`)
      .set('X-Rol', 'JP')
      .send({
        tipo: 'PRESUPUESTO',
        presupuesto: 99000000,
      });
    expect(resImpPresupuesto.status).toBe(201);

    const profInactivo = await prisma.profesional.create({
      data: {
        nombre: 'Profesional Inactivo Test',
        claveNombre: 'profesional inactivo test',
        cargo: 'Especialista',
        tarifaHora: 25000,
        horasDiarias: 8,
        activo: true,
      },
    });

    const tareas = await prisma.tarea.findMany({
      where: { proyectoId, nivel: 'ACTIVIDAD' },
      orderBy: { id: 'asc' },
    });

    const resImpAsignacion = await request(app.getHttpServer())
      .post(`/solicitudes-cambio/${solicitudId}/impactos`)
      .set('X-Rol', 'JP')
      .send({
        tipo: 'ASIGNACION',
        tareaId: tareas[0]!.id,
        operacion: 'agregar',
        elemento: 'PROFESIONAL',
        profesionalId: profInactivo.id,
        dedicacion: 50,
      });
    expect(resImpAsignacion.status).toBe(201);

    await prisma.etapaCambio.updateMany({
      where: { solicitudId, numero: { in: [1, 2, 3] } },
      data: { estado: EstadoEtapa.COMPLETADA },
    });
    await prisma.solicitudCambio.update({
      where: { id: solicitudId },
      data: { estado: EstadoSolicitud.EN_EVALUACION, etapaActual: 3 },
    });

    const [conteoLbAntes, conteoMedAntes, conteoBitAntes, proyAntes] = await Promise.all([
      prisma.lineaBase.count({ where: { proyectoId } }),
      prisma.kpiMedicion.count({ where: { proyectoId } }),
      prisma.bitacora.count({ where: { proyectoId } }),
      prisma.proyecto.findUniqueOrThrow({ where: { id: proyectoId } }),
    ]);

    await prisma.profesional.update({
      where: { id: profInactivo.id },
      data: { activo: false },
    });

    const resAprobar = await request(app.getHttpServer())
      .post(`/solicitudes-cambio/${solicitudId}/aprobar`)
      .set('X-Rol', 'CC');

    expect(resAprobar.status).toBe(409);
    expect(resAprobar.body.codigo).toBe('PROFESIONAL_INACTIVO');

    const [
      conteoLbDespues,
      conteoMedDespues,
      conteoBitDespues,
      proyDespues,
      solDespues,
      impPresDb,
      impAsigDb,
    ] = await Promise.all([
      prisma.lineaBase.count({ where: { proyectoId } }),
      prisma.kpiMedicion.count({ where: { proyectoId } }),
      prisma.bitacora.count({ where: { proyectoId } }),
      prisma.proyecto.findUniqueOrThrow({ where: { id: proyectoId } }),
      prisma.solicitudCambio.findUniqueOrThrow({ where: { id: solicitudId } }),
      prisma.impactoCambio.findUniqueOrThrow({ where: { id: resImpPresupuesto.body.id } }),
      prisma.impactoCambio.findUniqueOrThrow({ where: { id: resImpAsignacion.body.id } }),
    ]);

    expect(conteoLbDespues).toBe(conteoLbAntes);
    expect(conteoMedDespues).toBe(conteoMedAntes);
    expect(conteoBitDespues).toBe(conteoBitAntes);
    expect(Number(proyDespues.presupuesto)).toBe(Number(proyAntes.presupuesto));
    expect(solDespues.estado).toBe(EstadoSolicitud.EN_EVALUACION);
    expect(impPresDb.aplicado).toBe(false);
    expect(impAsigDb.aplicado).toBe(false);

    await prisma.profesional.delete({ where: { id: profInactivo.id } });
  });

  it('simular no deja rastro: dos simulaciones consecutivas mantienen la BD sin cambios', async () => {
    const resSol = await request(app.getHttpServer())
      .post(`/proyectos/${proyectoId}/solicitudes-cambio`)
      .set('X-Rol', 'JP')
      .send({
        titulo: 'Solicitud para simular',
        descripcion: 'Verificar aislamiento de simulacion',
        justificacion: 'Comprobar rollback transaccional',
        solicitante: 'Carlos Morales',
        responsable: 'Carlos Morales',
        prioridad: 'BAJA',
        categoria: 'COSTO',
        probabilidadRiesgo: 1,
        impactoRiesgo: 1,
      });
    expect(resSol.status).toBe(201);
    const solicitudId = resSol.body.id as number;

    const resImpacto = await request(app.getHttpServer())
      .post(`/solicitudes-cambio/${solicitudId}/impactos`)
      .set('X-Rol', 'JP')
      .send({
        tipo: 'PRESUPUESTO',
        presupuesto: 45000000,
      });
    expect(resImpacto.status).toBe(201);

    const [lbAntes, medAntes, bitAntes, solAntes, impAntes, tareasAntes] = await Promise.all([
      prisma.lineaBase.findMany({ where: { proyectoId }, orderBy: { version: 'asc' } }),
      prisma.kpiMedicion.findMany({ where: { proyectoId }, orderBy: { id: 'asc' } }),
      prisma.bitacora.findMany({ where: { proyectoId }, orderBy: { id: 'asc' } }),
      prisma.solicitudCambio.findUnique({ where: { id: solicitudId } }),
      prisma.impactoCambio.findMany({ where: { solicitudId }, orderBy: { id: 'asc' } }),
      prisma.tarea.findMany({ where: { proyectoId }, orderBy: { id: 'asc' } }),
    ]);

    const resSim1 = await request(app.getHttpServer())
      .post(`/solicitudes-cambio/${solicitudId}/simular`)
      .set('X-Rol', 'JP');
    expect(resSim1.status).toBe(200);
    expect(resSim1.body.despues.presupuesto).toBe(45000000);

    const resSim2 = await request(app.getHttpServer())
      .post(`/solicitudes-cambio/${solicitudId}/simular`)
      .set('X-Rol', 'CC');
    expect(resSim2.status).toBe(200);
    expect(resSim2.body.despues.presupuesto).toBe(45000000);

    const [lbDespues, medDespues, bitDespues, solDespues, impDespues, tareasDespues] =
      await Promise.all([
        prisma.lineaBase.findMany({ where: { proyectoId }, orderBy: { version: 'asc' } }),
        prisma.kpiMedicion.findMany({ where: { proyectoId }, orderBy: { id: 'asc' } }),
        prisma.bitacora.findMany({ where: { proyectoId }, orderBy: { id: 'asc' } }),
        prisma.solicitudCambio.findUnique({ where: { id: solicitudId } }),
        prisma.impactoCambio.findMany({ where: { solicitudId }, orderBy: { id: 'asc' } }),
        prisma.tarea.findMany({ where: { proyectoId }, orderBy: { id: 'asc' } }),
      ]);

    expect(lbDespues).toEqual(lbAntes);
    expect(medDespues).toEqual(medAntes);
    expect(bitDespues).toEqual(bitAntes);
    expect(solDespues).toEqual(solAntes);
    expect(impDespues).toEqual(impAntes);
    expect(tareasDespues).toEqual(tareasAntes);
  });
});
