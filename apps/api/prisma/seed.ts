import {
  AmbitoKpi,
  CategoriaCambio,
  DireccionKpi,
  EstadoAccion,
  EstadoEtapa,
  EstadoProyecto,
  EstadoSolicitud,
  NivelTarea,
  Prioridad,
  Prisma,
  PrismaClient,
  Semaforo,
  TipoDependencia,
  UnidadKpi,
} from '@prisma/client';
import {
  aplicarAccionEtapa,
  CALENDARIO_POR_DEFECTO,
  calcularHorasPlan,
  claveNombre,
  crearCalendarioLaboral,
  dateAFechaIso,
  decidir,
  estaAtrasada,
  evaluarHito,
  fechaIsoADate,
  feriadosChileDesde,
  hoyEnZona,
  NOMBRES_ETAPAS,
  numerarArbol,
  planificarProyecto,
  sumarDiasCorridos,
  sumarDiasHabiles,
  TIPOS_RECURSO,
  type CalendarioLaboral,
  type DependenciaCronograma,
  type EstadoEtapa as EstadoEtapaCore,
  type EstadoSolicitud as EstadoSolicitudCore,
  type SolicitudParaAccion,
  type TareaPlanificacion,
} from '@autofix/core';
import { cargarCalendarioLaboral } from '../src/calendario/calendario-laboral';
import { PasoAlertas } from '../src/recalculo/paso-alertas';
import { PasoCostos } from '../src/recalculo/paso-costos';
import { PasoFechas } from '../src/recalculo/paso-fechas';
import { PasoHitos } from '../src/recalculo/paso-hitos';
import { PasoKpi } from '../src/recalculo/paso-kpi';
import { Reloj } from '../src/comun/reloj/reloj';
import type { ContextoRecalculo } from '../src/recalculo/recalculo.tipos';

const prisma = new PrismaClient();

const PROYECTOS_SEMILLA = [
  {
    nombre: 'AutoFix · Implementación',
    descripcion: 'Implementación del sistema de gestión de órdenes de trabajo del taller.',
    responsable: 'Jefe de Proyecto',
    presupuesto: 45000000,
    fechaInicio: new Date('2026-11-02T00:00:00.000Z'),
    fechaFin: new Date('2027-03-31T00:00:00.000Z'),
    estado: EstadoProyecto.EN_CURSO,
  },
  {
    nombre: 'Piloto de agenda · 2026',
    descripcion: 'Piloto inicial del módulo de agenda de mecánicos.',
    responsable: 'Jefe de Proyecto',
    presupuesto: 8000000,
    fechaInicio: new Date('2026-03-02T00:00:00.000Z'),
    fechaFin: new Date('2026-06-30T00:00:00.000Z'),
    estado: EstadoProyecto.CERRADO,
  },
  {
    nombre: 'AutoFix · Demostración Gantt',
    descripcion:
      'Demostración de rendimiento y visualización con 60 tareas y dependencias de los 4 tipos.',
    responsable: 'Jefe de Proyecto',
    presupuesto: 30000000,
    fechaInicio: fechaIsoADate(sumarDiasHabiles(hoyEnZona(), -20, CALENDARIO_POR_DEFECTO)),
    fechaFin: fechaIsoADate(sumarDiasHabiles(hoyEnZona(), 40, CALENDARIO_POR_DEFECTO)),
    estado: EstadoProyecto.EN_CURSO,
  },
];

async function sembrarTareas(proyectoId: number): Promise<void> {
  const conteo = await prisma.tarea.count({ where: { proyectoId } });
  if (conteo > 0) return;

  const etapa1 = await prisma.tarea.create({
    data: {
      proyectoId,
      padreId: null,
      nivel: NivelTarea.ETAPA,
      codigo: '~1',
      orden: 1,
      nombre: 'Levantamiento y diseño',
      responsable: 'Jefe de Proyecto',
      duracionDias: 1,
      porcentajeAvance: new Prisma.Decimal(0),
    },
  });

  const act11 = await prisma.tarea.create({
    data: {
      proyectoId,
      padreId: etapa1.id,
      nivel: NivelTarea.ACTIVIDAD,
      codigo: '~1.1',
      orden: 1,
      nombre: 'Levantamiento de procesos del taller',
      responsable: 'Jefe de Taller',
      duracionDias: 1,
      porcentajeAvance: new Prisma.Decimal(0),
    },
  });

  await prisma.tarea.create({
    data: {
      proyectoId,
      padreId: act11.id,
      nivel: NivelTarea.SUBACTIVIDAD,
      codigo: '~1.1.1',
      orden: 1,
      nombre: 'Entrevistas con el jefe de taller',
      responsable: 'Jefe de Taller',
      duracionDias: 3,
      inicioReal: fechaIsoADate('2026-11-02'),
      finReal: fechaIsoADate('2026-11-04'),
      porcentajeAvance: new Prisma.Decimal(100),
    },
  });

  await prisma.tarea.create({
    data: {
      proyectoId,
      padreId: act11.id,
      nivel: NivelTarea.SUBACTIVIDAD,
      codigo: '~1.1.2',
      orden: 2,
      nombre: 'Mapeo del flujo de órdenes de trabajo',
      responsable: 'Jefe de Taller',
      duracionDias: 4,
      inicioReal: fechaIsoADate('2026-11-05'),
      finReal: null,
      porcentajeAvance: new Prisma.Decimal(50),
    },
  });

  const act12 = await prisma.tarea.create({
    data: {
      proyectoId,
      padreId: etapa1.id,
      nivel: NivelTarea.ACTIVIDAD,
      codigo: '~1.2',
      orden: 2,
      nombre: 'Diseño de la solución',
      responsable: 'Jefe de Proyecto',
      duracionDias: 1,
      porcentajeAvance: new Prisma.Decimal(0),
    },
  });

  await prisma.tarea.create({
    data: {
      proyectoId,
      padreId: act12.id,
      nivel: NivelTarea.SUBACTIVIDAD,
      codigo: '~1.2.1',
      orden: 1,
      nombre: 'Modelo de datos de vehículos y órdenes',
      responsable: 'Desarrollador',
      duracionDias: 5,
      porcentajeAvance: new Prisma.Decimal(0),
    },
  });

  await prisma.tarea.create({
    data: {
      proyectoId,
      padreId: act12.id,
      nivel: NivelTarea.SUBACTIVIDAD,
      codigo: '~1.2.2',
      orden: 2,
      nombre: 'Prototipo de pantallas de recepción',
      responsable: 'Diseñador UI',
      duracionDias: 4,
      porcentajeAvance: new Prisma.Decimal(0),
    },
  });

  const etapa2 = await prisma.tarea.create({
    data: {
      proyectoId,
      padreId: null,
      nivel: NivelTarea.ETAPA,
      codigo: '~2',
      orden: 2,
      nombre: 'Construcción',
      responsable: 'Jefe de Proyecto',
      duracionDias: 1,
      porcentajeAvance: new Prisma.Decimal(0),
    },
  });

  const act21 = await prisma.tarea.create({
    data: {
      proyectoId,
      padreId: etapa2.id,
      nivel: NivelTarea.ACTIVIDAD,
      codigo: '~2.1',
      orden: 1,
      nombre: 'Módulo de órdenes de trabajo',
      responsable: 'Desarrollador Senior',
      duracionDias: 1,
      porcentajeAvance: new Prisma.Decimal(0),
    },
  });

  await prisma.tarea.create({
    data: {
      proyectoId,
      padreId: act21.id,
      nivel: NivelTarea.SUBACTIVIDAD,
      codigo: '~2.1.1',
      orden: 1,
      nombre: 'Registro de vehículos y clientes',
      responsable: 'Desarrollador',
      duracionDias: 6,
      porcentajeAvance: new Prisma.Decimal(0),
    },
  });

  await prisma.tarea.create({
    data: {
      proyectoId,
      padreId: act21.id,
      nivel: NivelTarea.SUBACTIVIDAD,
      codigo: '~2.1.2',
      orden: 2,
      nombre: 'Ingreso y seguimiento de órdenes',
      responsable: 'Desarrollador',
      duracionDias: 8,
      porcentajeAvance: new Prisma.Decimal(0),
    },
  });

  const act22 = await prisma.tarea.create({
    data: {
      proyectoId,
      padreId: etapa2.id,
      nivel: NivelTarea.ACTIVIDAD,
      codigo: '~2.2',
      orden: 2,
      nombre: 'Módulo de agenda de mecánicos',
      responsable: 'Desarrollador',
      duracionDias: 1,
      porcentajeAvance: new Prisma.Decimal(0),
    },
  });

  await prisma.tarea.create({
    data: {
      proyectoId,
      padreId: act22.id,
      nivel: NivelTarea.SUBACTIVIDAD,
      codigo: '~2.2.1',
      orden: 1,
      nombre: 'Calendario de turnos por mecánico',
      responsable: 'Desarrollador',
      duracionDias: 5,
      porcentajeAvance: new Prisma.Decimal(0),
    },
  });

  await prisma.tarea.create({
    data: {
      proyectoId,
      padreId: act22.id,
      nivel: NivelTarea.SUBACTIVIDAD,
      codigo: '~2.2.2',
      orden: 2,
      nombre: 'Configuración de impresoras de órdenes',
      responsable: 'Técnico de soporte',
      duracionDias: 2,
      fechaFija: fechaIsoADate('2026-11-23'),
      porcentajeAvance: new Prisma.Decimal(0),
    },
  });

  const todas = await prisma.tarea.findMany({ where: { proyectoId } });
  const numeracion = numerarArbol(todas);

  for (const t of todas) {
    const num = numeracion.get(t.id);
    if (!num) continue;
    await prisma.tarea.update({
      where: { id: t.id },
      data: {
        codigo: num.codigo,
        orden: num.orden,
      },
    });
  }
}

