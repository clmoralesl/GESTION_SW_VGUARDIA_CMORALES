import { Injectable } from '@nestjs/common';
import { AmbitoKpi, EstadoProyecto, Prisma, SeveridadAlerta, TipoAlerta } from '@prisma/client';
import {
  calcularSemaforo,
  calcularVariablesKpi,
  CODIGOS_VARIABLES_KPI,
  redondear,
} from '@autofix/core';
import { analizarFormula, evaluarArbol, type NodoFormula } from '@autofix/core/formulas';
import { Reloj } from '../comun/reloj/reloj';
import { cargarDatosVariablesKpi } from '../kpi/datos-variables-kpi';
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

    const cacheArboles = new Map<string, NodoFormula | null>();
    const origenBase =
      datosVariables.versionLineaBase !== null
        ? `corte=${corte};base=LB${datosVariables.versionLineaBase}`
        : `corte=${corte};base=PLAN_ACTUAL`;

    const alertasDeseadas = new Map<
      string,
      {
        kpiId: number;
        severidad: SeveridadAlerta;
        mensaje: string;
        detalle: object;
      }
    >();

    for (const kpi of kpisActivos) {
      let arbol = cacheArboles.get(kpi.formula);
      if (arbol === undefined) {
        const analisis = analizarFormula(kpi.formula, CODIGOS_VARIABLES_KPI);
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
      let origen = origenBase;

      if (arbol !== null) {
        const raw = evaluarArbol(arbol, resultadoVariables.valores);
        valor = raw !== null ? redondear(raw, 4) : null;
        const verdeDb = kpi.umbrales.find((u) => u.semaforo === 'VERDE')?.valorDesde;
        const amarilloDb = kpi.umbrales.find((u) => u.semaforo === 'AMARILLO')?.valorDesde;
        const umbrales = {
          verde: verdeDb !== undefined ? Number(verdeDb) : null,
          amarillo: amarilloDb !== undefined ? Number(amarilloDb) : null,
        };
        semaforo = calcularSemaforo(valor, kpi.direccion, umbrales);
      } else {
        const analisis = analizarFormula(kpi.formula, CODIGOS_VARIABLES_KPI);
        const errCod = !analisis.valida ? analisis.errores[0]?.codigo : 'FORMULA_INVALIDA';
        origen = `error=${errCod ?? 'FORMULA_INVALIDA'}`;
      }

      await contexto.tx.kpiMedicion.create({
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

    const alertasKpiActivas = await contexto.tx.alerta.findMany({
      where: {
        proyectoId,
        tipo: TipoAlerta.KPI,
        activa: true,
      },
    });

    for (const [clave, des] of alertasDeseadas) {
      const existente = alertasKpiActivas.find((a) => a.clave === clave);
      if (existente) {
        await contexto.tx.alerta.update({
          where: { id: existente.id },
          data: {
            severidad: des.severidad,
            mensaje: des.mensaje,
            detalle: des.detalle,
          },
        });
      } else {
        await contexto.tx.alerta.create({
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
        await contexto.tx.alerta.update({
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
