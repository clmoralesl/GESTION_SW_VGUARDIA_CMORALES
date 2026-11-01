import { Injectable } from '@nestjs/common';
import { AmbitoKpi, EstadoProyecto, Prisma, SeveridadAlerta, TipoAlerta } from '@prisma/client';
import {
  calcularSemaforo,
  calcularVariablesCambio,
  calcularVariablesKpi,
  codigosVariablesPorAmbito,
  etapasVencidas,
  redondear,
  type CalendarioLaboral,
} from '@autofix/core';
import { analizarFormula, evaluarArbol, type NodoFormula } from '@autofix/core/formulas';
import { Reloj } from '../comun/reloj/reloj';
import { cargarDatosVariablesKpi } from '../kpi/datos-variables-kpi';
import { cargarDatosVariablesCambio } from '../kpi/datos-variables-cambio';
import { cargarCalendarioLaboral } from '../calendario/calendario-laboral';
import type { ContextoRecalculo, PasoRecalculo } from './recalculo.tipos';

@Injectable()
export class PasoKpi implements PasoRecalculo {
  readonly nombre = 'kpi';

  constructor(private readonly reloj: Reloj) {}

  async ejecutar(contexto: ContextoRecalculo): Promise<void> {
    if (contexto.proyecto.estado === EstadoProyecto.CERRADO) return;

    const proyectoId = contexto.proyecto.id;
    await contexto.tx.$executeRaw`SELECT pg_advisory_xact_lock(1401)`;

    const corte = this.reloj.hoy();
    const datosVariables = await cargarDatosVariablesKpi(
      contexto.tx,
      proyectoId,
      contexto.calendario,
      corte,
      contexto.tareas,
    );
    const resultadoVariables = calcularVariablesKpi(datosVariables);

    const kpisActivos = await contexto.tx.kpiDefinicion.findMany({
      where: {
        activo: true,
        ambito: AmbitoKpi.PROYECTO,
      },
      include: { umbrales: true },
      orderBy: { id: 'asc' },
    });

    const todosKpisProyecto = await contexto.tx.kpiDefinicion.findMany({
      where: {
        ambito: { in: [AmbitoKpi.PROYECTO, AmbitoKpi.HITO] },
      },
      select: { id: true },
    });
    const idsKpiReconciliar = todosKpisProyecto.map((k) => k.id);

    const origenBase =
      datosVariables.versionLineaBase !== null
        ? `corte=${corte};base=LB${datosVariables.versionLineaBase}`
        : `corte=${corte};base=PLAN_ACTUAL`;

    await this.registrarMediciones(
      contexto.tx,
      proyectoId,
      kpisActivos,
      resultadoVariables.valores,
      origenBase,
      idsKpiReconciliar,
    );

    await this.medirAmbitoCambio(contexto.tx, contexto.proyecto, contexto.calendario);
  }

  async medirAmbitoCambio(
    tx: Prisma.TransactionClient,
    proyectoOId: number | { id: number; estado?: EstadoProyecto },
    calendarioExistente?: CalendarioLaboral,
  ): Promise<void> {
    const proyectoId = typeof proyectoOId === 'number' ? proyectoOId : proyectoOId.id;
    let estado = typeof proyectoOId === 'object' ? proyectoOId.estado : undefined;
    if (estado === undefined) {
      const p = await tx.proyecto.findUnique({
        where: { id: proyectoId },
        select: { estado: true },
      });
      estado = p?.estado;
    }
    if (estado === EstadoProyecto.CERRADO) return;

    await tx.$executeRaw`SELECT pg_advisory_xact_lock(1401)`;

    const corte = this.reloj.hoy();
    const calendario = calendarioExistente ?? (await cargarCalendarioLaboral(tx, proyectoId));
    const datosCambio = await cargarDatosVariablesCambio(tx, proyectoId, calendario, corte);
    const valores = calcularVariablesCambio(datosCambio);

    const kpisActivos = await tx.kpiDefinicion.findMany({
      where: {
        activo: true,
        ambito: AmbitoKpi.CAMBIO,
      },
      include: { umbrales: true },
      orderBy: { id: 'asc' },
    });

    const todosKpisCambio = await tx.kpiDefinicion.findMany({
      where: {
        ambito: AmbitoKpi.CAMBIO,
      },
      select: { id: true },
    });
    const idsKpiReconciliar = todosKpisCambio.map((k) => k.id);

    await this.registrarMediciones(
      tx,
      proyectoId,
      kpisActivos,
      valores,
      `corte=${corte};ambito=CAMBIO`,
      idsKpiReconciliar,
    );

    const listaVencidas = etapasVencidas(datosCambio.solicitudes, corte);
    const alertasDeseadasVencidas = new Map<
      string,
      {
        etapaId: number;
        severidad: SeveridadAlerta;
        mensaje: string;
        detalle: object;
      }
    >();

    for (const v of listaVencidas) {
      const clave = `ETAPA_VENCIDA:${v.etapaId}`;
      const mensaje = `La etapa ${v.numero} de la solicitud ${v.codigo} está vencida (fin ${v.fechaFin}).`;
      const detalle = {
        solicitudId: v.solicitudId,
        codigo: v.codigo,
        numero: v.numero,
        fechaFin: v.fechaFin,
        corte,
      };
      alertasDeseadasVencidas.set(clave, {
        etapaId: v.etapaId,
        severidad: SeveridadAlerta.ADVERTENCIA,
        mensaje,
        detalle,
      });
    }

    const alertasVencidasActivas = await tx.alerta.findMany({
      where: {
        proyectoId,
        tipo: TipoAlerta.ETAPA_VENCIDA,
        activa: true,
      },
    });

    for (const [clave, des] of alertasDeseadasVencidas) {
      const existente = alertasVencidasActivas.find((a) => a.clave === clave);
      if (existente) {
        await tx.alerta.update({
          where: { id: existente.id },
          data: {
            severidad: des.severidad,
            mensaje: des.mensaje,
            detalle: des.detalle,
          },
        });
      } else {
        await tx.alerta.create({
          data: {
            proyectoId,
            tipo: TipoAlerta.ETAPA_VENCIDA,
            severidad: des.severidad,
            clave,
            mensaje: des.mensaje,
            detalle: des.detalle,
            entidad: 'EtapaCambio',
            entidadId: des.etapaId,
            activa: true,
          },
        });
      }
    }

    for (const a of alertasVencidasActivas) {
      if (!alertasDeseadasVencidas.has(a.clave)) {
        await tx.alerta.update({
          where: { id: a.id },
          data: {
            activa: false,
            cerradaEn: new Date(),
          },
        });
      }
    }
  }