const DEPENDENCIAS_SEMILLA: {
  predecesora: string;
  sucesora: string;
  tipo: TipoDependencia;
  desfaseDias: number;
}[] = [
  { predecesora: '1.1.1', sucesora: '1.1.2', tipo: TipoDependencia.FS, desfaseDias: 0 },
  { predecesora: '1.1.2', sucesora: '1.2.1', tipo: TipoDependencia.SS, desfaseDias: 2 },
  { predecesora: '1.2.1', sucesora: '1.2.2', tipo: TipoDependencia.SS, desfaseDias: 3 },
  { predecesora: '1.1.2', sucesora: '1.2.2', tipo: TipoDependencia.FF, desfaseDias: 5 },
  { predecesora: '1.2.1', sucesora: '2.1.1', tipo: TipoDependencia.FS, desfaseDias: 0 },
  { predecesora: '2.1.1', sucesora: '2.1.2', tipo: TipoDependencia.FS, desfaseDias: 0 },
  { predecesora: '2.1.2', sucesora: '2.2.1', tipo: TipoDependencia.SS, desfaseDias: 7 },
  { predecesora: '1.2.1', sucesora: '2.2.2', tipo: TipoDependencia.SF, desfaseDias: 0 },
];

async function sembrarDependencias(proyectoId: number): Promise<void> {
  const conteo = await prisma.dependencia.count({ where: { proyectoId } });
  if (conteo > 0) return;

  const todas = await prisma.tarea.findMany({ where: { proyectoId } });
  const mapaPorCodigo = new Map(todas.map((t) => [t.codigo, t]));

  const datos = DEPENDENCIAS_SEMILLA.map((dep) => {
    const predecesora = mapaPorCodigo.get(dep.predecesora);
    const sucesora = mapaPorCodigo.get(dep.sucesora);
    if (!predecesora || !sucesora) {
      throw new Error(`Tarea no encontrada para dependencia ${dep.predecesora} -> ${dep.sucesora}`);
    }
    return {
      proyectoId,
      predecesoraId: predecesora.id,
      sucesoraId: sucesora.id,
      tipo: dep.tipo,
      desfaseDias: dep.desfaseDias,
    };
  });

  await prisma.dependencia.createMany({
    data: datos,
    skipDuplicates: true,
  });
}

async function cargarCalendarioSemilla(proyectoId: number): Promise<CalendarioLaboral> {
  const calFila = await prisma.calendario.findUnique({
    where: { proyectoId },
    include: { feriados: { select: { fecha: true } } },
  });
  return calFila
    ? crearCalendarioLaboral({
        diasLaborables: calFila.diasLaborables,
        feriados: calFila.feriados.map((f) => dateAFechaIso(f.fecha)),
      })
    : CALENDARIO_POR_DEFECTO;
}

async function planificarSemilla(proyectoId: number): Promise<void> {
  const calendario = await cargarCalendarioSemilla(proyectoId);

  const proyecto = await prisma.proyecto.findUniqueOrThrow({
    where: { id: proyectoId },
    select: { fechaInicio: true },
  });

  const todas = await prisma.tarea.findMany({ where: { proyectoId } });
  const deps = await prisma.dependencia.findMany({ where: { proyectoId } });

  const tareasPlan: TareaPlanificacion[] = todas.map((t) => ({
    id: t.id,
    codigo: t.codigo,
    padreId: t.padreId,
    duracionDias: t.duracionDias,
    fechaFija: t.fechaFija ? dateAFechaIso(t.fechaFija) : null,
    inicioReal: t.inicioReal ? dateAFechaIso(t.inicioReal) : null,
    finReal: t.finReal ? dateAFechaIso(t.finReal) : null,
    porcentajeAvance: Number(t.porcentajeAvance),
  }));

  const dependenciasPlan: DependenciaCronograma[] = deps.map((d) => ({
    predecesoraId: d.predecesoraId,
    sucesoraId: d.sucesoraId,
    tipo: d.tipo,
    desfaseDias: d.desfaseDias,
  }));

  const plan = planificarProyecto(
    tareasPlan,
    dependenciasPlan,
    calendario,
    dateAFechaIso(proyecto.fechaInicio),
  );

  for (const calc of plan.tareas) {
    await prisma.tarea.update({
      where: { id: calc.id },
      data: {
        duracionDias: calc.duracionDias,
        inicioPlan: fechaIsoADate(calc.inicioPlan),
        finPlan: fechaIsoADate(calc.finPlan),
        inicioTardio: fechaIsoADate(calc.inicioTardio),
        finTardio: fechaIsoADate(calc.finTardio),
        holguraDias: calc.holguraDias,
        esCritica: calc.esCritica,
        inicioReal: calc.inicioReal ? fechaIsoADate(calc.inicioReal) : null,
        finReal: calc.finReal ? fechaIsoADate(calc.finReal) : null,
        porcentajeAvance: new Prisma.Decimal(calc.porcentajeAvance),
      },
    });
  }

  if (plan.finProyecto !== '2026-12-10') {
    throw new Error(
      `Fin de proyecto inesperado en seed: ${plan.finProyecto} (esperado: 2026-12-10)`,
    );
  }

  const tarea122 = plan.tareas.find((t) => t.codigo === '1.2.2');
  if (!tarea122 || tarea122.holguraDias !== 16) {
    throw new Error(
      `Holgura inesperada para 1.2.2 en seed: ${tarea122?.holguraDias} (esperado: 16)`,
    );
  }

  const tarea222 = plan.tareas.find((t) => t.codigo === '2.2.2');
  if (
    !tarea222 ||
    tarea222.inicioPlan !== '2026-11-23' ||
    tarea222.finPlan !== '2026-11-24' ||
    tarea222.holguraDias !== 11
  ) {
    throw new Error(
      `Fechas u holgura inesperadas para 2.2.2 en seed: ${tarea222?.inicioPlan}..${tarea222?.finPlan}, holgura ${tarea222?.holguraDias} (esperado: 2026-11-23..2026-11-24, holgura 11)`,
    );
  }

  const padresConHijas = new Set(
    plan.tareas.map((t) => t.padreId).filter((id): id is number => id !== null),
  );
  const hojasCriticas = plan.tareas
    .filter((t) => t.esCritica && !padresConHijas.has(t.id))
    .map((t) => t.codigo)
    .sort();
  const hojasCriticasEsperadas = ['1.1.1', '1.1.2', '1.2.1', '2.1.1', '2.1.2', '2.2.1'].sort();

  if (JSON.stringify(hojasCriticas) !== JSON.stringify(hojasCriticasEsperadas)) {
    throw new Error(
      `Hojas críticas inesperadas en seed: ${hojasCriticas.join(', ')} (esperadas: ${hojasCriticasEsperadas.join(', ')})`,
    );
  }
}

