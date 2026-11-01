import { HttpStatus, Injectable } from '@nestjs/common';
import {
  AccionBitacora,
  AmbitoKpi,
  Prisma,
  type KpiDefinicion,
  type KpiUmbral,
} from '@prisma/client';
import {
  calcularVariablesCambio,
  calcularVariablesKpi,
  codigosVariablesPorAmbito,
  redondear,
  validarUmbrales,
  VARIABLES_KPI,
  type ActualizarKpi,
  type CrearKpi,
  type DireccionKpi,
  type KpiDetalleRespuesta,
  type KpiMedicionRespuesta,
  type KpiProyectoResumen,
  type ResultadoVariablesKpi,
  type Rol,
  type ValidarFormulaDto,
} from '@autofix/core';
import { analizarFormula, evaluarArbol } from '@autofix/core/formulas';
import { cargarCalendarioLaboral } from '../calendario/calendario-laboral';
import { BitacoraService } from '../comun/bitacora/bitacora.service';
import { CambioCampo } from '../comun/bitacora/diferencias';
import { ExcepcionApi } from '../comun/errores/excepcion-api';
import { Reloj } from '../comun/reloj/reloj';
import { PrismaService } from '../prisma/prisma.service';
import { cargarDatosVariablesKpi } from './datos-variables-kpi';
import { cargarDatosVariablesCambio } from './datos-variables-cambio';

function mapearKpiDetalle(kpi: KpiDefinicion & { umbrales: KpiUmbral[] }): KpiDetalleRespuesta {
  const verde = kpi.umbrales.find((u) => u.semaforo === 'VERDE')?.valorDesde;
  const amarillo = kpi.umbrales.find((u) => u.semaforo === 'AMARILLO')?.valorDesde;
  return {
    id: kpi.id,
    codigo: kpi.codigo,
    nombre: kpi.nombre,
    descripcion: kpi.descripcion,
    ambito: kpi.ambito,
    formula: kpi.formula,
    unidad: kpi.unidad,
    meta: kpi.meta !== null ? Number(kpi.meta) : null,
    direccion: kpi.direccion,
    esAdicional: kpi.esAdicional,
    activo: kpi.activo,
    umbrales: {
      verde: verde !== undefined ? Number(verde) : null,
      amarillo: amarillo !== undefined ? Number(amarillo) : null,
    },
  };
}

