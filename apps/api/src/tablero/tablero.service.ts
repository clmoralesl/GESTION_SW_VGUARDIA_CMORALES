import { HttpStatus, Injectable } from '@nestjs/common';
import {
  calcularCurvaS,
  calcularVariablesKpi,
  consolidarCostos,
  costoPorEtapa,
  dateAFechaIso,
  diasDeAtraso,
  esHabil,
  estaAtrasada,
  etapaDe,
  evaluarHito,
  hojasFiltradas,
  picoCarga,
  redondear,
  type AsignacionCosto,
  type ConsultaTablero,
  type HojaCurvaS,
  type NodoCosto,
  type NodoFiltro,
  type PlanCurvaS,
  type Semaforo,
  type TableroProyecto,
  type TarjetaKpiTablero,
} from '@autofix/core';
import { cargarCalendarioLaboral } from '../calendario/calendario-laboral';
import { ExcepcionApi } from '../comun/errores/excepcion-api';
import { Reloj } from '../comun/reloj/reloj';
import { cargarDatosVariablesKpi } from '../kpi/datos-variables-kpi';
import { PrismaService } from '../prisma/prisma.service';
import { errorProyectoNoEncontrado } from '../proyectos/proyecto-abierto';

@Injectable()
export class TableroService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reloj: Reloj,
  ) {}

  async obtenerTablero(proyectoId: number, consulta: ConsultaTablero): Promise<TableroProyecto> {
    const proyecto = await this.prisma.proyecto.findUnique({ where: { id: proyectoId } });
    if (!proyecto) throw errorProyectoNoEncontrado();

    if (consulta.etapaId !== undefined) {
      const etapa = await this.prisma.tarea.findFirst({
        where: { id: consulta.etapaId, proyectoId, padreId: null },
      });
      if (!etapa) {
        throw new ExcepcionApi(
          HttpStatus.BAD_REQUEST,
          'FILTRO_INVALIDO',
          'La etapa especificada no existe o no es una etapa raíz del proyecto.',
        );
      }
    }

    if (consulta.profesionalId !== undefined) {
      const profesional = await this.prisma.profesional.findUnique({
        where: { id: consulta.profesionalId },
      });
      if (!profesional) {
        throw new ExcepcionApi(
          HttpStatus.BAD_REQUEST,
          'FILTRO_INVALIDO',
          'El profesional especificado no existe.',
        );
      }
    }

    const hoy = this.reloj.hoy();
    const calendario = await cargarCalendarioLaboral(this.prisma, proyectoId);
    const tareas = await this.prisma.tarea.findMany({ where: { proyectoId } });
    const asignacionesDb = await this.prisma.asignacion.findMany({
      where: { tarea: { proyectoId } },
      include: { profesional: true },
    });
    const todosProfesionales = await this.prisma.profesional.findMany();
    const mapaProfesionales = new Map(todosProfesionales.map((p) => [p.id, p]));

    const datosVariables = await cargarDatosVariablesKpi(
      this.prisma,
      proyectoId,
      calendario,
      hoy,
      tareas,
    );

    const nodosFiltro: NodoFiltro[] = tareas.map((t) => ({
      id: t.id,
      padreId: t.padreId,
      inicioPlan: t.inicioPlan ? dateAFechaIso(t.inicioPlan) : null,
      finPlan: t.finPlan ? dateAFechaIso(t.finPlan) : null,
    }));
    const asignacionesFiltro = asignacionesDb.map((a) => ({
      tareaId: a.tareaId,
      profesionalId: a.profesionalId,
    }));

    const hojasIds = hojasFiltradas(nodosFiltro, asignacionesFiltro, consulta);

    const hojasCurvaIds = hojasFiltradas(nodosFiltro, asignacionesFiltro, {
      etapaId: consulta.etapaId,
      profesionalId: consulta.profesionalId,
    });

    const hojasCurva: HojaCurvaS[] = tareas
      .filter((t) => hojasCurvaIds.has(t.id))
      .map((t) => ({
        tareaId: t.id,
        codigo: t.codigo,
        inicioPlan: t.inicioPlan ? dateAFechaIso(t.inicioPlan) : null,
        finPlan: t.finPlan ? dateAFechaIso(t.finPlan) : null,
        inicioReal: t.inicioReal ? dateAFechaIso(t.inicioReal) : null,
        finReal: t.finReal ? dateAFechaIso(t.finReal) : null,
        costoPlan: Number(t.costoPlan),
        avance: Number(t.porcentajeAvance),
        costoReal: Number(t.costoReal),
      }));

    const planCurva: PlanCurvaS[] | null = datosVariables.lineaBase
      ? datosVariables.lineaBase
          .filter((lb) => lb.tareaId !== null && hojasCurvaIds.has(lb.tareaId))
          .map((lb) => ({
            tareaId: lb.tareaId,
            codigo: lb.codigo,
            inicio: lb.inicioPlan,
            fin: lb.finPlan,
            costo: lb.costoPlan,
          }))
      : null;

    let puntosCurva = calcularCurvaS(hojasCurva, planCurva, hoy, (f) => esHabil(f, calendario));
    if (consulta.desde !== undefined) {
      puntosCurva = puntosCurva.filter((p) => p.fecha >= consulta.desde!);
    }
    if (consulta.hasta !== undefined) {
      puntosCurva = puntosCurva.filter((p) => p.fecha <= consulta.hasta!);
    }

    const medicionesDb = await this.prisma.kpiMedicion.findMany({
      where: {
        proyectoId,
        kpi: { codigo: { in: ['AVANCE_REAL_PCT', 'SPI', 'CPI', 'CV_PCT'] } },
      },
      orderBy: { medidoEn: 'desc' },
      include: { kpi: true },
    });

    const medicionesPorCodigo = new Map<
      string,
      { valor: number | null; semaforo: Semaforo | null }[]
    >();
    for (const m of medicionesDb) {
      const codigo = m.kpi.codigo;
      let lista = medicionesPorCodigo.get(codigo);
      if (!lista) {
        lista = [];
        medicionesPorCodigo.set(codigo, lista);
      }
      if (lista.length < 2) {
        lista.push({
          valor: m.valor !== null ? Number(m.valor) : null,
          semaforo: (m.semaforo as Semaforo) ?? null,
        });
      }
    }

    const variacionDe = (lista?: { valor: number | null }[]) => {
      if (!lista || lista.length < 2) return null;
      const v0 = lista[0]?.valor;
      const v1 = lista[1]?.valor;
      if (v0 === null || v0 === undefined || v1 === null || v1 === undefined) return null;
      return redondear(v0 - v1, 2);
    };

    const nodosCosto: NodoCosto[] = tareas.map((t) => ({ id: t.id, padreId: t.padreId }));
    const asignacionesCosto: AsignacionCosto[] = asignacionesDb.map((a) => ({
      tareaId: a.tareaId,
      horasPlan: a.horasPlan !== null ? Number(a.horasPlan) : null,
      horasReales: a.horasReales !== null ? Number(a.horasReales) : null,
      tarifaAplicada: a.tarifaAplicada !== null ? Number(a.tarifaAplicada) : null,
      cantidadPlan: a.cantidadPlan !== null ? Number(a.cantidadPlan) : null,
      cantidadReal: a.cantidadReal !== null ? Number(a.cantidadReal) : null,
      costoUnitarioAplicado:
        a.costoUnitarioAplicado !== null ? Number(a.costoUnitarioAplicado) : null,
    }));
    const resultadoCostos = consolidarCostos(nodosCosto, asignacionesCosto);

    const medAvance = medicionesPorCodigo.get('AVANCE_REAL_PCT');
    const medSpi = medicionesPorCodigo.get('SPI');
    const medCpi = medicionesPorCodigo.get('CPI');
    const medCv = medicionesPorCodigo.get('CV_PCT');

    const presupuestoTotal = Number(proyecto.presupuesto);
    const costoRealTotal = resultadoCostos.proyecto.costoReal;
    const porcentajeCosto =
      presupuestoTotal > 0 ? redondear((costoRealTotal / presupuestoTotal) * 100, 2) : null;

    const spiTarjeta: TarjetaKpiTablero = {
      valor: medSpi?.[0]?.valor ?? null,
      semaforo: medSpi?.[0]?.semaforo ?? null,
      variacion: variacionDe(medSpi),
    };

    const cpiTarjeta: TarjetaKpiTablero = {
      valor: medCpi?.[0]?.valor ?? null,
      semaforo: medCpi?.[0]?.semaforo ?? null,
      variacion: variacionDe(medCpi),
    };

    const costoEtapas = costoPorEtapa(nodosFiltro, resultadoCostos.porTarea, hojasIds);
    const mapaEtapas = new Map(tareas.filter((t) => t.padreId === null).map((t) => [t.id, t]));
    const costoPorEtapaFinal = costoEtapas
      .map((ce) => {
        const t = mapaEtapas.get(ce.etapaId);
        if (!t) return null;
        return {
          etapaId: ce.etapaId,
          codigo: t.codigo,
          nombre: t.nombre,
          costoPlan: ce.costoPlan,
          costoReal: ce.costoReal,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));

    const profsCargaIds =
      consulta.profesionalId !== undefined
        ? [consulta.profesionalId]
        : [
            ...new Set(
              asignacionesDb
                .filter((a) => a.profesionalId !== null && hojasIds.has(a.tareaId))
                .map((a) => a.profesionalId!),
            ),
          ];

    const desdeRangoCarga = consulta.desde ?? dateAFechaIso(proyecto.fechaInicio);
    const hastaRangoCarga =
      consulta.hasta ?? (proyecto.fechaFin ? dateAFechaIso(proyecto.fechaFin) : hoy);
    const cargaDesde = desdeRangoCarga <= hastaRangoCarga ? desdeRangoCarga : hastaRangoCarga;
    const cargaHasta = desdeRangoCarga <= hastaRangoCarga ? hastaRangoCarga : desdeRangoCarga;

    const cargaGlobal = datosVariables.cargaDiariaGlobal ?? new Map();
    const cargaFinal = profsCargaIds
      .map((profId) => {
        const prof = mapaProfesionales.get(profId);
        const nombre = prof?.nombre ?? '';
        const pico = picoCarga(cargaGlobal, profId, cargaDesde, cargaHasta);
        return {
          profesionalId: profId,
          nombre,
          ocupacionMaxima: pico.ocupacionMaxima,
          diaPico: pico.diaPico,
          sobreasignado: pico.sobreasignado,
        };
      })
      .sort((a, b) => b.ocupacionMaxima - a.ocupacionMaxima || a.nombre.localeCompare(b.nombre));

    const atrasadas = tareas
      .filter((t) => hojasIds.has(t.id))
      .filter((t) =>
        estaAtrasada(
          {
            finPlan: t.finPlan ? dateAFechaIso(t.finPlan) : null,
            porcentajeAvance: Number(t.porcentajeAvance),
          },
          hoy,
        ),
      )
      .map((t) => ({
        tareaId: t.id,
        codigo: t.codigo,
        nombre: t.nombre,
        diasAtraso: diasDeAtraso(
          {
            finPlan: t.finPlan ? dateAFechaIso(t.finPlan) : null,
            porcentajeAvance: Number(t.porcentajeAvance),
          },
          hoy,
          calendario,
        ),
        responsable: t.responsable ?? null,
      }))
      .sort(
        (a, b) =>
          b.diasAtraso - a.diasAtraso ||
          a.codigo.localeCompare(b.codigo, undefined, { numeric: true }),
      );

    const hitosDb = await this.prisma.hito.findMany({
      where: { proyectoId },
      include: { tarea: true },
    });

    const mapaTareas = new Map(tareas.map((t) => [t.id, t]));
    const etapasDeTodas = etapaDe(nodosFiltro);
    const hitosFiltrados = hitosDb.filter((h) => {
      if (consulta.etapaId !== undefined) {
        if (h.tareaId === null) return false;
        if (etapasDeTodas.get(h.tareaId) !== consulta.etapaId) return false;
      }
      const fObj = dateAFechaIso(h.fechaObjetivo);
      if (consulta.desde !== undefined && fObj < consulta.desde) return false;
      if (consulta.hasta !== undefined && fObj > consulta.hasta) return false;
      return true;
    });

    const itemsHitos = hitosFiltrados
      .map((h) => {
        const t = h.tareaId !== null ? mapaTareas.get(h.tareaId) : null;
        const tareaVinculada = t
          ? {
              finPlan: t.finPlan ? dateAFechaIso(t.finPlan) : null,
              porcentajeAvance: Number(t.porcentajeAvance),
            }
          : null;
        const evaluacion = evaluarHito(
          {
            fechaObjetivo: dateAFechaIso(h.fechaObjetivo),
            fechaCumplimiento: h.fechaCumplimiento ? dateAFechaIso(h.fechaCumplimiento) : null,
            tarea: tareaVinculada,
          },
          calendario,
          hoy,
        );
        return {
          id: h.id,
          nombre: h.nombre,
          fecha: dateAFechaIso(h.fechaObjetivo),
          estado: evaluacion.estado,
        };
      })
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.nombre.localeCompare(b.nombre));

    const kpisCambioIds = (
      await this.prisma.kpiDefinicion.findMany({
        where: { ambito: 'CAMBIO' },
        select: { id: true },
      })
    ).map((k) => k.id);

    const alertasDb = await this.prisma.alerta.findMany({
      where: {
        proyectoId,
        activa: true,
        tipo: { in: ['KPI', 'SOBREASIGNACION', 'PRESUPUESTO', 'HITO'] },
        NOT: {
          tipo: 'KPI',
          entidadId: { in: kpisCambioIds },
        },
      },
      orderBy: { creadaEn: 'desc' },
    });

    const alertas = alertasDb.map((a) => ({
      id: a.id,
      tipo: a.tipo,
      severidad: a.severidad,
      mensaje: a.mensaje,
      creadaEn: a.creadaEn.toISOString(),
      entidad: a.entidad,
      entidadId: a.entidadId,
    }));

    const etapasOpciones = tareas
      .filter((t) => t.padreId === null)
      .map((t) => ({ id: t.id, codigo: t.codigo, nombre: t.nombre }))
      .sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));

    const profsMap = new Map<number, string>();
    for (const a of asignacionesDb) {
      if (a.profesionalId && a.profesional) {
        profsMap.set(a.profesionalId, a.profesional.nombre);
      }
    }
    const profesionalesOpciones = [...profsMap.entries()]
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));

    const varsKpi = calcularVariablesKpi(datosVariables);
    const avancePlan =
      varsKpi.valores['AVANCE_PLAN'] !== null && varsKpi.valores['AVANCE_PLAN'] !== undefined
        ? redondear(varsKpi.valores['AVANCE_PLAN'], 2)
        : null;
    const semaforoAvance = medAvance?.[0]?.semaforo ?? spiTarjeta.semaforo;
    const notaColorAvance = medAvance?.[0]?.semaforo ? null : 'color según SPI';

    return {
      proyectoId,
      fechaCorte: hoy,
      tarjetas: {
        avance: {
          real: medAvance?.[0]?.valor ?? null,
          plan: avancePlan,
          semaforo: semaforoAvance,
          variacion: variacionDe(medAvance),
          notaColor: notaColorAvance,
        },
        spi: spiTarjeta,
        cpi: cpiTarjeta,
        costo: {
          costoReal: costoRealTotal,
          presupuesto: presupuestoTotal,
          porcentaje: porcentajeCosto,
          semaforo: medCv?.[0]?.semaforo ?? null,
          variacion: variacionDe(medCv),
        },
      },
      curvaS: {
        origen: datosVariables.versionLineaBase !== null ? 'LINEA_BASE' : 'PLAN_ACTUAL',
        puntos: puntosCurva,
      },
      hitos: {
        cumplidos: itemsHitos.filter((i) => i.estado === 'CUMPLIDO').length,
        total: itemsHitos.length,
        items: itemsHitos,
      },
      costoPorEtapa: costoPorEtapaFinal,
      carga: cargaFinal,
      atrasadas,
      alertas,
      opciones: {
        etapas: etapasOpciones,
        profesionales: profesionalesOpciones,
      },
    };
  }
}