async function sembrarHitos(proyectoId: number): Promise<void> {
  const conteo = await prisma.hito.count({ where: { proyectoId } });
  if (conteo > 0) return;

  const calendario = await cargarCalendarioSemilla(proyectoId);
  const tareas = await prisma.tarea.findMany({ where: { proyectoId } });
  const porCodigo = new Map(tareas.map((t) => [t.codigo, t]));

  const buscarTarea = (codigo: string) => {
    const t = porCodigo.get(codigo);
    if (!t) throw new Error(`Tarea ${codigo} no encontrada para hito en seed.`);
    return t;
  };

  const hoy = hoyEnZona();
  const fechaRevision = sumarDiasHabiles(hoy, 3, calendario);

  const definicionHitos = [
    {
      nombre: 'Acta de inicio aprobada',
      tareaId: null,
      fechaObjetivo: fechaIsoADate('2026-10-30'),
      fechaCumplimiento: fechaIsoADate('2026-10-29'),
      criterio: 'Acta firmada por el dueño del taller',
      responsable: 'Jefe de Proyecto',
      invariante: 'CUMPLIDO',
    },
    {
      nombre: 'Procesos del taller levantados',
      tareaId: buscarTarea('1.1').id,
      fechaObjetivo: fechaIsoADate('2026-11-06'),
      fechaCumplimiento: null,
      criterio: 'Informe de procesos validado por el jefe de taller',
      responsable: 'Jefe de Taller',
      invariante: 'ATRASADO',
    },
    {
      nombre: 'Diseño de la solución aprobado',
      tareaId: buscarTarea('1.2').id,
      fechaObjetivo: fechaIsoADate('2026-11-20'),
      fechaCumplimiento: null,
      criterio: 'Modelo de datos y prototipo aprobados',
      responsable: 'Jefe de Proyecto',
      invariante: null,
    },
    {
      nombre: 'Módulo de órdenes operativo',
      tareaId: buscarTarea('2.1').id,
      fechaObjetivo: fechaIsoADate('2026-12-04'),
      fechaCumplimiento: null,
      criterio: 'Registro y seguimiento de órdenes probado en el taller',
      responsable: 'Desarrollador Senior',
      invariante: null,
    },
    {
      nombre: 'Sistema en marcha blanca',
      tareaId: buscarTarea('2').id,
      fechaObjetivo: fechaIsoADate('2027-03-31'),
      fechaCumplimiento: null,
      criterio: 'Uso en paralelo durante dos semanas sin incidentes graves',
      responsable: 'Jefe de Proyecto',
      invariante: 'PENDIENTE',
    },
    {
      nombre: 'Revisión con el dueño del taller',
      tareaId: null,
      fechaObjetivo: fechaIsoADate(fechaRevision),
      fechaCumplimiento: null,
      criterio: 'Reunión de avance con acta',
      responsable: 'Jefe de Proyecto',
      invariante: 'EN_RIESGO',
    },
  ];

  const creados: Array<{ nombre: string; estado: string }> = [];

  for (const def of definicionHitos) {
    const hito = await prisma.hito.create({
      data: {
        proyectoId,
        nombre: def.nombre,
        tareaId: def.tareaId,
        fechaObjetivo: def.fechaObjetivo,
        fechaCumplimiento: def.fechaCumplimiento,
        criterio: def.criterio,
        responsable: def.responsable,
      },
    });

    const tarea = def.tareaId ? tareas.find((t) => t.id === def.tareaId) : null;
    const evaluacion = evaluarHito(
      {
        fechaObjetivo: dateAFechaIso(hito.fechaObjetivo),
        fechaCumplimiento: hito.fechaCumplimiento ? dateAFechaIso(hito.fechaCumplimiento) : null,
        tarea: tarea
          ? {
              finPlan: tarea.finPlan ? dateAFechaIso(tarea.finPlan) : null,
              porcentajeAvance: Number(tarea.porcentajeAvance),
            }
          : null,
      },
      calendario,
      hoy,
    );

    if (def.invariante && evaluacion.estado !== def.invariante) {
      throw new Error(
        `Estado inesperado para hito "${def.nombre}": ${evaluacion.estado} (esperado: ${def.invariante})`,
      );
    }

    creados.push({ nombre: def.nombre, estado: evaluacion.estado });
  }

  console.log('Hitos sembrados:');
  for (const c of creados) {
    console.log(`- ${c.nombre}: ${c.estado}`);
  }
}

async function sembrarLineaBase(proyectoId: number): Promise<void> {
  const lineasBaseExistentes = await prisma.lineaBase.findMany({ where: { proyectoId } });
  for (const lb of lineasBaseExistentes) {
    await prisma.lineaBaseTarea.deleteMany({ where: { lineaBaseId: lb.id } });
    await prisma.lineaBase.delete({ where: { id: lb.id } });
  }

  const tareas = await prisma.tarea.findMany({
    where: { proyectoId },
    orderBy: { codigo: 'asc' },
  });

  const padresIds = new Set(tareas.map((t) => t.padreId).filter((id): id is number => id !== null));
  const hojas = tareas.filter((t) => !padresIds.has(t.id));
  const costoPlanTotal = hojas.reduce((s, t) => s + Number(t.costoPlan), 0);

  const lb = await prisma.lineaBase.create({
    data: {
      proyectoId,
      version: 1,
      descripcion: 'Línea base inicial',
      fechaFinProyecto: fechaIsoADate('2026-12-10'),
      costoPlanTotal: new Prisma.Decimal(costoPlanTotal),
      tareas: {
        create: tareas.map((t) => ({
          tareaId: t.id,
          codigo: t.codigo,
          nombre: t.nombre,
          nivel: t.nivel,
          duracionDias: t.duracionDias,
          inicioPlan: t.inicioPlan,
          finPlan: t.finPlan,
          costoPlan: t.costoPlan,
        })),
      },
    },
    include: { tareas: true },
  });

  if (lb.tareas.length !== 14) {
    throw new Error(
      `Conteo inesperado de tareas en línea base: ${lb.tareas.length} (esperado: 14)`,
    );
  }
}