@Injectable()
export class KpiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bitacora: BitacoraService,
    private readonly reloj: Reloj,
  ) {}

  async obtenerVariables(
    proyectoId?: number,
    fechaCorte?: string,
  ): Promise<{
    fechaCorte: string;
    origen: string;
    variables: ResultadoVariablesKpi['variables'];
  }> {
    const corte = fechaCorte ?? this.reloj.hoy();
    if (!proyectoId) {
      return {
        fechaCorte: corte,
        origen: 'CATALOGO',
        variables: VARIABLES_KPI.map((v) => ({ ...v, valor: null })),
      };
    }

    const calculadas = await this.calcularVariablesDeProyecto(proyectoId, corte);
    return {
      fechaCorte: calculadas.corte,
      origen: calculadas.origen,
      variables: calculadas.variables,
    };
  }

  async listar(): Promise<KpiDetalleRespuesta[]> {
    const kpis = await this.prisma.kpiDefinicion.findMany({
      include: { umbrales: true },
      orderBy: [{ activo: 'desc' }, { codigo: 'asc' }],
    });
    return kpis.map(mapearKpiDetalle);
  }

  async crear(datos: CrearKpi, rol: Rol): Promise<KpiDetalleRespuesta> {
    const codigosValidos = codigosVariablesPorAmbito(datos.ambito);
    const analisis = analizarFormula(datos.formula, codigosValidos);
    if (!analisis.valida) {
      throw new ExcepcionApi(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'FORMULA_INVALIDA',
        'La fórmula de cálculo no es válida.',
        analisis.errores,
      );
    }

    const existente = await this.prisma.kpiDefinicion.findUnique({
      where: { codigo: datos.codigo },
    });
    if (existente) {
      throw new ExcepcionApi(
        HttpStatus.CONFLICT,
        'KPI_CODIGO_DUPLICADO',
        `Ya existe un KPI con el código ${datos.codigo}.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const creado = await tx.kpiDefinicion.create({
        data: {
          codigo: datos.codigo,
          nombre: datos.nombre,
          descripcion: datos.descripcion ?? null,
          ambito: datos.ambito,
          formula: datos.formula,
          unidad: datos.unidad,
          meta:
            datos.meta !== undefined && datos.meta !== null ? new Prisma.Decimal(datos.meta) : null,
          direccion: datos.direccion,
          esAdicional: datos.esAdicional ?? false,
          activo: datos.activo ?? true,
          umbrales: {
            create: [
              ...(datos.umbrales?.verde !== null && datos.umbrales?.verde !== undefined
                ? [
                    {
                      semaforo: 'VERDE' as const,
                      valorDesde: new Prisma.Decimal(datos.umbrales.verde),
                    },
                  ]
                : []),
              ...(datos.umbrales?.amarillo !== null && datos.umbrales?.amarillo !== undefined
                ? [
                    {
                      semaforo: 'AMARILLO' as const,
                      valorDesde: new Prisma.Decimal(datos.umbrales.amarillo),
                    },
                  ]
                : []),
            ],
          },
        },
        include: { umbrales: true },
      });

      await this.bitacora.registrarCreacion(
        tx,
        { proyectoId: null, entidad: 'KpiDefinicion', entidadId: creado.id, rol },
        { codigo: creado.codigo, nombre: creado.nombre, formula: creado.formula },
      );

      return mapearKpiDetalle(creado);
    });
  }

  async actualizar(id: number, datos: ActualizarKpi, rol: Rol): Promise<KpiDetalleRespuesta> {
    const actual = await this.prisma.kpiDefinicion.findUnique({
      where: { id },
      include: { umbrales: true },
    });
    if (!actual) {
      throw new ExcepcionApi(
        HttpStatus.NOT_FOUND,
        'KPI_NO_ENCONTRADO',
        'El KPI solicitado no existe.',
      );
    }

    const direccionFinal = (datos.direccion ?? actual.direccion) as DireccionKpi;
    const umbralesFinales =
      datos.umbrales === undefined
        ? mapearKpiDetalle(actual).umbrales
        : (datos.umbrales ?? { verde: null, amarillo: null });
    const errorUmbrales = validarUmbrales(direccionFinal, umbralesFinales);
    if (errorUmbrales !== null) {
      throw new ExcepcionApi(HttpStatus.UNPROCESSABLE_ENTITY, 'UMBRALES_INVALIDOS', errorUmbrales);
    }

    const ambitoEfectivo = (datos.ambito ?? actual.ambito) as AmbitoKpi;
    const formulaEfectiva = datos.formula ?? actual.formula;

    if (datos.formula !== undefined || datos.ambito !== undefined) {
      const codigosValidos = codigosVariablesPorAmbito(ambitoEfectivo);
      const analisis = analizarFormula(formulaEfectiva, codigosValidos);
      if (!analisis.valida) {
        throw new ExcepcionApi(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'FORMULA_INVALIDA',
          'La fórmula de cálculo no es válida.',
          analisis.errores,
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const cambios: CambioCampo[] = [];
      if (datos.formula !== undefined && datos.formula !== actual.formula) {
        cambios.push({ campo: 'formula', anterior: actual.formula, nuevo: datos.formula });
      }
      if (datos.activo !== undefined && datos.activo !== actual.activo) {
        cambios.push({ campo: 'activo', anterior: actual.activo, nuevo: datos.activo });
      }
      if (datos.nombre !== undefined && datos.nombre !== actual.nombre) {
        cambios.push({ campo: 'nombre', anterior: actual.nombre, nuevo: datos.nombre });
      }
      if (datos.direccion !== undefined && datos.direccion !== actual.direccion) {
        cambios.push({ campo: 'direccion', anterior: actual.direccion, nuevo: datos.direccion });
      }
      if (datos.ambito !== undefined && datos.ambito !== actual.ambito) {
        cambios.push({ campo: 'ambito', anterior: actual.ambito, nuevo: datos.ambito });
      }
      if (datos.meta !== undefined) {
        const metaActual = actual.meta !== null ? Number(actual.meta) : null;
        if (datos.meta !== metaActual) {
          cambios.push({ campo: 'meta', anterior: metaActual, nuevo: datos.meta });
        }
      }
      if (datos.umbrales !== undefined) {
        const umbralesAnteriores = mapearKpiDetalle(actual).umbrales;
        cambios.push({
          campo: 'umbrales',
          anterior: JSON.stringify(umbralesAnteriores),
          nuevo: JSON.stringify(datos.umbrales),
        });
      }

      if (datos.umbrales !== undefined) {
        await tx.kpiUmbral.deleteMany({ where: { kpiId: id } });
        if (datos.umbrales !== null) {
          const nuevosUmbrales = [];
          if (datos.umbrales.verde !== null && datos.umbrales.verde !== undefined) {
            nuevosUmbrales.push({
              kpiId: id,
              semaforo: 'VERDE' as const,
              valorDesde: new Prisma.Decimal(datos.umbrales.verde),
            });
          }
          if (datos.umbrales.amarillo !== null && datos.umbrales.amarillo !== undefined) {
            nuevosUmbrales.push({
              kpiId: id,
              semaforo: 'AMARILLO' as const,
              valorDesde: new Prisma.Decimal(datos.umbrales.amarillo),
            });
          }
          if (nuevosUmbrales.length > 0) {
            await tx.kpiUmbral.createMany({ data: nuevosUmbrales });
          }
        }
      }

      const actualizado = await tx.kpiDefinicion.update({
        where: { id },
        data: {
          nombre: datos.nombre,
          descripcion: datos.descripcion,
          ambito: datos.ambito,
          formula: datos.formula,
          unidad: datos.unidad,
          meta:
            datos.meta !== undefined
              ? datos.meta !== null
                ? new Prisma.Decimal(datos.meta)
                : null
              : undefined,
          direccion: datos.direccion,
          esAdicional: datos.esAdicional,
          activo: datos.activo,
        },
        include: { umbrales: true },
      });

      if (cambios.length > 0) {
        await this.bitacora.registrarCambios(
          tx,
          { proyectoId: null, entidad: 'KpiDefinicion', entidadId: id, rol },
          AccionBitacora.ACTUALIZAR,
          cambios,
        );
      }

      return mapearKpiDetalle(actualizado);
    });
  }

  async eliminar(id: number, rol: Rol): Promise<void> {
    const kpi = await this.prisma.kpiDefinicion.findUnique({
      where: { id },
    });
    if (!kpi) {
      throw new ExcepcionApi(
        HttpStatus.NOT_FOUND,
        'KPI_NO_ENCONTRADO',
        'El KPI solicitado no existe.',
      );
    }

    const totalMediciones = await this.prisma.kpiMedicion.count({
      where: { kpiId: id },
    });
    if (totalMediciones > 0) {
      throw new ExcepcionApi(
        HttpStatus.CONFLICT,
        'KPI_CON_MEDICIONES',
        'No se puede eliminar un KPI con mediciones registradas. Desactívelo en su lugar.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.kpiDefinicion.delete({ where: { id } });
      await this.bitacora.registrarEliminacion(
        tx,
        { proyectoId: null, entidad: 'KpiDefinicion', entidadId: id, rol },
        { codigo: kpi.codigo, nombre: kpi.nombre },
      );
    });
  }

  async validarFormula(datos: ValidarFormulaDto): Promise<{
    valida: boolean;
    valor: number | null;
    variables: string[];
    errores: unknown[];
  }> {
    const ambitoEfectivo = (datos.ambito ?? AmbitoKpi.PROYECTO) as AmbitoKpi;
    const codigosValidos = codigosVariablesPorAmbito(ambitoEfectivo);
    const analisis = analizarFormula(datos.formula, codigosValidos);
    if (!analisis.valida) {
      return {
        valida: false,
        valor: null,
        variables: [],
        errores: analisis.errores,
      };
    }

    if (!datos.proyectoId) {
      const raw = analisis.variables.length === 0 ? evaluarArbol(analisis.arbol, {}) : null;
      return {
        valida: true,
        valor: raw !== null ? redondear(raw, 4) : null,
        variables: analisis.variables,
        errores: [],
      };
    }

    const corte = datos.fechaCorte ?? this.reloj.hoy();
    let valores: Record<string, number | null>;
    if (ambitoEfectivo === AmbitoKpi.CAMBIO) {
      const calendario = await cargarCalendarioLaboral(this.prisma, datos.proyectoId);
      const datosCambio = await cargarDatosVariablesCambio(
        this.prisma,
        datos.proyectoId,
        calendario,
        corte,
      );
      valores = calcularVariablesCambio(datosCambio);
    } else {
      const variablesCalculadas = await this.calcularVariablesDeProyecto(datos.proyectoId, corte);
      valores = variablesCalculadas.valores;
    }

    const raw = evaluarArbol(analisis.arbol, valores);
    return {
      valida: true,
      valor: raw !== null ? redondear(raw, 4) : null,
      variables: analisis.variables,
      errores: [],
    };
  }

  async listarPorProyecto(
    proyectoId: number,
    ambito: AmbitoKpi = AmbitoKpi.PROYECTO,
  ): Promise<KpiProyectoResumen[]> {
    const kpisActivos = await this.prisma.kpiDefinicion.findMany({
      where: { activo: true, ambito },
      include: { umbrales: true },
      orderBy: { codigo: 'asc' },
    });

    const resumenes: KpiProyectoResumen[] = [];
    for (const kpi of kpisActivos) {
      const ultima = await this.prisma.kpiMedicion.findFirst({
        where: { kpiId: kpi.id, proyectoId },
        orderBy: { medidoEn: 'desc' },
      });
      const detalle = mapearKpiDetalle(kpi);
      resumenes.push({
        kpiId: kpi.id,
        codigo: kpi.codigo,
        nombre: kpi.nombre,
        descripcion: kpi.descripcion,
        ambito: kpi.ambito,
        unidad: kpi.unidad,
        meta: detalle.meta,
        direccion: kpi.direccion,
        valor: ultima?.valor !== null && ultima?.valor !== undefined ? Number(ultima.valor) : null,
        semaforo: ultima?.semaforo ?? null,
        medidoEn: ultima?.medidoEn ? ultima.medidoEn.toISOString() : null,
        origen: ultima?.origen ?? null,
        umbrales: detalle.umbrales,
      });
    }

    return resumenes;
  }

  async listarMediciones(
    proyectoId: number,
    kpiId: number,
    limite = 100,
  ): Promise<KpiMedicionRespuesta[]> {
    const cant = Math.min(Math.max(1, limite), 500);
    const mediciones = await this.prisma.kpiMedicion.findMany({
      where: { proyectoId, kpiId },
      orderBy: [{ medidoEn: 'desc' }, { id: 'desc' }],
      take: cant,
    });
    return mediciones.reverse().map((m) => ({
      id: m.id,
      kpiId: m.kpiId,
      proyectoId: m.proyectoId,
      hitoId: m.hitoId,
      valor: m.valor !== null ? Number(m.valor) : null,
      semaforo: m.semaforo,
      origen: m.origen,
      medidoEn: m.medidoEn.toISOString(),
    }));
  }

  private async calcularVariablesDeProyecto(
    proyectoId: number,
    corte: string,
  ): Promise<ResultadoVariablesKpi> {
    const proyecto = await this.prisma.proyecto.findUnique({
      where: { id: proyectoId },
    });
    if (!proyecto) {
      throw new ExcepcionApi(
        HttpStatus.NOT_FOUND,
        'RECURSO_NO_ENCONTRADO',
        'El proyecto solicitado no existe.',
      );
    }

    const calendario = await cargarCalendarioLaboral(this.prisma, proyectoId);
    const datosVariables = await cargarDatosVariablesKpi(
      this.prisma,
      proyectoId,
      calendario,
      corte,
    );
    return calcularVariablesKpi(datosVariables);
  }
}
