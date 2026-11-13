import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
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
  RolUsuario,
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
  evaluarHito,
  fechaIsoADate,
  feriadosChileDesde,
  NOMBRES_ETAPAS,
  numerarArbol,
  planificarProyecto,
  sumarDiasCorridos,
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

const NOMBRE_PROYECTO_PRINCIPAL = 'AutoFix Gestión · Piloto 3 sucursales';

const PROYECTOS_SEMILLA = [
  {
    nombre: NOMBRE_PROYECTO_PRINCIPAL,
    descripcion:
      'Plataforma unificada de agenda, órdenes de trabajo, presupuestos con aprobación trazable, repuestos por orden, historial y garantías, y seguimiento del vehículo con WhatsApp Business, en piloto en Santiago, Rancagua y Viña del Mar.',
    responsable: 'Claudio Morales',
    presupuesto: 123408680,
    fechaInicio: new Date('2026-10-05T00:00:00.000Z'),
    fechaFin: new Date('2027-05-28T00:00:00.000Z'),
    estado: EstadoProyecto.EN_CURSO,
  },
];

const TAREAS_SEMILLA: {
  codigo: string;
  nombre: string;
  responsable: string;
  duracionDias: number;
  descripcion: string;
  inicioReal?: string;
  finReal?: string;
  porcentajeAvance?: number;
}[] = [
  {
    codigo: '1',
    nombre: 'Inicio, análisis y diseño',
    responsable: 'Claudio Morales',
    duracionDias: 1,
    descripcion: '',
  },
  {
    codigo: '1.1',
    nombre: 'Inicio y planificación',
    responsable: 'Claudio Morales',
    duracionDias: 1,
    descripcion: '',
  },
  {
    codigo: '1.1.1',
    nombre: 'Elaborar el plan de gestión del proyecto',
    responsable: 'Claudio Morales',
    duracionDias: 10,
    descripcion: 'EDT, cronograma, costos, riesgos y comunicaciones.',
    inicioReal: '2026-10-05',
    finReal: '2026-10-20',
    porcentajeAvance: 100,
  },
  {
    codigo: '1.1.2',
    nombre: 'Contratar la fábrica de software por hitos',
    responsable: 'Claudio Morales',
    duracionDias: 15,
    descripcion: 'Bases, evaluación de ofertas y contrato por hitos.',
    inicioReal: '2026-10-05',
    finReal: '2026-10-26',
    porcentajeAvance: 100,
  },
  {
    codigo: '1.2',
    nombre: 'Análisis de procesos y requisitos',
    responsable: 'Valeska Guardia',
    duracionDias: 1,
    descripcion: '',
  },
  {
    codigo: '1.2.1',
    nombre: 'Levantar procesos actuales y diseñar procesos futuros',
    responsable: 'Valeska Guardia',
    duracionDias: 12,
    descripcion:
      'Levantamiento en las 3 sucursales piloto y procesos futuros en BPMN validados por Operaciones.',
    inicioReal: '2026-10-27',
    porcentajeAvance: 85,
  },
  {
    codigo: '1.2.2',
    nombre: 'Especificar backlog y reglas de negocio (repuestos, garantías y portal)',
    responsable: 'Valeska Guardia',
    duracionDias: 19,
    descripcion:
      'Historias de usuario priorizadas; reglas de repuestos por OT (origen y conciliación), de garantías (identificación, vigencia y verificación entre sucursales) y del portal con WhatsApp.',
  },
  {
    codigo: '1.3',
    nombre: 'Diseño de la solución',
    responsable: 'Andrés Contreras',
    duracionDias: 1,
    descripcion: '',
  },
  {
    codigo: '1.3.1',
    nombre: 'Diseñar integraciones y arquitectura, y configurar ambientes cloud',
    responsable: 'Andrés Contreras',
    duracionDias: 24,
    descripcion:
      'Prueba de concepto de servicios del ERP y del inventario, especificación de interfaces, arquitectura escalable a 30 sucursales y ambientes de desarrollo, pruebas y producción.',
    inicioReal: '2026-10-27',
    porcentajeAvance: 60,
  },
  {
    codigo: '1.3.2',
    nombre: 'Diseñar el modelo de datos y la estrategia de migración',
    responsable: 'Andrés Contreras',
    duracionDias: 13,
    descripcion:
      'Ficha única, OT, presupuestos, repuestos y garantías; deduplicación por RUT y patente; 24 meses de 3 sucursales.',
    inicioReal: '2026-11-12',
    porcentajeAvance: 20,
  },
  {
    codigo: '1.3.3',
    nombre: 'Diseñar y validar prototipos UX/UI',
    responsable: 'Javiera Rivas',
    duracionDias: 20,
    descripcion:
      'Prototipos de módulos internos y del portal responsivo, validados con usuarios clave y Director Comercial.',
  },
  {
    codigo: '2',
    nombre: 'Construcción de la plataforma',
    responsable: 'Andrés Contreras',
    duracionDias: 1,
    descripcion: '',
  },
  {
    codigo: '2.1',
    nombre: 'Agenda, ficha única y orden de trabajo',
    responsable: 'Andrés Contreras',
    duracionDias: 1,
    descripcion: '',
  },
  {
    codigo: '2.1.1',
    nombre: 'Construir agenda centralizada y asignación por carga y especialidad',
    responsable: 'Andrés Contreras',
    duracionDias: 25,
    descripcion:
      'Capacidad por sucursal y especialidad, canales, inasistencias, alerta de reserva duplicada y asignación de mecánicos. Carril de desarrollo 1.',
  },
  {
    codigo: '2.1.2',
    nombre: 'Construir ficha única de cliente y vehículo y orden de trabajo digital',
    responsable: 'Andrés Contreras',
    duracionDias: 25,
    descripcion:
      'Identificación por RUT y patente sin duplicados y OT con formato único. Carril de desarrollo 2.',
  },
  {
    codigo: '2.2',
    nombre: 'Presupuestos, repuestos y garantías',
    responsable: 'Andrés Contreras',
    duracionDias: 1,
    descripcion: '',
  },
  {
    codigo: '2.2.1',
    nombre: 'Construir presupuestos con aprobación trazable del cliente',
    responsable: 'Andrés Contreras',
    duracionDias: 15,
    descripcion:
      'Versión, fecha, hora y canal de aprobación; bloqueo de cierre si el monto difiere. Carril 2.',
  },
  {
    codigo: '2.2.2',
    nombre: 'Construir registro de repuestos por OT y conciliación con inventario',
    responsable: 'Andrés Contreras',
    duracionDias: 10,
    descripcion:
      'Repuestos consumidos y su origen (stock propio, otra sucursal, bodega central o compra urgente), conciliados con el consumo en inventario. Carril 3; la dependencia con 2.2.3 es de recurso.',
  },
  {
    codigo: '2.2.3',
    nombre: 'Construir historial y verificación de garantías entre sucursales',
    responsable: 'Andrés Contreras',
    duracionDias: 20,
    descripcion:
      'Historial multisucursal y garantías con vigencia por plazo y kilometraje. Carril 3.',
  },
  {
    codigo: '2.3',
    nombre: 'Portal de clientes, WhatsApp y tablero',
    responsable: 'Andrés Contreras',
    duracionDias: 1,
    descripcion: '',
  },
  {
    codigo: '2.3.1',
    nombre: 'Construir portal responsivo y autoagendamiento',
    responsable: 'Andrés Contreras',
    duracionDias: 25,
    descripcion:
      'Estado del vehículo, aprobación de presupuestos y reserva web sobre la agenda real. Carril 1.',
  },
  {
    codigo: '2.3.2',
    nombre: 'Integrar notificaciones y enlaces por WhatsApp Business',
    responsable: 'Andrés Contreras',
    duracionDias: 10,
    descripcion: 'Plantillas aprobadas, consentimiento y avisos por cambio de estado. Carril 3.',
  },
  {
    codigo: '2.3.3',
    nombre: 'Construir tablero gerencial consolidado',
    responsable: 'Andrés Contreras',
    duracionDias: 10,
    descripcion:
      'Horas disponibles y ocupadas, inasistencias, compras urgentes y tiempo promedio de reparación. Carril 2.',
  },
  {
    codigo: '3',
    nombre: 'Integración, migración y pruebas',
    responsable: 'Andrés Contreras',
    duracionDias: 1,
    descripcion: '',
  },
  {
    codigo: '3.1',
    nombre: 'Integración con inventario y ERP',
    responsable: 'Andrés Contreras',
    duracionDias: 1,
    descripcion: '',
  },
  {
    codigo: '3.1.1',
    nombre: 'Construir integración con el inventario',
    responsable: 'Andrés Contreras',
    duracionDias: 20,
    descripcion: 'Consulta de stock y registro de consumo.',
  },
  {
    codigo: '3.1.2',
    nombre: 'Construir integración con el ERP para facturación',
    responsable: 'Andrés Contreras',
    duracionDias: 20,
    descripcion:
      'Envío de OT cerradas a facturación con los servicios del proveedor, sin modificar el ERP.',
  },
  {
    codigo: '3.2',
    nombre: 'Migrar los datos del piloto (24 meses, 3 sucursales)',
    responsable: 'Valeska Guardia',
    duracionDias: 46,
    descripcion:
      'Extracción, depuración y deduplicación, carga de prueba y validación por muestreo (98 % o más).',
  },
  {
    codigo: '3.3',
    nombre: 'Ejecutar pruebas integrales, de integración, rendimiento y seguridad',
    responsable: 'Paula Navarro',
    duracionDias: 15,
    descripcion:
      'Pruebas de extremo a extremo, con ERP, inventario y WhatsApp, y pruebas de rendimiento y seguridad (OWASP).',
  },
  {
    codigo: '4',
    nombre: 'Aceptación, implementación y cierre',
    responsable: 'Claudio Morales',
    duracionDias: 1,
    descripcion: '',
  },
  {
    codigo: '4.1',
    nombre: 'Ejecutar UAT y decisión Go/No-Go',
    responsable: 'Valeska Guardia',
    duracionDias: 15,
    descripcion:
      'Preparación de casos y datos, UAT con usuarios clave de las 3 sucursales y acta Go/No-Go.',
  },
  {
    codigo: '4.2',
    nombre: 'Capacitación y puesta en marcha',
    responsable: 'Claudio Morales',
    duracionDias: 1,
    descripcion: '',
  },
  {
    codigo: '4.2.1',
    nombre: 'Capacitar por turnos y gestionar el cambio',
    responsable: 'Claudio Morales',
    duracionDias: 30,
    descripcion:
      'Plan de gestión del cambio, manuales y cápsulas; capacitación por turnos en modalidad sombra, sin cerrar sucursales.',
  },
  {
    codigo: '4.2.2',
    nombre: 'Adquirir tabletas y revisar la red de las sucursales',
    responsable: 'Claudio Morales',
    duracionDias: 15,
    descripcion:
      'Compra justo a tiempo: debe terminar cuando comienza la puesta en marcha (dependencia SF).',
  },
  {
    codigo: '4.2.3',
    nombre: 'Ejecutar la carga final y la puesta en marcha escalonada',
    responsable: 'Claudio Morales',
    duracionDias: 13,
    descripcion:
      'Carga final en fin de semana y puesta en marcha en Rancagua, Viña del Mar y Santiago.',
  },
  {
    codigo: '4.3',
    nombre: 'Estabilizar, transferir y cerrar el proyecto',
    responsable: 'Claudio Morales',
    duracionDias: 19,
    descripcion:
      '4 semanas de soporte en sitio, transferencia a TI interna, informe de indicadores, plan de escalamiento, lecciones aprendidas y acta de cierre.',
  },
];