async function sembrarSolicitudesCambio(proyectoId: number): Promise<void> {
  const conteo = await prisma.solicitudCambio.count({ where: { proyectoId } });
  if (conteo > 0) return;

  const definiciones: {
    codigo: string;
    titulo: string;
    descripcion: string;
    justificacion: string;
    solicitante: string;
    responsable: string;
    prioridad: Prioridad;
    categoria: CategoriaCambio;
    probabilidadRiesgo: number;
    impactoRiesgo: number;
    fechaRegistro: Date;
    fechaDecision?: Date;
    fechaCierre?: Date;
    motivoRechazo?: string;
    pasos: [number | 'decidir', string, Record<string, unknown>?][];
    adopcion?: number;
    accionesCorrectivas?: {
      descripcion: string;
      responsable: string;
      fechaCompromiso: string;
      fechaCierre?: string;
      estado: EstadoAccion;
    }[];
  }[] = [
    {
      codigo: 'SC-001',
      titulo: 'Ampliación de memoria en servidores de taller',
      descripcion: 'Se requiere ampliar la memoria RAM para soportar mayor concurrencia.',
      justificacion: 'Evitar degradación en horas punta de recepción.',
      solicitante: 'Jefe de Taller',
      responsable: 'Carlos Morales',
      prioridad: Prioridad.MEDIA,
      categoria: CategoriaCambio.RECURSO,
      probabilidadRiesgo: 2,
      impactoRiesgo: 3,
      fechaRegistro: new Date('2026-10-25T09:00:00.000Z'),
      pasos: [[1, 'iniciar']],
    },
    {
      codigo: 'SC-002',
      titulo: 'Integración de pasarela de pago web',
      descripcion: 'Permitir el pago de presupuestos directamente desde la aplicación.',
      justificacion: 'Reducir filas en caja y mejorar el flujo de caja.',
      solicitante: 'Gerente Comercial',
      responsable: 'Valeria Guardia',
      prioridad: Prioridad.ALTA,
      categoria: CategoriaCambio.ALCANCE,
      probabilidadRiesgo: 3,
      impactoRiesgo: 4,
      fechaRegistro: new Date('2026-10-20T10:00:00.000Z'),
      pasos: [
        [1, 'iniciar'],
        [1, 'completar'],
        [2, 'iniciar'],
      ],
    },
    {
      codigo: 'SC-003',
      titulo: 'Incorporación de escáneres OBD-II Bluetooth',
      descripcion: 'Adquisición y sincronización de nuevos lectores inalámbricos.',
      justificacion: 'Diagnóstico directo en bahía sin mover vehículos.',
      solicitante: 'Jefe de Diagnóstico',
      responsable: 'Carlos Morales',
      prioridad: Prioridad.ALTA,
      categoria: CategoriaCambio.COSTO,
      probabilidadRiesgo: 2,
      impactoRiesgo: 4,
      fechaRegistro: new Date('2026-10-15T11:00:00.000Z'),
      fechaDecision: new Date('2026-10-28T14:00:00.000Z'),
      pasos: [
        [1, 'iniciar'],
        [1, 'completar'],
        [2, 'iniciar'],
        [2, 'completar'],
        [3, 'iniciar'],
        [3, 'completar'],
        ['decidir', 'aprobar'],
        [4, 'iniciar'],
      ],
    },
    {
      codigo: 'SC-004',
      titulo: 'Reemplazo total de tabletas de mecánicos',
      descripcion: 'Sustitución de tabletas por modelos de gama alta.',
      justificacion: 'Preferencia de marca.',
      solicitante: 'Mecánico Senior',
      responsable: 'Valeria Guardia',
      prioridad: Prioridad.BAJA,
      categoria: CategoriaCambio.COSTO,
      probabilidadRiesgo: 4,
      impactoRiesgo: 4,
      fechaRegistro: new Date('2026-10-18T16:00:00.000Z'),
      fechaDecision: new Date('2026-10-29T17:00:00.000Z'),
      motivoRechazo: 'Costo excesivo no justificado por necesidades técnicas.',
      pasos: [
        [1, 'iniciar'],
        [1, 'completar'],
        [2, 'iniciar'],
        [2, 'completar'],
        [3, 'iniciar'],
        [3, 'completar'],
        ['decidir', 'rechazar'],
      ],
    },
    {
      codigo: 'SC-005',
      titulo: 'Protocolo de sanitización y entrega limpia de vehículos',
      descripcion: 'Procedimiento de limpieza antes de entregar el automóvil al cliente.',
      justificacion: 'Mejorar satisfacción del cliente y evaluación del taller.',
      solicitante: 'Atención al Cliente',
      responsable: 'Valeria Guardia',
      prioridad: Prioridad.MEDIA,
      categoria: CategoriaCambio.CALIDAD,
      probabilidadRiesgo: 1,
      impactoRiesgo: 2,
      fechaRegistro: new Date('2026-10-01T08:30:00.000Z'),
      fechaDecision: new Date('2026-10-10T11:00:00.000Z'),
      fechaCierre: new Date('2026-10-30T18:00:00.000Z'),
      adopcion: 85,
      accionesCorrectivas: [
        {
          descripcion: 'Ajuste en disponibilidad de insumos de aspirado',
          responsable: 'Jefe de Taller',
          fechaCompromiso: '2026-10-20',
          fechaCierre: '2026-10-22',
          estado: EstadoAccion.CERRADA,
        },
      ],
      pasos: [
        [1, 'iniciar'],
        [1, 'completar'],
        [2, 'iniciar'],
        [2, 'completar'],
        [3, 'iniciar'],
        [3, 'completar'],
        ['decidir', 'aprobar'],
        [4, 'omitir', { comentario: 'Procedimiento operativo estándar previamente validado' }],
        [5, 'iniciar'],
        [5, 'completar'],
        [6, 'iniciar'],
        [6, 'completar'],
        [7, 'iniciar'],
        [7, 'completar'],
        [8, 'omitir', { comentario: 'Se consolidaron los resultados en el informe mensual' }],
        [9, 'iniciar'],
        [9, 'completar'],
        [10, 'iniciar'],
        [10, 'completar'],
      ],
    },
  ];

  for (const def of definiciones) {
    let estadoModelo: SolicitudParaAccion = {
      estado: 'REGISTRADA' as EstadoSolicitudCore,
      etapaActual: 1,
      etapas: Array.from({ length: 10 }, (_, i) => ({
        numero: i + 1,
        estado: 'PENDIENTE' as EstadoEtapaCore,
      })),
    };

    if (def.codigo === 'SC-005') {
      const etapa10 = estadoModelo.etapas.find((e) => e.numero === 10);
      if (etapa10) etapa10.porcentajeAdopcion = def.adopcion;
    }

    let cursorFecha = dateAFechaIso(def.fechaRegistro);
    let fechaDecisionCalculada: Date | null = def.fechaDecision ?? null;
    let fechaCierreCalculada: Date | null = def.fechaCierre ?? null;

    for (const [paso, accion, datosExtra] of def.pasos) {
      if (paso === 'decidir') {
        cursorFecha = sumarDiasCorridos(cursorFecha, 1);
        estadoModelo = decidir(estadoModelo, accion as 'aprobar' | 'rechazar');
        fechaDecisionCalculada = fechaIsoADate(cursorFecha);
      } else {
        const incrementoDias = accion === 'completar' ? 2 : 1;
        cursorFecha = sumarDiasCorridos(cursorFecha, incrementoDias);
        estadoModelo = aplicarAccionEtapa(
          estadoModelo,
          paso,
          accion as 'iniciar' | 'completar' | 'omitir',
          { hoy: cursorFecha, ...datosExtra },
        );
        if (paso === 10 && accion === 'completar') {
          fechaCierreCalculada = fechaIsoADate(cursorFecha);
        }
      }
    }

    const solicitud = await prisma.solicitudCambio.create({
      data: {
        proyectoId,
        codigo: def.codigo,
        titulo: def.titulo,
        descripcion: def.descripcion,
        justificacion: def.justificacion,
        solicitante: def.solicitante,
        responsable: def.responsable,
        prioridad: def.prioridad,
        categoria: def.categoria,
        probabilidadRiesgo: def.probabilidadRiesgo,
        impactoRiesgo: def.impactoRiesgo,
        estado: estadoModelo.estado as EstadoSolicitud,
        etapaActual: estadoModelo.etapaActual,
        fechaRegistro: def.fechaRegistro,
        fechaDecision: fechaDecisionCalculada,
        fechaCierre: fechaCierreCalculada,
        motivoRechazo: def.motivoRechazo,
      },
    });

    for (const etapaMod of estadoModelo.etapas) {
      const creadaEtapa = await prisma.etapaCambio.create({
        data: {
          solicitudId: solicitud.id,
          numero: etapaMod.numero,
          nombre: NOMBRES_ETAPAS[etapaMod.numero] ?? `Etapa ${etapaMod.numero}`,
          estado: etapaMod.estado as EstadoEtapa,
          fechaIniciada: etapaMod.fechaIniciada
            ? fechaIsoADate(String(etapaMod.fechaIniciada).slice(0, 10))
            : null,
          fechaCompletada: etapaMod.fechaCompletada
            ? fechaIsoADate(String(etapaMod.fechaCompletada).slice(0, 10))
            : null,
          comentario: etapaMod.comentario ?? null,
          porcentajeAdopcion:
            def.codigo === 'SC-005' && etapaMod.numero === 10 && def.adopcion
              ? new Prisma.Decimal(def.adopcion)
              : null,
        },
      });

      if (def.accionesCorrectivas && etapaMod.numero === 9) {
        for (const ac of def.accionesCorrectivas) {
          await prisma.accionCorrectiva.create({
            data: {
              etapaId: creadaEtapa.id,
              descripcion: ac.descripcion,
              responsable: ac.responsable,
              fechaCompromiso: fechaIsoADate(ac.fechaCompromiso),
              fechaCierre: ac.fechaCierre ? fechaIsoADate(ac.fechaCierre) : null,
              estado: ac.estado,
            },
          });
        }
      }
    }
  }
}

