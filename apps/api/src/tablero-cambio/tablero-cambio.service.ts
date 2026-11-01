import { Injectable } from '@nestjs/common';
import {
  adopcionPorSolicitud,
  calcularVariablesCambio,
  type ConsultaTableroCambio,
  dateAFechaIso,
  diasHabilesEntre,
  embudoEtapas,
  etapasVencidas,
  filtrarSolicitudes,
  type LineaBaseCambioItem,
  matrizRiesgo,
  nivelRiesgo,
  type Semaforo,
  type SolicitudCambioItem,
  type TableroCambio,
  tasaAprobacion,
  tiempoPromedioPorEtapa,
} from '@autofix/core';
import { cargarCalendarioLaboral } from '../calendario/calendario-laboral';
import { Reloj } from '../comun/reloj/reloj';
import { PrismaService } from '../prisma/prisma.service';
import { errorProyectoNoEncontrado } from '../proyectos/proyecto-abierto';

@Injectable()
export class TableroCambioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reloj: Reloj,
  ) {}

  async obtenerTableroCambio(
    proyectoId: number,
    consulta: ConsultaTableroCambio,
  ): Promise<TableroCambio> {
    const proyecto = await this.prisma.proyecto.findUnique({ where: { id: proyectoId } });
    if (!proyecto) throw errorProyectoNoEncontrado();

    const hoy = this.reloj.hoy();

    const solicitudesDb = await this.prisma.solicitudCambio.findMany({
      where: { proyectoId },
      orderBy: { id: 'asc' },
      include: {
        etapas: {
          orderBy: { numero: 'asc' },
          include: {
            acciones: {
              select: { estado: true },
            },
          },
        },
      },
    });

    const opcionesResponsables = Array.from(
      new Set(solicitudesDb.map((s) => s.responsable.trim()).filter((r) => r.length > 0)),
    ).sort((a, b) => a.localeCompare(b));

    const todasFiltrables = solicitudesDb.map((s) => ({
      id: s.id,
      codigo: s.codigo,
      titulo: s.titulo,
      responsable: s.responsable,
      estado: s.estado,
      etapaActual: s.etapaActual,
      prioridad: s.prioridad,
      categoria: s.categoria,
      probabilidadRiesgo: s.probabilidadRiesgo,
      impactoRiesgo: s.impactoRiesgo,
      fechaRegistro: s.fechaRegistro.toISOString(),
      fechaDecision: s.fechaDecision ? s.fechaDecision.toISOString() : null,
      fechaCierre: s.fechaCierre ? s.fechaCierre.toISOString() : null,
      etapas: s.etapas.map((e) => ({
        id: e.id,
        numero: e.numero,
        estado: e.estado,
        fechaInicio: e.fechaInicio ? e.fechaInicio.toISOString() : null,
        fechaFin: e.fechaFin ? e.fechaFin.toISOString() : null,
        fechaIniciada: e.fechaIniciada ? e.fechaIniciada.toISOString() : null,
        fechaCompletada: e.fechaCompletada ? e.fechaCompletada.toISOString() : null,
        porcentajeAdopcion: e.porcentajeAdopcion !== null ? Number(e.porcentajeAdopcion) : null,
        acciones: e.acciones.map((a) => ({ estado: a.estado })),
      })),
    }));

    const filtradas = filtrarSolicitudes(todasFiltrables, {
      prioridad: consulta.prioridad,
      categoria: consulta.categoria,
      nivelRiesgo: consulta.nivelRiesgo,
      responsable: consulta.responsable,
      fechaDesde: consulta.desde,
      fechaHasta: consulta.hasta,
    });

    const lineasBaseDb = await this.prisma.lineaBase.findMany({
      where: { proyectoId },
      select: {
        version: true,
        costoPlanTotal: true,
        fechaFinProyecto: true,
        solicitudCambioId: true,
      },
      orderBy: { version: 'asc' },
    });

    const lineasBase: LineaBaseCambioItem[] = lineasBaseDb.map((lb) => ({
      version: lb.version,
      costoPlanTotal: Number(lb.costoPlanTotal),
      fechaFinProyecto: lb.fechaFinProyecto ? dateAFechaIso(lb.fechaFinProyecto) : null,
      solicitudCambioId: lb.solicitudCambioId,
    }));

    const calendario = await cargarCalendarioLaboral(this.prisma, proyectoId);
    const diasHabiles = (desde: string, hasta: string) =>
      diasHabilesEntre(desde, hasta, calendario);

    const filtradasParaVariables: SolicitudCambioItem[] = filtradas.map((s) => ({
      id: s.id,
      codigo: s.codigo,
      estado: s.estado,
      fechaRegistro: s.fechaRegistro,
      fechaDecision: s.fechaDecision,
      fechaCierre: s.fechaCierre,
      probabilidadRiesgo: s.probabilidadRiesgo,
      impactoRiesgo: s.impactoRiesgo,
      etapas: s.etapas.map((e) => ({
        id: e.id,
        numero: e.numero,
        estado: e.estado,
        fechaInicio: e.fechaInicio,
        fechaFin: e.fechaFin,
        fechaIniciada: e.fechaIniciada,
        fechaCompletada: e.fechaCompletada,
        porcentajeAdopcion: e.porcentajeAdopcion,
        acciones: e.acciones,
      })),
    }));

    const variables = calcularVariablesCambio({
      solicitudes: filtradasParaVariables,
      lineasBase,
      corte: hoy,
      diasHabilesEntre: diasHabiles,
    });

    const resumen = {
      total: variables.SC_TOTAL,
      abiertas: variables.SC_ABIERTAS,
      aprobadas: variables.SC_APROBADAS,
      rechazadas: variables.SC_RECHAZADAS,
      tasaAprobacion: tasaAprobacion(variables.SC_APROBADAS, variables.SC_RECHAZADAS),
      tiempoCicloPromedio: variables.SC_TIEMPO_CICLO_PROM,
      adopcionPromedio: variables.SC_ADOPCION_PROM,
    };

    const embudo = embudoEtapas(
      filtradas.map((s) => ({
        estado: s.estado,
        etapaActual: s.etapaActual,
        etapas: s.etapas.map((e) => ({
          numero: e.numero,
          estado: e.estado,
        })),
      })),
    );

    const tiemposPorEtapa = tiempoPromedioPorEtapa(
      filtradas.map((s) => ({
        etapas: s.etapas.map((e) => ({
          numero: e.numero,
          estado: e.estado,
          fechaIniciada: e.fechaIniciada,
          fechaCompletada: e.fechaCompletada,
        })),
      })),
    );

    const matriz = matrizRiesgo(
      filtradas.map((s) => ({
        id: s.id,
        codigo: s.codigo,
        estado: s.estado,
        prioridad: s.prioridad,
        probabilidadRiesgo: s.probabilidadRiesgo,
        impactoRiesgo: s.impactoRiesgo,
      })),
    );

    const adopcion = adopcionPorSolicitud(
      filtradas.map((s) => ({
        id: s.id,
        codigo: s.codigo,
        titulo: s.titulo,
        estado: s.estado,
        etapas: s.etapas.map((e) => ({
          numero: e.numero,
          porcentajeAdopcion: e.porcentajeAdopcion,
        })),
      })),
    );

    const kpisDef = await this.prisma.kpiDefinicion.findMany({
      where: { activo: true, ambito: 'CAMBIO' },
      orderBy: { codigo: 'asc' },
    });

    const kpiIds = kpisDef.map((k) => k.id);

    const medicionesDb = await this.prisma.kpiMedicion.findMany({
      where: {
        proyectoId,
        kpiId: { in: kpiIds },
      },
      orderBy: [{ medidoEn: 'desc' }, { id: 'desc' }],
    });

    const medicionesPorKpi = new Map<number, typeof medicionesDb>();
    for (const m of medicionesDb) {
      const lista = medicionesPorKpi.get(m.kpiId) ?? [];
      lista.push(m);
      medicionesPorKpi.set(m.kpiId, lista);
    }

    const kpis = kpisDef.map((k) => {
      const lista = medicionesPorKpi.get(k.id) ?? [];
      const primera = lista[0];
      const ultimas10Invertidas = lista.slice(0, 10).reverse();
      return {
        kpiId: k.id,
        codigo: k.codigo,
        nombre: k.nombre,
        unidad: k.unidad,
        meta: k.meta !== null ? Number(k.meta) : null,
        valor: primera && primera.valor !== null ? Number(primera.valor) : null,
        semaforo: primera ? (primera.semaforo as Semaforo) : null,
        historial: ultimas10Invertidas.map((m) => ({
          medidoEn: m.medidoEn.toISOString(),
          valor: m.valor !== null ? Number(m.valor) : null,
          semaforo: m.semaforo as Semaforo,
        })),
      };
    });

    const etapasVencidasLista = etapasVencidas(filtradasParaVariables, hoy);

    const riesgosAltos = filtradas
      .filter((s) => s.estado !== 'RECHAZADA' && s.estado !== 'CERRADA')
      .filter((s) => {
        const nivel = nivelRiesgo(s.probabilidadRiesgo, s.impactoRiesgo);
        return nivel === 'ALTO' || nivel === 'CRITICO';
      })
      .map((s) => ({
        solicitudId: s.id,
        codigo: s.codigo,
        titulo: s.titulo,
        nivel: nivelRiesgo(s.probabilidadRiesgo, s.impactoRiesgo),
        prioridad: s.prioridad,
      }));

    const alertasKpiDb = await this.prisma.alerta.findMany({
      where: {
        proyectoId,
        activa: true,
        tipo: 'KPI',
        severidad: 'CRITICA',
        entidadId: { in: kpiIds },
      },
      orderBy: { creadaEn: 'desc' },
    });

    const kpiEnRojo = alertasKpiDb.map((a) => ({
      alertaId: a.id,
      kpiId: a.entidadId ?? 0,
      mensaje: a.mensaje,
      creadaEn: a.creadaEn.toISOString(),
    }));

    return {
      corte: hoy,
      resumen,
      embudo,
      tiemposPorEtapa,
      matrizRiesgo: matriz,
      adopcion,
      kpis,
      alertas: {
        etapasVencidas: etapasVencidasLista,
        riesgosAltos,
        kpiEnRojo,
      },
      opciones: {
        responsables: opcionesResponsables,
      },
    };
  }
}