  private async registrarMediciones(
    tx: Prisma.TransactionClient,
    proyectoId: number,
    kpis: Array<
      Prisma.KpiDefinicionGetPayload<{
        include: { umbrales: true };
      }>
    >,
    valores: Record<string, number | null>,
    origenDefault: string,
    idsKpiReconciliar: number[],
  ): Promise<void> {
    const cacheArboles = new Map<string, NodoFormula | null>();
    const corte = this.reloj.hoy();

    const alertasDeseadas = new Map<
      string,
      {
        kpiId: number;
        severidad: SeveridadAlerta;
        mensaje: string;
        detalle: object;
      }
    >();

    for (const kpi of kpis) {
      let arbol = cacheArboles.get(kpi.formula);
      if (arbol === undefined) {
        const codigosValidos = codigosVariablesPorAmbito(kpi.ambito);
        const analisis = analizarFormula(kpi.formula, codigosValidos);
        if (analisis.valida) {
          arbol = analisis.arbol;
          cacheArboles.set(kpi.formula, arbol);
        } else {
          arbol = null;
          cacheArboles.set(kpi.formula, null);
        }
      }

      let valor: number | null = null;
      let semaforo: ReturnType<typeof calcularSemaforo> = null;
      let origen = origenDefault;

      if (arbol !== null) {
        const raw = evaluarArbol(arbol, valores);
        valor = raw !== null ? redondear(raw, 4) : null;
        const verdeDb = kpi.umbrales.find((u) => u.semaforo === 'VERDE')?.valorDesde;
        const amarilloDb = kpi.umbrales.find((u) => u.semaforo === 'AMARILLO')?.valorDesde;
        const umbrales = {
          verde: verdeDb !== undefined ? Number(verdeDb) : null,
          amarillo: amarilloDb !== undefined ? Number(amarilloDb) : null,
        };
        semaforo = calcularSemaforo(valor, kpi.direccion, umbrales);
      } else {
        const codigosValidos = codigosVariablesPorAmbito(kpi.ambito);
        const analisis = analizarFormula(kpi.formula, codigosValidos);
        const errCod = !analisis.valida ? analisis.errores[0]?.codigo : 'FORMULA_INVALIDA';
        origen = `error=${errCod ?? 'FORMULA_INVALIDA'}`;
      }

      await tx.kpiMedicion.create({
        data: {
          kpiId: kpi.id,
          proyectoId,
          valor: valor !== null ? new Prisma.Decimal(valor) : null,
          semaforo,
          origen,
        },
      });

      if (semaforo === 'AMARILLO' || semaforo === 'ROJO') {
        const clave = `KPI:${kpi.id}`;
        const severidad =
          semaforo === 'AMARILLO' ? SeveridadAlerta.ADVERTENCIA : SeveridadAlerta.CRITICA;
        const valorFmt = valor !== null ? valor.toString() : 'N/D';
        const colorTexto = semaforo === 'AMARILLO' ? 'amarillo' : 'rojo';
        const mensaje = `El indicador ${kpi.codigo} está en ${colorTexto} (${valorFmt}).`;
        const detalle = {
          kpiId: kpi.id,
          codigo: kpi.codigo,
          nombre: kpi.nombre,
          valor,
          semaforo,
          corte,
        };
        alertasDeseadas.set(clave, { kpiId: kpi.id, severidad, mensaje, detalle });
      }
    }

    const alertasKpiActivas = await tx.alerta.findMany({
      where: {
        proyectoId,
        tipo: TipoAlerta.KPI,
        activa: true,
        entidadId: { in: idsKpiReconciliar },
      },
    });

    for (const [clave, des] of alertasDeseadas) {
      const existente = alertasKpiActivas.find((a) => a.clave === clave);
      if (existente) {
        await tx.alerta.update({
          where: { id: existente.id },
          data: {
            severidad: des.severidad,
            mensaje: des.mensaje,
            detalle: des.detalle,
          },
        });
      } else {
        await tx.alerta.create({
          data: {
            proyectoId,
            tipo: TipoAlerta.KPI,
            severidad: des.severidad,
            clave,
            mensaje: des.mensaje,
            detalle: des.detalle,
            entidad: 'KpiDefinicion',
            entidadId: des.kpiId,
            activa: true,
          },
        });
      }
    }

    for (const a of alertasKpiActivas) {
      if (!alertasDeseadas.has(a.clave)) {
        await tx.alerta.update({
          where: { id: a.id },
          data: {
            activa: false,
            cerradaEn: new Date(),
          },
        });
      }
    }
  }
}