async function sembrarDemostracionGantt(proyectoId: number, fechaInicioIso: string): Promise<void> {
  const conteo = await prisma.tarea.count({ where: { proyectoId } });
  if (conteo > 0) return;

  const subactividadesCreadas: Array<{ id: number; codigo: string }> = [];
  let ordenSubactividad = 0;

  for (let e = 1; e <= 4; e += 1) {
    const etapa = await prisma.tarea.create({
      data: {
        proyectoId,
        padreId: null,
        nivel: NivelTarea.ETAPA,
        codigo: `~${e}`,
        orden: e,
        nombre: `Etapa ${e}`,
        responsable: 'Jefe de Proyecto',
        duracionDias: 1,
        porcentajeAvance: new Prisma.Decimal(0),
      },
    });

    for (let a = 1; a <= 2; a += 1) {
      const act = await prisma.tarea.create({
        data: {
          proyectoId,
          padreId: etapa.id,
          nivel: NivelTarea.ACTIVIDAD,
          codigo: `~${e}.${a}`,
          orden: a,
          nombre: `Actividad ${e}.${a}`,
          responsable: 'Jefe de Taller',
          duracionDias: 1,
          porcentajeAvance: new Prisma.Decimal(0),
        },
      });

      for (let s = 1; s <= 6; s += 1) {
        ordenSubactividad += 1;
        const duracion = 2 + ((e + a + s) % 5);
        let avance = 0;
        if (ordenSubactividad <= 6) {
          avance = 100;
        } else if (ordenSubactividad <= 10) {
          avance = 50;
        }

        const sub = await prisma.tarea.create({
          data: {
            proyectoId,
            padreId: act.id,
            nivel: NivelTarea.SUBACTIVIDAD,
            codigo: `~${e}.${a}.${s}`,
            orden: s,
            nombre: `Subactividad ${e}.${a}.${s}`,
            responsable: 'Desarrollador',
            duracionDias: duracion,
            porcentajeAvance: new Prisma.Decimal(avance),
          },
        });
        subactividadesCreadas.push({ id: sub.id, codigo: `${e}.${a}.${s}` });
      }
    }
  }

  const todas = await prisma.tarea.findMany({ where: { proyectoId } });
  const numeracion = numerarArbol(todas);
  for (const t of todas) {
    const num = numeracion.get(t.id);
    if (!num) continue;
    await prisma.tarea.update({
      where: { id: t.id },
      data: { codigo: num.codigo, orden: num.orden },
    });
  }

  const tipos = [TipoDependencia.FS, TipoDependencia.SS, TipoDependencia.FF, TipoDependencia.SF];

  const datosDeps: Array<{
    proyectoId: number;
    predecesoraId: number;
    sucesoraId: number;
    tipo: TipoDependencia;
    desfaseDias: number;
  }> = [];

  for (let i = 1; i < subactividadesCreadas.length; i += 1) {
    const tipo = tipos[i % 4]!;
    const desfaseDias = tipo === TipoDependencia.SF ? 3 : 1;
    datosDeps.push({
      proyectoId,
      predecesoraId: subactividadesCreadas[i - 1]!.id,
      sucesoraId: subactividadesCreadas[i]!.id,
      tipo,
      desfaseDias,
    });
  }

  await prisma.dependencia.createMany({
    data: datosDeps,
    skipDuplicates: true,
  });

  const calendario = await cargarCalendarioSemilla(proyectoId);
  const tareasActualizadas = await prisma.tarea.findMany({ where: { proyectoId } });
  const deps = await prisma.dependencia.findMany({ where: { proyectoId } });

  const tareasPlan: TareaPlanificacion[] = tareasActualizadas.map((t) => ({
    id: t.id,
    codigo: t.codigo,
    padreId: t.padreId,
    duracionDias: t.duracionDias,
    fechaFija: t.fechaFija ? dateAFechaIso(t.fechaFija) : null,
    inicioReal: t.inicioReal ? dateAFechaIso(t.inicioReal) : null,
    finReal: t.finReal ? dateAFechaIso(t.finReal) : null,
    porcentajeAvance: Number(t.porcentajeAvance),
  }));

  const dependenciasPlan: DependenciaCronograma[] = deps.map((d) => ({
    predecesoraId: d.predecesoraId,
    sucesoraId: d.sucesoraId,
    tipo: d.tipo,
    desfaseDias: d.desfaseDias,
  }));

  const plan = planificarProyecto(tareasPlan, dependenciasPlan, calendario, fechaInicioIso);

  for (const calc of plan.tareas) {
    await prisma.tarea.update({
      where: { id: calc.id },
      data: {
        duracionDias: calc.duracionDias,
        inicioPlan: fechaIsoADate(calc.inicioPlan),
        finPlan: fechaIsoADate(calc.finPlan),
        inicioTardio: fechaIsoADate(calc.inicioTardio),
        finTardio: fechaIsoADate(calc.finTardio),
        holguraDias: calc.holguraDias,
        esCritica: calc.esCritica,
        inicioReal: calc.inicioReal ? fechaIsoADate(calc.inicioReal) : null,
        finReal: calc.finReal ? fechaIsoADate(calc.finReal) : null,
        porcentajeAvance: new Prisma.Decimal(calc.porcentajeAvance),
      },
    });
  }

  if (plan.tareas.length !== 60) {
    throw new Error(
      `Se esperaban 60 tareas en el proyecto de demostración, se obtuvieron ${plan.tareas.length}`,
    );
  }

  const tiposPresentes = new Set(deps.map((d) => d.tipo));
  if (tiposPresentes.size !== 4) {
    throw new Error(
      `Se esperaban los 4 tipos de dependencia, se encontraron ${tiposPresentes.size}`,
    );
  }

  const hoy = hoyEnZona();
  const atrasadas = plan.tareas.filter((t) => estaAtrasada(t, hoy));
  if (atrasadas.length === 0) {
    throw new Error('Se esperaba al menos una tarea atrasada en el proyecto de demostración.');
  }

  if (plan.finProyecto) {
    await prisma.proyecto.update({
      where: { id: proyectoId },
      data: { fechaFin: fechaIsoADate(plan.finProyecto) },
    });
  }
}