async function sembrarTareas(proyectoId: number): Promise<void> {
  const conteo = await prisma.tarea.count({ where: { proyectoId } });
  if (conteo > 0) return;

  const idsPorCodigo = new Map<string, number>();
  for (const def of TAREAS_SEMILLA) {
    const partes = def.codigo.split('.');
    const codigoPadre = partes.length > 1 ? partes.slice(0, -1).join('.') : null;
    const nivel =
      partes.length === 1
        ? NivelTarea.ETAPA
        : partes.length === 2
          ? NivelTarea.ACTIVIDAD
          : NivelTarea.SUBACTIVIDAD;
    const creada = await prisma.tarea.create({
      data: {
        proyectoId,
        padreId: codigoPadre ? (idsPorCodigo.get(codigoPadre) ?? null) : null,
        nivel,
        codigo: `~${def.codigo}`,
        orden: Number(partes[partes.length - 1]),
        nombre: def.nombre,
        descripcion: def.descripcion,
        responsable: def.responsable,
        duracionDias: def.duracionDias,
        inicioReal: def.inicioReal ? fechaIsoADate(def.inicioReal) : null,
        finReal: def.finReal ? fechaIsoADate(def.finReal) : null,
        porcentajeAvance: new Prisma.Decimal(def.porcentajeAvance ?? 0),
      },
    });
    idsPorCodigo.set(def.codigo, creada.id);
  }

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
  { predecesora: '1.1.2', sucesora: '1.2.1', tipo: TipoDependencia.FS, desfaseDias: 0 },
  { predecesora: '1.1.1', sucesora: '1.2.1', tipo: TipoDependencia.FS, desfaseDias: 0 },
  { predecesora: '1.2.1', sucesora: '1.2.2', tipo: TipoDependencia.FS, desfaseDias: 0 },
  { predecesora: '1.1.2', sucesora: '1.3.1', tipo: TipoDependencia.FS, desfaseDias: 0 },
  { predecesora: '1.2.1', sucesora: '1.3.2', tipo: TipoDependencia.FS, desfaseDias: 0 },
  { predecesora: '1.2.2', sucesora: '1.3.3', tipo: TipoDependencia.SS, desfaseDias: 5 },
  { predecesora: '1.3.3', sucesora: '2.1.1', tipo: TipoDependencia.FS, desfaseDias: 0 },
  { predecesora: '1.3.2', sucesora: '2.1.1', tipo: TipoDependencia.FS, desfaseDias: 0 },
  { predecesora: '1.3.3', sucesora: '2.1.2', tipo: TipoDependencia.FS, desfaseDias: 0 },
  { predecesora: '2.1.2', sucesora: '2.2.1', tipo: TipoDependencia.FS, desfaseDias: 0 },
  { predecesora: '2.2.3', sucesora: '2.2.2', tipo: TipoDependencia.FS, desfaseDias: 0 },
  { predecesora: '3.1.1', sucesora: '2.2.2', tipo: TipoDependencia.SS, desfaseDias: 10 },
  { predecesora: '2.1.2', sucesora: '2.2.3', tipo: TipoDependencia.SS, desfaseDias: 10 },
  { predecesora: '2.1.1', sucesora: '2.3.1', tipo: TipoDependencia.FS, desfaseDias: 0 },
  { predecesora: '2.2.1', sucesora: '2.3.1', tipo: TipoDependencia.SS, desfaseDias: 0 },
  { predecesora: '2.2.2', sucesora: '2.3.2', tipo: TipoDependencia.FS, desfaseDias: 0 },
  { predecesora: '2.2.1', sucesora: '2.3.3', tipo: TipoDependencia.FS, desfaseDias: 0 },
  { predecesora: '2.2.2', sucesora: '2.3.3', tipo: TipoDependencia.FS, desfaseDias: 0 },
  { predecesora: '1.3.3', sucesora: '3.1.1', tipo: TipoDependencia.FS, desfaseDias: 0 },
  { predecesora: '1.3.1', sucesora: '3.1.1', tipo: TipoDependencia.FS, desfaseDias: 0 },
  { predecesora: '3.1.1', sucesora: '3.1.2', tipo: TipoDependencia.FS, desfaseDias: 0 },
  { predecesora: '1.3.2', sucesora: '3.2', tipo: TipoDependencia.FS, desfaseDias: 0 },
  { predecesora: '1.2.2', sucesora: '3.2', tipo: TipoDependencia.FS, desfaseDias: 0 },
  { predecesora: '2.2.3', sucesora: '3.2', tipo: TipoDependencia.FF, desfaseDias: 10 },
  { predecesora: '2.3.1', sucesora: '3.3', tipo: TipoDependencia.FS, desfaseDias: 0 },
  { predecesora: '2.3.2', sucesora: '3.3', tipo: TipoDependencia.FS, desfaseDias: 0 },
  { predecesora: '2.3.3', sucesora: '3.3', tipo: TipoDependencia.FS, desfaseDias: 0 },
  { predecesora: '3.1.2', sucesora: '3.3', tipo: TipoDependencia.FS, desfaseDias: 0 },
  { predecesora: '3.3', sucesora: '4.1', tipo: TipoDependencia.FF, desfaseDias: 10 },
  { predecesora: '3.2', sucesora: '4.1', tipo: TipoDependencia.FS, desfaseDias: 0 },
  { predecesora: '3.3', sucesora: '4.2.1', tipo: TipoDependencia.SS, desfaseDias: 0 },
  { predecesora: '4.1', sucesora: '4.2.1', tipo: TipoDependencia.FF, desfaseDias: 5 },
  { predecesora: '4.2.3', sucesora: '4.2.2', tipo: TipoDependencia.SF, desfaseDias: 0 },
  { predecesora: '4.1', sucesora: '4.2.3', tipo: TipoDependencia.FS, desfaseDias: 0 },
  { predecesora: '4.2.1', sucesora: '4.2.3', tipo: TipoDependencia.FS, desfaseDias: 0 },
  { predecesora: '3.2', sucesora: '4.2.3', tipo: TipoDependencia.FS, desfaseDias: 0 },
  { predecesora: '4.2.3', sucesora: '4.3', tipo: TipoDependencia.FS, desfaseDias: 0 },
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

  if (plan.finProyecto !== '2027-05-28') {
    throw new Error(
      `Fin de proyecto inesperado en seed: ${plan.finProyecto} (esperado: 2027-05-28)`,
    );
  }

  if (plan.tareas.length !== 36) {
    throw new Error(`Total de tareas inesperado en seed: ${plan.tareas.length} (esperado: 36)`);
  }

  const tarea223 = plan.tareas.find((t) => t.codigo === '2.2.3');
  const tarea33 = plan.tareas.find((t) => t.codigo === '3.3');
  if (!tarea223 || !tarea223.esCritica || !tarea33 || !tarea33.esCritica) {
    throw new Error('Las tareas 2.2.3 y 3.3 deben ser criticas en el seed.');
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

  const reloj = new Reloj();
  const hoy = reloj.hoy();

  const definicionHitos = [
    {
      nombre: 'Plan de gestión aprobado',
      tareaId: buscarTarea('1.1.1').id,
      fechaObjetivo: fechaIsoADate('2026-10-19'),
      fechaCumplimiento: fechaIsoADate('2026-10-20'),
      criterio: 'Plan de gestión aprobado por el patrocinador',
      responsable: 'Claudio Morales',
      invariante: 'CUMPLIDO',
    },
    {
      nombre: 'Fábrica de software contratada',
      tareaId: buscarTarea('1.1.2').id,
      fechaObjetivo: fechaIsoADate('2026-10-26'),
      fechaCumplimiento: fechaIsoADate('2026-10-26'),
      criterio: 'Contrato por hitos firmado con la fábrica',
      responsable: 'Claudio Morales',
      invariante: 'CUMPLIDO',
    },
    {
      nombre: 'Procesos futuros validados',
      tareaId: buscarTarea('1.2.1').id,
      fechaObjetivo: fechaIsoADate('2026-11-11'),
      fechaCumplimiento: null,
      criterio: 'Procesos futuros de las 3 sucursales validados por el Gerente de Operaciones',
      responsable: 'Valeska Guardia',
      invariante: 'ATRASADO',
    },
    {
      nombre: 'Diseño aprobado',
      tareaId: buscarTarea('1.3').id,
      fechaObjetivo: fechaIsoADate('2026-12-17'),
      fechaCumplimiento: null,
      criterio: 'Arquitectura, modelo de datos y prototipos aprobados',
      responsable: 'Andrés Contreras',
      invariante: 'PENDIENTE',
    },
    {
      nombre: 'Primera operación funcional en las 3 sucursales',
      tareaId: buscarTarea('4.2.3').id,
      fechaObjetivo: fechaIsoADate('2027-04-30'),
      fechaCumplimiento: null,
      criterio: 'Acta de puesta en marcha en Rancagua, Viña del Mar y Santiago',
      responsable: 'Claudio Morales',
      invariante: 'PENDIENTE',
    },
    {
      nombre: 'Cierre del proyecto',
      tareaId: buscarTarea('4.3').id,
      fechaObjetivo: fechaIsoADate('2027-05-28'),
      fechaCumplimiento: null,
      criterio: 'Acta de cierre y plan de escalamiento aprobados por el patrocinador',
      responsable: 'Claudio Morales',
      invariante: 'PENDIENTE',
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

interface DetalleEtapaSemilla {
  r?: string;
  c?: string;
  i?: string;
  f?: string;
  ev?: [string, string, string[]][];
}

const DETALLE_ETAPAS: Record<string, Record<string, DetalleEtapaSemilla>> = {
  'SC-001': {
    '1': {
      r: 'Andrés Contreras',
      c: 'Necesidad detectada en la prueba de concepto de 1.3.1: el servicio de recepción de órdenes del ERP exige configuración del proveedor no cubierta por las 60 horas contratadas. Se documentaron los métodos faltantes y se estimaron 40 horas adicionales. Pendiente: firma del Gerente de Finanzas para pasar a análisis.',
      ev: [
        [
          'Informe_prueba_concepto_ERP.pdf',
          'Informe de prueba de concepto del ERP (SC-001)',
          [
            'Tarea: 1.3.1 Diseñar integraciones y arquitectura',
            'Resultado: el servicio de facturación responde, pero la recepción de órdenes',
            'cerradas requiere habilitar 2 métodos adicionales del proveedor.',
            'Estimación del proveedor: 40 horas x $60.000 = $2.400.000.',
            'Riesgo asociado: R-02 (probabilidad 3, impacto 4).',
            'Responsable: Andrés Contreras.',
          ],
        ],
      ],
    },
    '2': { r: 'Valeska Guardia', i: '2026-11-17', f: '2026-11-20' },
    '3': { r: 'Claudio Morales', i: '2026-11-23', f: '2026-11-25' },
  },
  'SC-002': {
    '1': {
      r: 'Valeska Guardia',
      c: 'El Director Comercial pidió avisar al cliente cuando su garantía esté por vencer, con enlace al portal para agendar revisión. Se registró como solicitud de alcance vinculada a REQ-06 y REQ-08.',
      ev: [
        [
          'Minuta_reunion_Director_Comercial.pdf',
          'Minuta de reunión con el Director Comercial (SC-002)',
          [
            'Asistentes: Director Comercial, Valeska Guardia, Claudio Morales.',
            'Necesidad: aviso por WhatsApp 30 días antes del vencimiento de la garantía,',
            'con enlace al portal para agendar una revisión.',
            'Beneficio esperado: más retorno de clientes y más uso del portal.',
            'Requisitos relacionados: REQ-06 y REQ-08.',
          ],
        ],
      ],
    },
    '2': {
      r: 'Andrés Contreras',
      c: 'Análisis de impacto: +3 días en 2.2.3 (historial y garantías, tarea crítica), asignación de Javiera Rivas al 40 % para las plantillas de alerta y +$2.000.000 de presupuesto. El cierre se movería del 28-05-2027 al 02-06-2027, dentro del límite del 04-06-2027.',
      ev: [
        [
          'Informe_impacto_SC-002.pdf',
          'Informe de impacto de SC-002',
          [
            'Duración: 2.2.3 pasa de 20 a 23 días hábiles (tarea crítica).',
            'Recursos: Javiera Rivas al 40 % en 2.2.3 (plantillas de alerta).',
            'Costo: presupuesto de $123.408.680 a $125.408.680.',
            'Plazo: cierre del 28-05-2027 al 02-06-2027 (consume 3 de 5 días de reserva).',
            'Fuente: simulación de la app antes de aprobar.',
          ],
        ],
      ],
    },
    '3': {
      r: 'Claudio Morales',
      c: 'Riesgo evaluado como alto (probabilidad 3 x impacto 4 = 12) por consumir 3 de los 5 días de reserva de cronograma y por depender de la aprobación de plantillas de WhatsApp (R-12). Se recomienda aprobar con seguimiento semanal de la ruta crítica. Queda a decisión del Comité de Cambios.',
      ev: [
        [
          'Matriz_riesgo_SC-002.pdf',
          'Evaluación de riesgos de SC-002',
          [
            'Probabilidad: 3. Impacto: 4. Nivel: 12 (alto).',
            'Riesgos relacionados: R-07 (atraso de la fábrica) y R-12 (plantillas de WhatsApp).',
            'Reserva de cronograma disponible: 5 días hábiles; el cambio consume 3.',
            'Recomendación: aprobar con seguimiento semanal de la ruta crítica.',
          ],
        ],
      ],
    },
    '4': { r: 'Claudio Morales' },
    '5': { r: 'Valeska Guardia' },
    '6': { r: 'Andrés Contreras' },
    '7': { r: 'Claudio Morales' },
    '8': { r: 'Valeska Guardia' },
    '9': { r: 'Claudio Morales' },
    '10': { r: 'Valeska Guardia' },
  },
  'SC-003': {
    '1': {
      r: 'Bodega central',
      c: 'Bodega central advirtió que la interfaz del inventario se cae en los cierres de mes. Sin respaldo, las órdenes quedarían sin repuestos registrados (REQ-04).',
    },
    '2': {
      r: 'Andrés Contreras',
      c: 'Se evaluaron dos alternativas: reintentos en línea o carga programada diaria del consumo. Se eligió la carga programada por su menor costo (estimado en $1.200.000 de horas de integración) y porque no modifica el inventario (RES-04).',
    },
    '3': {
      r: 'Claudio Morales',
      c: 'Riesgo medio-alto (2 x 4 = 8): sin la carga programada se incumpliría REQ-04 si falla la interfaz (R-03). El Comité de Cambios aprobó la solicitud el 25-10-2026.',
      ev: [
        [
          'Acta_Comite_Cambios_SC-003.pdf',
          'Acta del Comité de Cambios (SC-003)',
          [
            'Fecha: 25-10-2026.',
            'Asistentes: Gerente General, Gerente de Operaciones, Director Comercial, Claudio Morales.',
            'Decisión: APROBADA.',
            'Fundamento: asegura el registro de repuestos por orden (REQ-04) ante fallas de la interfaz (R-03).',
            'Condición: definir el formato del archivo con el proveedor del inventario.',
          ],
        ],
      ],
    },
    '4': {
      r: 'Andrés Contreras',
      i: '2026-10-26',
      f: '2026-11-20',
      c: 'En curso: diseño del archivo de carga programada y del proceso nocturno de conciliación. Acción correctiva pendiente: acordar el formato con el proveedor del inventario.',
    },
    '5': { r: 'Valeska Guardia', i: '2026-11-23', f: '2026-11-24' },
    '6': { r: 'Andrés Contreras', i: '2026-11-25', f: '2026-12-18' },
    '7': { r: 'Claudio Morales', i: '2026-12-21', f: '2026-12-23' },
    '8': { r: 'Valeska Guardia', i: '2026-12-28', f: '2026-12-29' },
    '9': { r: 'Andrés Contreras', i: '2026-12-30', f: '2027-01-05' },
    '10': { r: 'Valeska Guardia', i: '2027-01-06', f: '2027-01-15' },
  },
  'SC-004': {
    '1': {
      r: 'Valeska Guardia',
      c: 'El área comercial pidió aplicaciones nativas para iOS y Android, además del portal responsivo.',
    },
    '2': {
      r: 'Andrés Contreras',
      c: 'Estimación: 3 meses de 2 desarrolladores móviles (unos $26.000.000) y publicación en tiendas. No cabe en la ruta crítica: movería el cierre más allá del límite del 04-06-2027.',
    },
    '3': {
      r: 'Claudio Morales',
      c: 'Riesgo alto (4 x 4 = 16): incumpliría RES-01 (plazo) y contradice EXC-01. El Comité de Cambios la rechazó el 28-10-2026 y la derivó al plan de escalamiento.',
      ev: [
        [
          'Acta_Comite_Cambios_SC-004.pdf',
          'Acta del Comité de Cambios (SC-004)',
          [
            'Fecha: 28-10-2026.',
            'Decisión: RECHAZADA.',
            'Fundamento: fuera del alcance aprobado (EXC-01); costo estimado de $26.000.000',
            'y atraso del cierre más allá del límite de 8 meses (RES-01).',
            'Derivación: evaluar en el plan de escalamiento posterior al piloto.',
          ],
        ],
      ],
    },
  },
  'SC-005': {
    '1': {
      r: 'Valeska Guardia',
      c: 'Operaciones pidió que Finanzas valide el mapeo entre la orden de trabajo y el documento de cobro, para evitar diferencias entre presupuesto y cobro (317 reclamos al año).',
    },
    '2': {
      r: 'Valeska Guardia',
      c: 'El cambio solo agrega un paso de validación en 1.3.1; no cambia duraciones ni costos del proyecto.',
    },
    '3': {
      r: 'Claudio Morales',
      c: 'Riesgo bajo (1 x 2 = 2). Aprobada por el Comité de Cambios el 16-10-2026.',
      ev: [
        [
          'Acta_Comite_Cambios_SC-005.pdf',
          'Acta del Comité de Cambios (SC-005)',
          [
            'Fecha: 16-10-2026.',
            'Decisión: APROBADA.',
            'Fundamento: reduce el riesgo de diferencias entre presupuesto y cobro.',
            'Impacto en cronograma y costo: ninguno.',
          ],
        ],
      ],
    },
    '4': { r: 'Claudio Morales' },
    '5': {
      r: 'Valeska Guardia',
      c: 'Se comunicó el nuevo paso a Finanzas, al arquitecto y al proveedor del ERP por correo y en la reunión semanal del 19-10-2026.',
    },
    '6': {
      r: 'Andrés Contreras',
      c: 'Finanzas revisó la matriz de mapeo campo por campo (montos, impuestos, descuentos y repuestos) y dejó 6 observaciones.',
    },
    '7': {
      r: 'Claudio Morales',
      c: 'Se verificó que las 6 observaciones quedaran registradas y asignadas; el mapeo pasó a versión 1.1.',
    },
    '8': { r: 'Valeska Guardia' },
    '9': {
      r: 'Valeska Guardia',
      c: 'Acción correctiva: actualizar la matriz de mapeo con las observaciones de Finanzas. Cerrada el 30-10-2026.',
    },
    '10': {
      r: 'Valeska Guardia',
      c: 'Finanzas quedó como validador obligatorio en el procedimiento de cambios de integración. Adopción medida: 85 % de los campos del mapeo validados en la primera revisión.',
      ev: [
        [
          'Informe_adopcion_SC-005.pdf',
          'Informe de adopción de SC-005',
          [
            'Indicador: campos del mapeo validados por Finanzas en la primera revisión.',
            'Resultado: 85 % (meta del KPI de adopción: 90 %).',
            'Acción de mejora: incluir a Finanzas desde el diseño de cada nueva interfaz.',
            'Estado: cambio adoptado y solicitud cerrada.',
          ],
        ],
      ],
    },
  },
};

function textoPdf(texto: string): string {
  return texto.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function crearPdfEvidencia(titulo: string, lineas: string[]): Buffer {
  const contenido = [
    'BT',
    '/F1 14 Tf',
    '50 780 Td',
    `(${textoPdf(titulo)}) Tj`,
    '/F1 10 Tf',
    '0 -20 Td',
    '(AutoFix Gestión - Piloto 3 sucursales) Tj',
    ...lineas.flatMap((l) => ['0 -16 Td', `(${textoPdf(l)}) Tj`]),
    'ET',
  ].join('\n');
  const cuerpo = Buffer.from(contenido, 'latin1');
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  ];
  const partes: Buffer[] = [Buffer.from('%PDF-1.4\n', 'latin1')];
  const desplazamientos: number[] = [];
  let largo = partes[0]!.length;
  const agregar = (b: Buffer) => {
    partes.push(b);
    largo += b.length;
  };
  objetos.forEach((o, i) => {
    desplazamientos.push(largo);
    agregar(Buffer.from(`${i + 1} 0 obj\n${o}\nendobj\n`, 'latin1'));
  });
  desplazamientos.push(largo);
  agregar(Buffer.from(`5 0 obj\n<< /Length ${cuerpo.length} >>\nstream\n`, 'latin1'));
  agregar(cuerpo);
  agregar(Buffer.from('\nendstream\nendobj\n', 'latin1'));
  const inicioXref = largo;
  const xref = [
    'xref',
    `0 ${desplazamientos.length + 1}`,
    '0000000000 65535 f ',
    ...desplazamientos.map((d) => `${String(d).padStart(10, '0')} 00000 n `),
    'trailer',
    `<< /Size ${desplazamientos.length + 1} /Root 1 0 R >>`,
    'startxref',
    String(inicioXref),
    '%%EOF',
  ].join('\n');
  agregar(Buffer.from(xref + '\n', 'latin1'));
  return Buffer.concat(partes);
}

function guardarEvidenciaSemilla(nombreDisco: string, contenido: Buffer): void {
  const directorio = process.env.RUTA_UPLOADS || resolve(process.cwd(), 'uploads');
  mkdirSync(directorio, { recursive: true });
  writeFileSync(join(directorio, nombreDisco), contenido);
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
      titulo: 'Ampliar las horas de soporte del proveedor del ERP',
      descripcion:
        'Contratar 40 horas adicionales del proveedor del ERP para habilitar el servicio de recepción de órdenes cerradas.',
      justificacion:
        'La prueba de concepto muestra que el servicio requiere configuración adicional del proveedor (riesgo R-02).',
      solicitante: 'Andrés Contreras',
      responsable: 'Claudio Morales',
      prioridad: Prioridad.MEDIA,
      categoria: CategoriaCambio.RECURSO,
      probabilidadRiesgo: 2,
      impactoRiesgo: 3,
      fechaRegistro: new Date('2026-10-25T09:00:00.000Z'),
      pasos: [[1, 'iniciar']],
    },
    {
      codigo: 'SC-002',
      titulo: 'Alertas de vencimiento de garantía por WhatsApp Business',
      descripcion:
        'Agregar avisos automáticos al cliente cuando una garantía está por vencer, con enlace al portal para agendar revisión.',
      justificacion:
        'El Director Comercial busca aumentar el retorno de clientes y el uso del portal (REQ-06 y REQ-08).',
      solicitante: 'Director Comercial',
      responsable: 'Valeska Guardia',
      prioridad: Prioridad.ALTA,
      categoria: CategoriaCambio.ALCANCE,
      probabilidadRiesgo: 3,
      impactoRiesgo: 4,
      fechaRegistro: new Date('2026-10-20T10:00:00.000Z'),
      pasos: [
        [1, 'iniciar'],
        [1, 'completar'],
        [2, 'iniciar'],
        [2, 'completar'],
        [3, 'iniciar'],
        [3, 'completar'],
      ],
    },
    {
      codigo: 'SC-003',
      titulo: 'Carga programada de inventario como respaldo de la integración',
      descripcion:
        'Implementar una carga programada diaria del consumo de repuestos si la interfaz del inventario no responde.',
      justificacion:
        'Asegurar el registro de repuestos por orden aunque falle la interfaz en línea (riesgo R-03).',
      solicitante: 'Bodega central',
      responsable: 'Claudio Morales',
      prioridad: Prioridad.ALTA,
      categoria: CategoriaCambio.COSTO,
      probabilidadRiesgo: 2,
      impactoRiesgo: 4,
      fechaRegistro: new Date('2026-10-15T11:00:00.000Z'),
      fechaDecision: new Date('2026-10-28T14:00:00.000Z'),
      accionesCorrectivas: [
        {
          descripcion:
            'Definir el formato del archivo de carga programada con el proveedor del inventario',
          responsable: 'Andrés Contreras',
          fechaCompromiso: '2026-11-20',
          estado: EstadoAccion.PENDIENTE,
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
        [4, 'iniciar'],
      ],
    },
    {
      codigo: 'SC-004',
      titulo: 'Aplicación móvil nativa para clientes',
      descripcion:
        'Desarrollar aplicaciones nativas para iOS y Android además del portal web responsivo.',
      justificacion: 'Preferencia del área comercial por presencia en tiendas de aplicaciones.',
      solicitante: 'Director Comercial',
      responsable: 'Valeska Guardia',
      prioridad: Prioridad.BAJA,
      categoria: CategoriaCambio.COSTO,
      probabilidadRiesgo: 4,
      impactoRiesgo: 4,
      fechaRegistro: new Date('2026-10-18T16:00:00.000Z'),
      fechaDecision: new Date('2026-10-29T17:00:00.000Z'),
      motivoRechazo:
        'Fuera del alcance aprobado (EXC-01): no cabe en el plazo de 8 meses ni en el presupuesto; se evaluará en el escalamiento.',
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
      titulo: 'Incorporar a Finanzas en la validación del mapeo de facturación',
      descripcion:
        'Agregar a Finanzas como validador obligatorio del mapeo de datos entre la orden de trabajo y el documento de cobro.',
      justificacion:
        'Reducir el riesgo de diferencias entre presupuesto y cobro (317 reclamos al año).',
      solicitante: 'Gerente de Operaciones',
      responsable: 'Valeska Guardia',
      prioridad: Prioridad.MEDIA,
      categoria: CategoriaCambio.CALIDAD,
      probabilidadRiesgo: 1,
      impactoRiesgo: 2,
      fechaRegistro: new Date('2026-10-06T08:30:00.000Z'),
      fechaDecision: new Date('2026-10-16T11:00:00.000Z'),
      fechaCierre: new Date('2026-11-06T18:00:00.000Z'),
      adopcion: 85,
      accionesCorrectivas: [
        {
          descripcion: 'Actualizar la matriz de mapeo con las observaciones de Finanzas',
          responsable: 'Valeska Guardia',
          fechaCompromiso: '2026-10-28',
          fechaCierre: '2026-10-30',
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
        [4, 'omitir', { comentario: 'Cambio de procedimiento sin impacto en el cronograma' }],
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
        fechaCierre: def.fechaCierre ?? fechaCierreCalculada,
        motivoRechazo: def.motivoRechazo,
      },
    });

    for (const etapaMod of estadoModelo.etapas) {
      const detalle = DETALLE_ETAPAS[def.codigo]?.[String(etapaMod.numero)] ?? {};
      const iniciada = etapaMod.fechaIniciada ? String(etapaMod.fechaIniciada).slice(0, 10) : null;
      const completada = etapaMod.fechaCompletada
        ? String(etapaMod.fechaCompletada).slice(0, 10)
        : null;
      let fechaInicioSeed: Date | null = detalle.i
        ? fechaIsoADate(detalle.i)
        : iniciada
          ? fechaIsoADate(iniciada)
          : null;
      let fechaFinSeed: Date | null = detalle.f
        ? fechaIsoADate(detalle.f)
        : completada
          ? fechaIsoADate(completada)
          : null;
      if (def.codigo === 'SC-001' && etapaMod.numero === 1) {
        fechaInicioSeed = fechaIsoADate('2026-10-26');
        fechaFinSeed = fechaIsoADate('2026-10-30');
      }

      const creadaEtapa = await prisma.etapaCambio.create({
        data: {
          solicitudId: solicitud.id,
          numero: etapaMod.numero,
          nombre: NOMBRES_ETAPAS[etapaMod.numero] ?? `Etapa ${etapaMod.numero}`,
          estado: etapaMod.estado as EstadoEtapa,
          fechaInicio: fechaInicioSeed,
          fechaFin: fechaFinSeed,
          fechaIniciada: etapaMod.fechaIniciada
            ? fechaIsoADate(String(etapaMod.fechaIniciada).slice(0, 10))
            : null,
          fechaCompletada: etapaMod.fechaCompletada
            ? fechaIsoADate(String(etapaMod.fechaCompletada).slice(0, 10))
            : null,
          responsable: detalle.r ?? null,
          comentario: etapaMod.comentario ?? detalle.c ?? null,
          porcentajeAdopcion:
            def.codigo === 'SC-005' && etapaMod.numero === 10 && def.adopcion
              ? new Prisma.Decimal(def.adopcion)
              : null,
        },
      });

      for (const [indice, [nombreArchivo, titulo, lineas]] of (detalle.ev ?? []).entries()) {
        const contenido = crearPdfEvidencia(titulo, lineas);
        const nombreDisco = `semilla-${def.codigo.toLowerCase()}-etapa${etapaMod.numero}-${indice + 1}.pdf`;
        guardarEvidenciaSemilla(nombreDisco, contenido);
        await prisma.evidencia.create({
          data: {
            etapaId: creadaEtapa.id,
            nombreArchivo,
            rutaArchivo: nombreDisco,
            tipoMime: 'application/pdf',
            tamanoBytes: contenido.length,
            subidoPor:
              def.codigo === 'SC-001' ? RolUsuario.JEFE_PROYECTO : RolUsuario.COMITE_CAMBIOS,
          },
        });
      }

      const debeCrearAcciones =
        def.accionesCorrectivas &&
        ((def.codigo === 'SC-005' && etapaMod.numero === 9) ||
          (def.codigo === 'SC-003' && etapaMod.numero === 4));

      if (debeCrearAcciones && def.accionesCorrectivas) {
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

    if (def.codigo === 'SC-002') {
      const tarea223 = await prisma.tarea.findFirst({
        where: { proyectoId, codigo: '2.2.3' },
      });
      const profJaviera = await prisma.profesional.findFirst({
        where: { claveNombre: 'javiera rivas' },
      });
      if (tarea223) {
        await prisma.impactoCambio.create({
          data: {
            solicitudId: solicitud.id,
            tipo: 'DURACION',
            tareaId: tarea223.id,
            descripcion:
              'Aumento de 3 días en historial y garantías por las alertas de vencimiento',
            datos: { duracionDias: tarea223.duracionDias + 3 },
            aplicado: false,
          },
        });
        if (profJaviera) {
          await prisma.impactoCambio.create({
            data: {
              solicitudId: solicitud.id,
              tipo: 'ASIGNACION',
              tareaId: tarea223.id,
              descripcion: 'Asignación de la diseñadora UX/UI a las plantillas de alerta',
              datos: {
                operacion: 'agregar',
                elemento: 'PROFESIONAL',
                profesionalId: profJaviera.id,
                dedicacion: 40,
              },
              aplicado: false,
            },
          });
        }
        await prisma.impactoCambio.create({
          data: {
            solicitudId: solicitud.id,
            tipo: 'PRESUPUESTO',
            descripcion: 'Aumento de presupuesto por las alertas de vencimiento de garantía',
            datos: { presupuesto: 125408680 },
            aplicado: false,
          },
        });
      }
    }
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
      nombre: 'Claudio Morales',
      cargo: 'Director del proyecto',
      tarifaHora: 20800,
      horasDiarias: 8,
    },
    {
      nombre: 'Valeska Guardia',
      cargo: 'Analista funcional y Product Owner',
      tarifaHora: 15500,
      horasDiarias: 8,
    },
    {
      nombre: 'Andrés Contreras',
      cargo: 'Arquitecto y líder técnico (fábrica)',
      tarifaHora: 19000,
      horasDiarias: 8,
    },
    {
      nombre: 'Paula Navarro',
      cargo: 'Analista de control de calidad (fábrica)',
      tarifaHora: 12500,
      horasDiarias: 8,
    },
    {
      nombre: 'Javiera Rivas',
      cargo: 'Diseñadora UX/UI',
      tarifaHora: 14900,
      horasDiarias: 8,
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
      nombre: 'Desarrollador de aplicaciones (fábrica)',
      tipo: 'Humano',
      unidad: 'hora',
      costoUnitario: 16100,
    },
    {
      nombre: 'Desarrollador de integraciones (fábrica)',
      tipo: 'Humano',
      unidad: 'hora',
      costoUnitario: 17900,
    },
    {
      nombre: 'Especialista en capacitación y gestión del cambio',
      tipo: 'Humano',
      unidad: 'hora',
      costoUnitario: 14300,
    },
    {
      nombre: 'Tableta para recepción y taller',
      tipo: 'Equipamiento',
      unidad: 'unidad',
      costoUnitario: 450000,
    },
    {
      nombre: 'Kit de capacitación impreso',
      tipo: 'Material',
      unidad: 'unidad',
      costoUnitario: 50000,
    },
    {
      nombre: 'Infraestructura en la nube (3 ambientes)',
      tipo: 'Servicio',
      unidad: 'mes',
      costoUnitario: 900000,
    },
    {
      nombre: 'Servicio WhatsApp Business',
      tipo: 'Servicio',
      unidad: 'mes',
      costoUnitario: 400000,
    },
    {
      nombre: 'Horas de soporte del proveedor del ERP',
      tipo: 'Servicio',
      unidad: 'hora',
      costoUnitario: 60000,
    },
    {
      nombre: 'Servicio de depuración y migración de datos',
      tipo: 'Servicio',
      unidad: 'servicio',
      costoUnitario: 4000000,
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

const ASIGNACIONES_SEMILLA: {
  tarea: string;
  profesional?: string;
  recurso?: string;
  dedicacion?: number;
  horasReales?: number | null;
  cantidadPlan?: number;
  cantidadReal?: number | null;
}[] = [
  { tarea: '1.1.1', profesional: 'Claudio Morales', dedicacion: 50, horasReales: 44 },
  { tarea: '1.1.2', profesional: 'Claudio Morales', dedicacion: 50, horasReales: 60 },
  { tarea: '1.2.1', profesional: 'Valeska Guardia', dedicacion: 100, horasReales: 100 },
  { tarea: '1.2.1', profesional: 'Claudio Morales', dedicacion: 20, horasReales: 20 },
  { tarea: '1.2.2', profesional: 'Valeska Guardia', dedicacion: 100, horasReales: null },
  { tarea: '1.2.2', profesional: 'Claudio Morales', dedicacion: 20, horasReales: null },
  { tarea: '1.3.1', profesional: 'Andrés Contreras', dedicacion: 50, horasReales: 54 },
  {
    tarea: '1.3.1',
    recurso: 'Desarrollador de integraciones (fábrica)',
    cantidadPlan: 56,
    cantidadReal: 30,
  },
  {
    tarea: '1.3.1',
    recurso: 'Horas de soporte del proveedor del ERP',
    cantidadPlan: 10,
    cantidadReal: 10,
  },
  {
    tarea: '1.3.1',
    recurso: 'Infraestructura en la nube (3 ambientes)',
    cantidadPlan: 0.5,
    cantidadReal: null,
  },
  { tarea: '1.3.2', profesional: 'Andrés Contreras', dedicacion: 50, horasReales: 12 },
  { tarea: '1.3.3', profesional: 'Javiera Rivas', dedicacion: 100, horasReales: null },
  { tarea: '2.1.1', profesional: 'Andrés Contreras', dedicacion: 30, horasReales: null },
  { tarea: '2.1.1', profesional: 'Paula Navarro', dedicacion: 25, horasReales: null },
  {
    tarea: '2.1.1',
    recurso: 'Desarrollador de aplicaciones (fábrica)',
    cantidadPlan: 200,
    cantidadReal: null,
  },
  {
    tarea: '2.1.1',
    recurso: 'Infraestructura en la nube (3 ambientes)',
    cantidadPlan: 1.5,
    cantidadReal: null,
  },
  { tarea: '2.1.2', profesional: 'Paula Navarro', dedicacion: 25, horasReales: null },
  { tarea: '2.1.2', profesional: 'Valeska Guardia', dedicacion: 40, horasReales: null },
  { tarea: '2.1.2', profesional: 'Claudio Morales', dedicacion: 20, horasReales: null },
  {
    tarea: '2.1.2',
    recurso: 'Desarrollador de aplicaciones (fábrica)',
    cantidadPlan: 200,
    cantidadReal: null,
  },
  { tarea: '2.2.1', profesional: 'Paula Navarro', dedicacion: 25, horasReales: null },
  { tarea: '2.2.1', profesional: 'Valeska Guardia', dedicacion: 40, horasReales: null },
  { tarea: '2.2.1', profesional: 'Claudio Morales', dedicacion: 20, horasReales: null },
  {
    tarea: '2.2.1',
    recurso: 'Desarrollador de aplicaciones (fábrica)',
    cantidadPlan: 120,
    cantidadReal: null,
  },
  { tarea: '2.2.2', profesional: 'Paula Navarro', dedicacion: 25, horasReales: null },
  {
    tarea: '2.2.2',
    recurso: 'Desarrollador de aplicaciones (fábrica)',
    cantidadPlan: 80,
    cantidadReal: null,
  },
  {
    tarea: '2.2.2',
    recurso: 'Desarrollador de integraciones (fábrica)',
    cantidadPlan: 20,
    cantidadReal: null,
  },
  { tarea: '2.2.3', profesional: 'Andrés Contreras', dedicacion: 30, horasReales: null },
  { tarea: '2.2.3', profesional: 'Paula Navarro', dedicacion: 25, horasReales: null },
  {
    tarea: '2.2.3',
    recurso: 'Desarrollador de aplicaciones (fábrica)',
    cantidadPlan: 160,
    cantidadReal: null,
  },
  { tarea: '2.3.1', profesional: 'Andrés Contreras', dedicacion: 30, horasReales: null },
  { tarea: '2.3.1', profesional: 'Paula Navarro', dedicacion: 25, horasReales: null },
  { tarea: '2.3.1', profesional: 'Javiera Rivas', dedicacion: 30, horasReales: null },
  {
    tarea: '2.3.1',
    recurso: 'Desarrollador de aplicaciones (fábrica)',
    cantidadPlan: 200,
    cantidadReal: null,
  },
  {
    tarea: '2.3.1',
    recurso: 'Infraestructura en la nube (3 ambientes)',
    cantidadPlan: 1.5,
    cantidadReal: null,
  },
  { tarea: '2.3.2', profesional: 'Paula Navarro', dedicacion: 25, horasReales: null },
  {
    tarea: '2.3.2',
    recurso: 'Desarrollador de aplicaciones (fábrica)',
    cantidadPlan: 80,
    cantidadReal: null,
  },
  { tarea: '2.3.2', recurso: 'Servicio WhatsApp Business', cantidadPlan: 1, cantidadReal: null },
  { tarea: '2.3.3', profesional: 'Paula Navarro', dedicacion: 25, horasReales: null },
  { tarea: '2.3.3', profesional: 'Valeska Guardia', dedicacion: 40, horasReales: null },
  { tarea: '2.3.3', profesional: 'Claudio Morales', dedicacion: 20, horasReales: null },
  {
    tarea: '2.3.3',
    recurso: 'Desarrollador de aplicaciones (fábrica)',
    cantidadPlan: 80,
    cantidadReal: null,
  },
  {
    tarea: '3.1.1',
    recurso: 'Desarrollador de integraciones (fábrica)',
    cantidadPlan: 160,
    cantidadReal: null,
  },
  {
    tarea: '3.1.2',
    recurso: 'Desarrollador de integraciones (fábrica)',
    cantidadPlan: 160,
    cantidadReal: null,
  },
  {
    tarea: '3.1.2',
    recurso: 'Horas de soporte del proveedor del ERP',
    cantidadPlan: 50,
    cantidadReal: null,
  },
  { tarea: '3.2', profesional: 'Valeska Guardia', dedicacion: 30, horasReales: null },
  { tarea: '3.2', profesional: 'Andrés Contreras', dedicacion: 10, horasReales: null },
  {
    tarea: '3.2',
    recurso: 'Servicio de depuración y migración de datos',
    cantidadPlan: 1,
    cantidadReal: null,
  },
  { tarea: '3.3', profesional: 'Paula Navarro', dedicacion: 100, horasReales: null },
  { tarea: '3.3', profesional: 'Andrés Contreras', dedicacion: 30, horasReales: null },
  { tarea: '3.3', profesional: 'Claudio Morales', dedicacion: 20, horasReales: null },
  {
    tarea: '3.3',
    recurso: 'Desarrollador de aplicaciones (fábrica)',
    cantidadPlan: 240,
    cantidadReal: null,
  },
  {
    tarea: '3.3',
    recurso: 'Desarrollador de integraciones (fábrica)',
    cantidadPlan: 60,
    cantidadReal: null,
  },
  {
    tarea: '3.3',
    recurso: 'Infraestructura en la nube (3 ambientes)',
    cantidadPlan: 0.75,
    cantidadReal: null,
  },
  { tarea: '4.1', profesional: 'Valeska Guardia', dedicacion: 100, horasReales: null },
  { tarea: '4.1', profesional: 'Claudio Morales', dedicacion: 20, horasReales: null },
  {
    tarea: '4.1',
    recurso: 'Desarrollador de aplicaciones (fábrica)',
    cantidadPlan: 120,
    cantidadReal: null,
  },
  { tarea: '4.1', recurso: 'Servicio WhatsApp Business', cantidadPlan: 1, cantidadReal: null },
  {
    tarea: '4.1',
    recurso: 'Infraestructura en la nube (3 ambientes)',
    cantidadPlan: 0.75,
    cantidadReal: null,
  },
  {
    tarea: '4.2.1',
    recurso: 'Especialista en capacitación y gestión del cambio',
    cantidadPlan: 200,
    cantidadReal: null,
  },
  { tarea: '4.2.1', recurso: 'Kit de capacitación impreso', cantidadPlan: 50, cantidadReal: null },
  {
    tarea: '4.2.2',
    recurso: 'Tableta para recepción y taller',
    cantidadPlan: 12,
    cantidadReal: null,
  },
  { tarea: '4.2.3', profesional: 'Claudio Morales', dedicacion: 50, horasReales: null },
  { tarea: '4.2.3', profesional: 'Valeska Guardia', dedicacion: 50, horasReales: null },
  { tarea: '4.2.3', profesional: 'Andrés Contreras', dedicacion: 40, horasReales: null },
  {
    tarea: '4.2.3',
    recurso: 'Desarrollador de aplicaciones (fábrica)',
    cantidadPlan: 104,
    cantidadReal: null,
  },
  {
    tarea: '4.2.3',
    recurso: 'Especialista en capacitación y gestión del cambio',
    cantidadPlan: 52,
    cantidadReal: null,
  },
  { tarea: '4.2.3', recurso: 'Servicio WhatsApp Business', cantidadPlan: 1, cantidadReal: null },
  { tarea: '4.3', profesional: 'Claudio Morales', dedicacion: 50, horasReales: null },
  { tarea: '4.3', profesional: 'Valeska Guardia', dedicacion: 50, horasReales: null },
  { tarea: '4.3', profesional: 'Andrés Contreras', dedicacion: 50, horasReales: null },
  { tarea: '4.3', profesional: 'Paula Navarro', dedicacion: 30, horasReales: null },
  {
    tarea: '4.3',
    recurso: 'Desarrollador de aplicaciones (fábrica)',
    cantidadPlan: 152,
    cantidadReal: null,
  },
  {
    tarea: '4.3',
    recurso: 'Especialista en capacitación y gestión del cambio',
    cantidadPlan: 46,
    cantidadReal: null,
  },
  { tarea: '4.3', recurso: 'Servicio WhatsApp Business', cantidadPlan: 2, cantidadReal: null },
  {
    tarea: '4.3',
    recurso: 'Infraestructura en la nube (3 ambientes)',
    cantidadPlan: 1,
    cantidadReal: null,
  },
];

async function sembrarAsignaciones(proyectoId: number): Promise<void> {
  const conteo = await prisma.asignacion.count({ where: { tarea: { proyectoId } } });
  if (conteo > 0) return;

  const tareas = await prisma.tarea.findMany({ where: { proyectoId } });
  const porCodigo = new Map(tareas.map((t) => [t.codigo, t]));

  for (const def of ASIGNACIONES_SEMILLA) {
    const tarea = porCodigo.get(def.tarea);
    if (!tarea) throw new Error(`Tarea ${def.tarea} no encontrada para asignación en seed.`);
    if (def.profesional) {
      const profesional = await prisma.profesional.findFirstOrThrow({
        where: { nombre: def.profesional },
      });
      const dedicacion = def.dedicacion ?? 100;
      const horasPlan = calcularHorasPlan(
        tarea.duracionDias,
        Number(profesional.horasDiarias),
        dedicacion,
      );
      await prisma.asignacion.create({
        data: {
          tareaId: tarea.id,
          profesionalId: profesional.id,
          dedicacion: new Prisma.Decimal(dedicacion),
          horasPlan: new Prisma.Decimal(horasPlan),
          horasReales:
            def.horasReales === undefined || def.horasReales === null
              ? null
              : new Prisma.Decimal(def.horasReales),
          tarifaAplicada: profesional.tarifaHora,
        },
      });
    } else if (def.recurso) {
      const recurso = await prisma.recurso.findFirstOrThrow({ where: { nombre: def.recurso } });
      await prisma.asignacion.create({
        data: {
          tareaId: tarea.id,
          recursoId: recurso.id,
          cantidadPlan: new Prisma.Decimal(def.cantidadPlan ?? 0),
          cantidadReal:
            def.cantidadReal === undefined || def.cantidadReal === null
              ? null
              : new Prisma.Decimal(def.cantidadReal),
          costoUnitarioAplicado: recurso.costoUnitario,
        },
      });
    }
  }
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
      esAdicional: false,
    },
    {
      codigo: 'CAMBIO_TOTAL',
      nombre: 'Total de solicitudes de cambio',
      descripcion: 'Cantidad total de solicitudes de cambio registradas en el proyecto.',
      ambito: AmbitoKpi.CAMBIO,
      formula: 'SC_TOTAL',
      unidad: UnidadKpi.NUMERO,
      meta: 5,
      direccion: DireccionKpi.MENOR_MEJOR,
      esAdicional: false,
      umbrales: [
        { semaforo: Semaforo.VERDE, valorDesde: 5 },
        { semaforo: Semaforo.AMARILLO, valorDesde: 8 },
      ],
    },
    {
      codigo: 'CAMBIO_TASA_APROBACION',
      nombre: 'Tasa de aprobación de cambios',
      descripcion: 'Porcentaje de solicitudes aprobadas respecto a las decididas.',
      ambito: AmbitoKpi.CAMBIO,
      formula: 'SC_APROBADAS / (SC_APROBADAS + SC_RECHAZADAS) * 100',
      unidad: UnidadKpi.PORCENTAJE,
      meta: 70,
      direccion: DireccionKpi.MAYOR_MEJOR,
      esAdicional: false,
      umbrales: [
        { semaforo: Semaforo.VERDE, valorDesde: 60 },
        { semaforo: Semaforo.AMARILLO, valorDesde: 40 },
      ],
    },
    {
      codigo: 'CAMBIO_TASA_RECHAZO',
      nombre: 'Tasa de rechazo de cambios',
      descripcion: 'Porcentaje de solicitudes rechazadas respecto al total.',
      ambito: AmbitoKpi.CAMBIO,
      formula: 'SC_RECHAZADAS / SC_TOTAL * 100',
      unidad: UnidadKpi.PORCENTAJE,
      meta: 20,
      direccion: DireccionKpi.MENOR_MEJOR,
      esAdicional: false,
      umbrales: [
        { semaforo: Semaforo.VERDE, valorDesde: 20 },
        { semaforo: Semaforo.AMARILLO, valorDesde: 35 },
      ],
    },
    {
      codigo: 'CAMBIO_PCT_ABIERTAS',
      nombre: 'Porcentaje de solicitudes abiertas',
      descripcion: 'Porcentaje de solicitudes abiertas respecto al total.',
      ambito: AmbitoKpi.CAMBIO,
      formula: 'SC_ABIERTAS / SC_TOTAL * 100',
      unidad: UnidadKpi.PORCENTAJE,
      meta: 40,
      direccion: DireccionKpi.MENOR_MEJOR,
      esAdicional: false,
      umbrales: [
        { semaforo: Semaforo.VERDE, valorDesde: 40 },
        { semaforo: Semaforo.AMARILLO, valorDesde: 70 },
      ],
    },
    {
      codigo: 'CAMBIO_TIEMPO_CICLO',
      nombre: 'Tiempo de ciclo promedio',
      descripcion: 'Promedio de días corridos desde el registro hasta el cierre.',
      ambito: AmbitoKpi.CAMBIO,
      formula: 'SC_TIEMPO_CICLO_PROM',
      unidad: UnidadKpi.DIAS,
      meta: 30,
      direccion: DireccionKpi.MENOR_MEJOR,
      esAdicional: true,
      umbrales: [
        { semaforo: Semaforo.VERDE, valorDesde: 30 },
        { semaforo: Semaforo.AMARILLO, valorDesde: 45 },
      ],
    },
    {
      codigo: 'CAMBIO_TIEMPO_EVALUACION',
      nombre: 'Tiempo de evaluación promedio',
      descripcion: 'Promedio de días corridos desde el inicio de evaluación hasta la decisión.',
      ambito: AmbitoKpi.CAMBIO,
      formula: 'SC_TIEMPO_EVAL_PROM',
      unidad: UnidadKpi.DIAS,
      meta: 10,
      direccion: DireccionKpi.MENOR_MEJOR,
      esAdicional: false,
      umbrales: [
        { semaforo: Semaforo.VERDE, valorDesde: 10 },
        { semaforo: Semaforo.AMARILLO, valorDesde: 15 },
      ],
    },
    {
      codigo: 'CAMBIO_ETAPAS_VENCIDAS',
      nombre: 'Etapas de cambio vencidas',
      descripcion: 'Cantidad de etapas en curso con fecha de fin superada.',
      ambito: AmbitoKpi.CAMBIO,
      formula: 'SC_ETAPAS_VENCIDAS',
      unidad: UnidadKpi.NUMERO,
      meta: 0,
      direccion: DireccionKpi.MENOR_MEJOR,
      esAdicional: false,
      umbrales: [
        { semaforo: Semaforo.VERDE, valorDesde: 0 },
        { semaforo: Semaforo.AMARILLO, valorDesde: 2 },
      ],
    },
    {
      codigo: 'CAMBIO_IMPACTO_COSTO',
      nombre: 'Impacto total en costo',
      descripcion: 'Suma de variaciones en costo planificado por cambios aprobados.',
      ambito: AmbitoKpi.CAMBIO,
      formula: 'SC_IMPACTO_COSTO_TOTAL',
      unidad: UnidadKpi.CLP,
      meta: 10000000,
      direccion: DireccionKpi.MENOR_MEJOR,
      esAdicional: false,
      umbrales: [
        { semaforo: Semaforo.VERDE, valorDesde: 10000000 },
        { semaforo: Semaforo.AMARILLO, valorDesde: 21350000 },
      ],
    },
    {
      codigo: 'CAMBIO_IMPACTO_PLAZO',
      nombre: 'Impacto total en plazo',
      descripcion: 'Suma de variaciones en días hábiles de la fecha final del proyecto.',
      ambito: AmbitoKpi.CAMBIO,
      formula: 'SC_IMPACTO_DIAS_TOTAL',
      unidad: UnidadKpi.DIAS,
      meta: 3,
      direccion: DireccionKpi.MENOR_MEJOR,
      esAdicional: false,
      umbrales: [
        { semaforo: Semaforo.VERDE, valorDesde: 3 },
        { semaforo: Semaforo.AMARILLO, valorDesde: 5 },
      ],
    },
    {
      codigo: 'CAMBIO_PCT_ACCIONES_CERRADAS',
      nombre: 'Porcentaje de acciones correctivas cerradas',
      descripcion: 'Porcentaje de acciones correctivas en estado cerrada.',
      ambito: AmbitoKpi.CAMBIO,
      formula: 'SC_ACC_CORRECTIVAS_CERRADAS / SC_ACC_CORRECTIVAS_TOTAL * 100',
      unidad: UnidadKpi.PORCENTAJE,
      meta: 100,
      direccion: DireccionKpi.MAYOR_MEJOR,
      esAdicional: true,
      umbrales: [
        { semaforo: Semaforo.VERDE, valorDesde: 80 },
        { semaforo: Semaforo.AMARILLO, valorDesde: 50 },
      ],
    },
    {
      codigo: 'CAMBIO_INDICE_ADOPCION',
      nombre: 'Índice de adopción promedio',
      descripcion: 'Porcentaje de adopción promedio registrado en las etapas.',
      ambito: AmbitoKpi.CAMBIO,
      formula: 'SC_ADOPCION_PROM',
      unidad: UnidadKpi.PORCENTAJE,
      meta: 90,
      direccion: DireccionKpi.MAYOR_MEJOR,
      esAdicional: true,
      umbrales: [
        { semaforo: Semaforo.VERDE, valorDesde: 80 },
        { semaforo: Semaforo.AMARILLO, valorDesde: 60 },
      ],
    },
    {
      codigo: 'CAMBIO_RIESGO_ALTO',
      nombre: 'Solicitudes con riesgo alto o crítico',
      descripcion: 'Cantidad de solicitudes abiertas con nivel de riesgo alto o crítico.',
      ambito: AmbitoKpi.CAMBIO,
      formula: 'SC_RIESGO_ALTO',
      unidad: UnidadKpi.NUMERO,
      meta: 0,
      direccion: DireccionKpi.MENOR_MEJOR,
      esAdicional: false,
      umbrales: [
        { semaforo: Semaforo.VERDE, valorDesde: 0 },
        { semaforo: Semaforo.AMARILLO, valorDesde: 1 },
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
        esAdicional: def.esAdicional ?? false,
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
        esAdicional: def.esAdicional ?? false,
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

export async function sembrar(): Promise<void> {
  let proyectoPrincipalId: number | null = null;

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
      if (creado.nombre === NOMBRE_PROYECTO_PRINCIPAL) {
        proyectoPrincipalId = creado.id;
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
      if (existente.nombre === NOMBRE_PROYECTO_PRINCIPAL) {
        proyectoPrincipalId = existente.id;
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
    await sembrarSolicitudesCambio(proyectoPrincipalId);
  }

  await sembrarKpis();

  if (proyectoPrincipalId) {
    await recalcularProyectoSemilla(proyectoPrincipalId);

    const tarea121 = await prisma.tarea.findFirst({
      where: { proyectoId: proyectoPrincipalId, codigo: '1.2.1' },
    });
    if (tarea121) {
      await prisma.tarea.update({
        where: { id: tarea121.id },
        data: {
          inicioReal: fechaIsoADate('2026-10-27'),
          porcentajeAvance: new Prisma.Decimal(85),
        },
      });
      await new Promise((r) => setTimeout(r, 100));
      await recalcularProyectoSemilla(proyectoPrincipalId);
    }
  }

  const tablas = await prisma.$queryRaw<{ total: bigint }[]>`
    SELECT count(*) AS total FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name <> '_prisma_migrations'
  `;
  console.log(`Seed completado: ${tablas[0]?.total ?? 0} tablas disponibles.`);
}

if (require.main === module) {
  sembrar()
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