async function sembrarCatalogos(): Promise<void> {
  for (const tipo of TIPOS_RECURSO) {
    await prisma.tipoRecurso.upsert({
      where: { nombre: tipo.nombre },
      create: { nombre: tipo.nombre, descripcion: tipo.descripcion },
      update: { descripcion: tipo.descripcion },
    });
  }

  const PROFESIONALES_SEMILLA = [
    {
      nombre: 'Rodrigo Fuentes',
      cargo: 'Jefe de taller',
      tarifaHora: 12000,
      horasDiarias: 8,
    },
    {
      nombre: 'Camila Rojas',
      cargo: 'Mecánica senior',
      tarifaHora: 9500,
      horasDiarias: 8,
    },
    {
      nombre: 'Matías Soto',
      cargo: 'Mecánico',
      tarifaHora: 7500,
      horasDiarias: 8,
    },
    {
      nombre: 'Valentina Muñoz',
      cargo: 'Desarrolladora de software',
      tarifaHora: 11000,
      horasDiarias: 7.5,
    },
    {
      nombre: 'Diego Pizarro',
      cargo: 'Técnico de soporte',
      tarifaHora: 8000,
      horasDiarias: 6,
    },
  ];

  for (const p of PROFESIONALES_SEMILLA) {
    await prisma.profesional.upsert({
      where: { nombre: p.nombre },
      create: {
        nombre: p.nombre,
        claveNombre: claveNombre(p.nombre),
        cargo: p.cargo,
        tarifaHora: p.tarifaHora,
        horasDiarias: p.horasDiarias,
        activo: true,
      },
      update: {},
    });
  }

  const tipos = await prisma.tipoRecurso.findMany();
  const mapaTipos = new Map(tipos.map((t) => [t.nombre, t.id]));

  const RECURSOS_SEMILLA = [
    {
      nombre: 'Mecánico subcontratado',
      tipo: 'Humano',
      unidad: 'hora',
      costoUnitario: 9000,
    },
    {
      nombre: 'Elevador hidráulico de dos columnas',
      tipo: 'Equipamiento',
      unidad: 'día',
      costoUnitario: 25000,
    },
    {
      nombre: 'Escáner de diagnóstico OBD-II',
      tipo: 'Equipamiento',
      unidad: 'hora',
      costoUnitario: 3500,
    },
    {
      nombre: 'Aceite de motor 5W-30',
      tipo: 'Material',
      unidad: 'litro',
      costoUnitario: 7990,
    },
    {
      nombre: 'Filtro de aceite',
      tipo: 'Material',
      unidad: 'unidad',
      costoUnitario: 6500,
    },
    {
      nombre: 'Licencia de software de gestión del taller',
      tipo: 'Servicio',
      unidad: 'mes',
      costoUnitario: 45000,
    },
    {
      nombre: 'Alineación y balanceo externo',
      tipo: 'Servicio',
      unidad: 'servicio',
      costoUnitario: 25000,
    },
  ];

  for (const r of RECURSOS_SEMILLA) {
    const tipoRecursoId = mapaTipos.get(r.tipo);
    if (!tipoRecursoId) continue;
    await prisma.recurso.upsert({
      where: { nombre: r.nombre },
      create: {
        nombre: r.nombre,
        claveNombre: claveNombre(r.nombre),
        tipoRecursoId,
        unidad: r.unidad,
        costoUnitario: r.costoUnitario,
        activo: true,
      },
      update: {},
    });
  }
}

async function sembrarAsignaciones(proyectoId: number): Promise<void> {
  const valentina = await prisma.profesional.findFirstOrThrow({
    where: { nombre: 'Valentina Muñoz' },
  });
  const rodrigo = await prisma.profesional.findFirstOrThrow({
    where: { nombre: 'Rodrigo Fuentes' },
  });
  const camila = await prisma.profesional.findFirstOrThrow({
    where: { nombre: 'Camila Rojas' },
  });
  const recursoEscaner = await prisma.recurso.findFirstOrThrow({
    where: { nombre: 'Escáner de diagnóstico OBD-II' },
  });

  const tareas = await prisma.tarea.findMany({ where: { proyectoId } });
  const t111 = tareas.find((t) => t.codigo === '1.1.1');
  const t112 = tareas.find((t) => t.codigo === '1.1.2');
  const t121 = tareas.find((t) => t.codigo === '1.2.1');
  const t122 = tareas.find((t) => t.codigo === '1.2.2');
  if (!t111 || !t112 || !t121 || !t122) return;

  const horasPlan111 = calcularHorasPlan(t111.duracionDias, Number(rodrigo.horasDiarias), 50);
  await prisma.asignacion.upsert({
    where: {
      tareaId_profesionalId: {
        tareaId: t111.id,
        profesionalId: rodrigo.id,
      },
    },
    create: {
      tareaId: t111.id,
      profesionalId: rodrigo.id,
      dedicacion: new Prisma.Decimal(50),
      horasPlan: new Prisma.Decimal(horasPlan111),
      horasReales: new Prisma.Decimal(horasPlan111),
      tarifaAplicada: rodrigo.tarifaHora,
    },
    update: {
      dedicacion: new Prisma.Decimal(50),
      horasPlan: new Prisma.Decimal(horasPlan111),
      horasReales: new Prisma.Decimal(horasPlan111),
      tarifaAplicada: rodrigo.tarifaHora,
    },
  });

  const horasPlan112 = calcularHorasPlan(t112.duracionDias, Number(camila.horasDiarias), 50);
  await prisma.asignacion.upsert({
    where: {
      tareaId_profesionalId: {
        tareaId: t112.id,
        profesionalId: camila.id,
      },
    },
    create: {
      tareaId: t112.id,
      profesionalId: camila.id,
      dedicacion: new Prisma.Decimal(50),
      horasPlan: new Prisma.Decimal(horasPlan112),
      horasReales: new Prisma.Decimal(horasPlan112 / 2),
      tarifaAplicada: camila.tarifaHora,
    },
    update: {
      dedicacion: new Prisma.Decimal(50),
      horasPlan: new Prisma.Decimal(horasPlan112),
      horasReales: new Prisma.Decimal(horasPlan112 / 2),
      tarifaAplicada: camila.tarifaHora,
    },
  });

  const horasPlan121 = calcularHorasPlan(t121.duracionDias, Number(valentina.horasDiarias), 60);
  await prisma.asignacion.upsert({
    where: {
      tareaId_profesionalId: {
        tareaId: t121.id,
        profesionalId: valentina.id,
      },
    },
    create: {
      tareaId: t121.id,
      profesionalId: valentina.id,
      dedicacion: new Prisma.Decimal(60),
      horasPlan: new Prisma.Decimal(horasPlan121),
      horasReales: new Prisma.Decimal(5),
      tarifaAplicada: valentina.tarifaHora,
    },
    update: {
      dedicacion: new Prisma.Decimal(60),
      horasPlan: new Prisma.Decimal(horasPlan121),
      horasReales: new Prisma.Decimal(5),
      tarifaAplicada: valentina.tarifaHora,
    },
  });

  const horasPlan122 = calcularHorasPlan(t122.duracionDias, Number(valentina.horasDiarias), 60);
  await prisma.asignacion.upsert({
    where: {
      tareaId_profesionalId: {
        tareaId: t122.id,
        profesionalId: valentina.id,
      },
    },
    create: {
      tareaId: t122.id,
      profesionalId: valentina.id,
      dedicacion: new Prisma.Decimal(60),
      horasPlan: new Prisma.Decimal(horasPlan122),
      tarifaAplicada: valentina.tarifaHora,
    },
    update: {
      dedicacion: new Prisma.Decimal(60),
      horasPlan: new Prisma.Decimal(horasPlan122),
      tarifaAplicada: valentina.tarifaHora,
    },
  });

  await prisma.asignacion.upsert({
    where: {
      tareaId_recursoId: {
        tareaId: t121.id,
        recursoId: recursoEscaner.id,
      },
    },
    create: {
      tareaId: t121.id,
      recursoId: recursoEscaner.id,
      cantidadPlan: new Prisma.Decimal(10),
      costoUnitarioAplicado: recursoEscaner.costoUnitario,
    },
    update: {
      cantidadPlan: new Prisma.Decimal(10),
      costoUnitarioAplicado: recursoEscaner.costoUnitario,
    },
  });
}

async function sembrarKpis(): Promise<void> {
  const KPIS_SEMILLA = [
    {
      codigo: 'SPI',
      nombre: 'Índice de desempeño del cronograma',
      descripcion: 'Razón entre el valor ganado y el valor planificado (EV / PV).',
      ambito: AmbitoKpi.PROYECTO,
      formula: 'EV / PV',
      unidad: UnidadKpi.INDICE,
      meta: 1,
      direccion: DireccionKpi.MAYOR_MEJOR,
      umbrales: [
        { semaforo: Semaforo.VERDE, valorDesde: 0.95 },
        { semaforo: Semaforo.AMARILLO, valorDesde: 0.85 },
      ],
    },
    {
      codigo: 'CPI',
      nombre: 'Índice de desempeño del costo',
      descripcion: 'Razón entre el valor ganado y el costo real (EV / AC).',
      ambito: AmbitoKpi.PROYECTO,
      formula: 'EV / AC',
      unidad: UnidadKpi.INDICE,
      meta: 1,
      direccion: DireccionKpi.MAYOR_MEJOR,
      umbrales: [
        { semaforo: Semaforo.VERDE, valorDesde: 0.95 },
        { semaforo: Semaforo.AMARILLO, valorDesde: 0.85 },
      ],
    },
    {
      codigo: 'AVANCE_REAL_PCT',
      nombre: 'Porcentaje de avance real',
      descripcion: 'Porcentaje de avance ponderado consolidado del proyecto.',
      ambito: AmbitoKpi.PROYECTO,
      formula: 'AVANCE_REAL',
      unidad: UnidadKpi.PORCENTAJE,
      meta: 100,
      direccion: DireccionKpi.MAYOR_MEJOR,
      umbrales: [],
    },
    {
      codigo: 'CV_PCT',
      nombre: 'Variación de costo porcentual',
      descripcion: 'Diferencia porcentual entre el valor ganado y el costo real.',
      ambito: AmbitoKpi.PROYECTO,
      formula: '(EV - AC) / EV * 100',
      unidad: UnidadKpi.PORCENTAJE,
      meta: 0,
      direccion: DireccionKpi.MAYOR_MEJOR,
      umbrales: [
        { semaforo: Semaforo.VERDE, valorDesde: 0 },
        { semaforo: Semaforo.AMARILLO, valorDesde: -10 },
      ],
    },
    {
      codigo: 'HITOS_A_TIEMPO_PCT',
      nombre: 'Porcentaje de hitos a tiempo',
      descripcion: 'Porcentaje de hitos cumplidos a tiempo respecto a los hitos cumplidos.',
      ambito: AmbitoKpi.PROYECTO,
      formula: 'HITOS_A_TIEMPO / HITOS_CUMPLIDOS * 100',
      unidad: UnidadKpi.PORCENTAJE,
      meta: 100,
      direccion: DireccionKpi.MAYOR_MEJOR,
      umbrales: [
        { semaforo: Semaforo.VERDE, valorDesde: 90 },
        { semaforo: Semaforo.AMARILLO, valorDesde: 70 },
      ],
    },
    {
      codigo: 'TAREAS_ATRASADAS_PCT',
      nombre: 'Porcentaje de tareas atrasadas',
      descripcion: 'Porcentaje de tareas hoja atrasadas respecto al total de tareas hoja.',
      ambito: AmbitoKpi.PROYECTO,
      formula: 'TAREAS_ATRASADAS / TAREAS_TOTAL * 100',
      unidad: UnidadKpi.PORCENTAJE,
      meta: 0,
      direccion: DireccionKpi.MENOR_MEJOR,
      umbrales: [
        { semaforo: Semaforo.VERDE, valorDesde: 5 },
        { semaforo: Semaforo.AMARILLO, valorDesde: 15 },
      ],
    },
    {
      codigo: 'DESV_DURACION_PCT',
      nombre: 'Desviación de duración',
      descripcion: 'Variación porcentual entre la duración actual y la planificada en la base.',
      ambito: AmbitoKpi.PROYECTO,
      formula: '(DUR_ACTUAL - DUR_PLAN_BASE) / DUR_PLAN_BASE * 100',
      unidad: UnidadKpi.PORCENTAJE,
      meta: 0,
      direccion: DireccionKpi.MENOR_MEJOR,
      umbrales: [
        { semaforo: Semaforo.VERDE, valorDesde: 5 },
        { semaforo: Semaforo.AMARILLO, valorDesde: 15 },
      ],
    },
    {
      codigo: 'HORAS_SOBREASIGNADAS_PCT',
      nombre: 'Porcentaje de horas sobreasignadas',
      descripcion: 'Porcentaje de horas sobreasignadas respecto al total de horas asignadas.',
      ambito: AmbitoKpi.PROYECTO,
      formula: 'HORAS_SOBREASIGNADAS / HORAS_ASIGNADAS * 100',
      unidad: UnidadKpi.PORCENTAJE,
      meta: 0,
      direccion: DireccionKpi.MENOR_MEJOR,
      umbrales: [
        { semaforo: Semaforo.VERDE, valorDesde: 0 },
        { semaforo: Semaforo.AMARILLO, valorDesde: 10 },
      ],
    },
  ];

  for (const def of KPIS_SEMILLA) {
    const kpi = await prisma.kpiDefinicion.upsert({
      where: { codigo: def.codigo },
      create: {
        codigo: def.codigo,
        nombre: def.nombre,
        descripcion: def.descripcion,
        ambito: def.ambito,
        formula: def.formula,
        unidad: def.unidad,
        meta: new Prisma.Decimal(def.meta),
        direccion: def.direccion,
        esAdicional: false,
        activo: true,
      },
      update: {
        nombre: def.nombre,
        descripcion: def.descripcion,
        ambito: def.ambito,
        formula: def.formula,
        unidad: def.unidad,
        meta: new Prisma.Decimal(def.meta),
        direccion: def.direccion,
      },
    });

    await prisma.kpiUmbral.deleteMany({ where: { kpiId: kpi.id } });
    if (def.umbrales.length > 0) {
      await prisma.kpiUmbral.createMany({
        data: def.umbrales.map((u) => ({
          kpiId: kpi.id,
          semaforo: u.semaforo,
          valorDesde: new Prisma.Decimal(u.valorDesde),
        })),
      });
    }
  }
}

async function recalcularCostosSemilla(proyectoId: number): Promise<void> {
  const proyecto = await prisma.proyecto.findUniqueOrThrow({ where: { id: proyectoId } });
  const tareas = await prisma.tarea.findMany({ where: { proyectoId } });
  const deps = await prisma.dependencia.findMany({ where: { proyectoId } });
  const calendario = await cargarCalendarioLaboral(prisma, proyectoId);
  const contexto: ContextoRecalculo = {
    tx: prisma,
    proyecto,
    calendario,
    tareas,
    dependencias: deps.map((d) => ({
      predecesoraId: d.predecesoraId,
      sucesoraId: d.sucesoraId,
      tipo: d.tipo,
      desfaseDias: d.desfaseDias,
    })),
    tareasAfectadas: [],
    hitos: null,
    costos: null,
    detalle: {},
    huboCambios: false,
  };
  const pasoCostos = new PasoCostos();
  await pasoCostos.ejecutar(contexto);
}

async function recalcularProyectoSemilla(proyectoId: number): Promise<void> {
  const proyecto = await prisma.proyecto.findUniqueOrThrow({ where: { id: proyectoId } });
  const tareas = await prisma.tarea.findMany({ where: { proyectoId } });
  const deps = await prisma.dependencia.findMany({ where: { proyectoId } });
  const calendario = await cargarCalendarioLaboral(prisma, proyectoId);
  const contexto: ContextoRecalculo = {
    tx: prisma,
    proyecto,
    calendario,
    tareas,
    dependencias: deps.map((d) => ({
      predecesoraId: d.predecesoraId,
      sucesoraId: d.sucesoraId,
      tipo: d.tipo,
      desfaseDias: d.desfaseDias,
    })),
    tareasAfectadas: [],
    hitos: null,
    costos: null,
    detalle: {},
    huboCambios: false,
  };

  const reloj = new Reloj();
  const pasos = [
    new PasoFechas(),
    new PasoCostos(),
    new PasoAlertas(),
    new PasoHitos(reloj),
    new PasoKpi(reloj),
  ];
  for (const paso of pasos) {
    await paso.ejecutar(contexto);
  }
}

async function sembrar(): Promise<void> {
  let proyectoPrincipalId: number | null = null;
  let proyectoDemoId: number | null = null;

  for (const datos of PROYECTOS_SEMILLA) {
    const existente = await prisma.proyecto.findFirst({
      where: { nombre: datos.nombre },
      include: { calendario: true },
    });

    let calendarioId: number;

    if (!existente) {
      const creado = await prisma.proyecto.create({
        data: {
          ...datos,
          calendario: { create: {} },
        },
        include: { calendario: true },
      });
      calendarioId = creado.calendario!.id;
      if (creado.nombre === 'AutoFix · Implementación') {
        proyectoPrincipalId = creado.id;
      }
      if (creado.nombre === 'AutoFix · Demostración Gantt') {
        proyectoDemoId = creado.id;
      }
    } else {
      if (!existente.calendario) {
        const cal = await prisma.calendario.create({
          data: { proyectoId: existente.id },
        });
        calendarioId = cal.id;
      } else {
        calendarioId = existente.calendario.id;
      }
      if (existente.nombre === 'AutoFix · Implementación') {
        proyectoPrincipalId = existente.id;
      }
      if (existente.nombre === 'AutoFix · Demostración Gantt') {
        proyectoDemoId = existente.id;
      }
    }

    await prisma.feriado.createMany({
      data: feriadosChileDesde(dateAFechaIso(datos.fechaInicio)).map((f) => ({
        calendarioId,
        fecha: fechaIsoADate(f.fecha),
        descripcion: f.descripcion,
      })),
      skipDuplicates: true,
    });
  }

  await sembrarCatalogos();

  if (proyectoPrincipalId) {
    await sembrarTareas(proyectoPrincipalId);
    await sembrarDependencias(proyectoPrincipalId);
    await planificarSemilla(proyectoPrincipalId);
    await sembrarHitos(proyectoPrincipalId);
    await sembrarAsignaciones(proyectoPrincipalId);
    await recalcularCostosSemilla(proyectoPrincipalId);
    await sembrarLineaBase(proyectoPrincipalId);
    await sembrarSolicitudesCambio(proyectoPrincipalId);
  }

  if (proyectoDemoId) {
    const fechaInicioIso = sumarDiasHabiles(hoyEnZona(), -20, CALENDARIO_POR_DEFECTO);
    await sembrarDemostracionGantt(proyectoDemoId, fechaInicioIso);
  }

  await sembrarKpis();

  if (proyectoPrincipalId) {
    await recalcularProyectoSemilla(proyectoPrincipalId);
  }

  if (proyectoDemoId) {
    await recalcularProyectoSemilla(proyectoDemoId);
  }

  const tablas = await prisma.$queryRaw<{ total: bigint }[]>`
    SELECT count(*) AS total FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name <> '_prisma_migrations'
  `;
  console.log(`Seed completado: ${tablas[0]?.total ?? 0} tablas disponibles.`);
}

sembrar()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
