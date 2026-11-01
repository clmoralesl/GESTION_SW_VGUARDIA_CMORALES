import { HttpStatus, Injectable } from '@nestjs/common';
import {
  AmbitoKpi,
  CategoriaCambio,
  DireccionKpi,
  EstadoProyecto,
  EstadoSolicitud,
  EstadoEtapa,
  NivelTarea,
  Prioridad,
  TipoDependencia,
  UnidadKpi,
} from '@prisma/client';
import {
  claveNombre,
  codigoDesdeCelda,
  normalizarFechaCelda,
  siguienteCodigo,
  validarLibro,
  NOMBRES_ETAPAS,
  type Rol,
  type ResultadoValidacionLibro,
} from '@autofix/core';
import { ExcepcionApi } from '../comun/errores/excepcion-api';
import { PrismaService } from '../prisma/prisma.service';
import { Reloj } from '../comun/reloj/reloj';
import { RecalculoService } from '../recalculo/recalculo.service';
import { obtenerProyectoAbierto } from '../proyectos/proyecto-abierto';
import {
  esXlsx,
  generarExportacion,
  generarPlantilla,
  leerLibro,
  type DatosExportacion,
  type FilaExportacionAsignacion,
  type FilaExportacionDependencia,
  type FilaExportacionHito,
  type FilaExportacionKpi,
  type FilaExportacionProfesional,
  type FilaExportacionRecurso,
  type FilaExportacionSolicitud,
  type FilaExportacionTarea,
} from './libro-excel';

export interface ArchivoEntrada {
  originalname: string;
  buffer: Buffer;
  size?: number;
}

export interface ResultadoVistaPrevia extends ResultadoValidacionLibro {
  destino: {
    proyectoId: number | null;
    tieneDatos: boolean;
  };
}

export interface ResultadoConfirmacionImportacion {
  proyectoId: number;
  conteos: {
    tareas: number;
    dependencias: number;
    asignaciones: number;
    hitos: number;
    solicitudes: number;
  };
}

@Injectable()
export class ImportacionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recalculo: RecalculoService,
    private readonly reloj: Reloj,
  ) {}

  async obtenerPlantilla(): Promise<Buffer> {
    return generarPlantilla();
  }

  async exportarProyecto(proyectoId: number): Promise<{ buffer: Buffer; nombreArchivo: string }> {
    const proyecto = await this.prisma.proyecto.findUnique({
      where: { id: proyectoId },
      include: {
        calendario: {
          include: {
            feriados: { orderBy: { fecha: 'asc' } },
          },
        },
        tareas: {
          include: {
            asignaciones: {
              include: {
                profesional: true,
                recurso: true,
              },
            },
          },
        },
        dependencias: {
          include: {
            predecesora: true,
            sucesora: true,
          },
        },
        hitos: {
          include: {
            tarea: true,
          },
        },
        solicitudes: {
          orderBy: { codigo: 'asc' },
        },
      },
    });

    if (!proyecto) {
      throw new ExcepcionApi(
        HttpStatus.NOT_FOUND,
        'REGISTRO_NO_ENCONTRADO',
        'El proyecto no existe.',
      );
    }

    const profesionalesDb = await this.prisma.profesional.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
    });

    const recursosDb = await this.prisma.recurso.findMany({
      where: { activo: true },
      include: { tipoRecurso: true },
      orderBy: { nombre: 'asc' },
    });

    const kpisDb = await this.prisma.kpiDefinicion.findMany({
      where: { activo: true },
      orderBy: { codigo: 'asc' },
    });

    const tareasExport: FilaExportacionTarea[] = proyecto.tareas.map((t) => ({
      codigo: t.codigo,
      nivel: t.nivel,
      nombre: t.nombre,
      duracionDias: t.duracionDias,
      descripcion: t.descripcion,
      responsable: t.responsable,
      fechaFija: t.fechaFija ? t.fechaFija.toISOString().slice(0, 10) : null,
      porcentajeAvance: t.porcentajeAvance ? Number(t.porcentajeAvance) : 0,
      inicioReal: t.inicioReal ? t.inicioReal.toISOString().slice(0, 10) : null,
      finReal: t.finReal ? t.finReal.toISOString().slice(0, 10) : null,
      inicioPlan: t.inicioPlan ? t.inicioPlan.toISOString().slice(0, 10) : null,
      finPlan: t.finPlan ? t.finPlan.toISOString().slice(0, 10) : null,
      holguraDias: t.holguraDias,
      esCritica: t.esCritica,
      costoPlan: t.costoPlan ? Number(t.costoPlan) : 0,
    }));

    const dependenciasExport: FilaExportacionDependencia[] = proyecto.dependencias.map((d) => ({
      predecesora: d.predecesora.codigo,
      sucesora: d.sucesora.codigo,
      tipo: d.tipo,
      desfaseDias: d.desfaseDias,
    }));

    const asignacionesExport: FilaExportacionAsignacion[] = [];
    for (const t of proyecto.tareas) {
      for (const a of t.asignaciones) {
        asignacionesExport.push({
          tarea: t.codigo,
          profesional: a.profesional?.nombre ?? null,
          recurso: a.recurso?.nombre ?? null,
          dedicacion: a.dedicacion ? Number(a.dedicacion) : null,
          horasPlan: a.horasPlan ? Number(a.horasPlan) : null,
          horasPlanManual: a.horasPlanManual,
          horasReales: a.horasReales ? Number(a.horasReales) : null,
          cantidadPlan: a.cantidadPlan ? Number(a.cantidadPlan) : null,
          cantidadReal: a.cantidadReal ? Number(a.cantidadReal) : null,
          tarifaAplicada: a.tarifaAplicada ? Number(a.tarifaAplicada) : null,
          costoUnitarioAplicado: a.costoUnitarioAplicado ? Number(a.costoUnitarioAplicado) : null,
        });
      }
    }

    const hitosExport: FilaExportacionHito[] = proyecto.hitos.map((h) => ({
      nombre: h.nombre,
      fechaObjetivo: h.fechaObjetivo.toISOString().slice(0, 10),
      tarea: h.tarea?.codigo ?? null,
      criterio: h.criterio,
      responsable: h.responsable,
      fechaCumplimiento: h.fechaCumplimiento
        ? h.fechaCumplimiento.toISOString().slice(0, 10)
        : null,
    }));

    const profesionalesExport: FilaExportacionProfesional[] = profesionalesDb.map((p) => ({
      nombre: p.nombre,
      cargo: p.cargo,
      tarifaHora: Number(p.tarifaHora),
      horasDiarias: p.horasDiarias ? Number(p.horasDiarias) : 8,
    }));

    const recursosExport: FilaExportacionRecurso[] = recursosDb.map((r) => ({
      nombre: r.nombre,
      tipo: r.tipoRecurso.nombre,
      unidad: r.unidad,
      costoUnitario: Number(r.costoUnitario),
    }));

    const kpisExport: FilaExportacionKpi[] = kpisDb.map((k) => ({
      codigo: k.codigo,
      nombre: k.nombre,
      ambito: k.ambito,
      formula: k.formula,
      unidad: k.unidad,
      meta: k.meta ? Number(k.meta) : null,
      direccion: k.direccion,
    }));

    const solicitudesExport: FilaExportacionSolicitud[] = proyecto.solicitudes.map((s) => ({
      codigo: s.codigo,
      titulo: s.titulo,
      descripcion: s.descripcion,
      justificacion: s.justificacion,
      solicitante: s.solicitante,
      responsable: s.responsable,
      prioridad: s.prioridad,
      categoria: s.categoria,
      probabilidadRiesgo: s.probabilidadRiesgo,
      impactoRiesgo: s.impactoRiesgo,
      estado: s.estado,
      etapaActual: s.etapaActual,
    }));

    const datos: DatosExportacion = {
      proyecto: {
        nombre: proyecto.nombre,
        descripcion: proyecto.descripcion,
        responsable: proyecto.responsable,
        presupuesto: Number(proyecto.presupuesto),
        fechaInicio: proyecto.fechaInicio.toISOString().slice(0, 10),
        fechaFin: proyecto.fechaFin ? proyecto.fechaFin.toISOString().slice(0, 10) : null,
      },
      calendario: {
        diasLaborables: (proyecto.calendario?.diasLaborables ?? [1, 2, 3, 4, 5]).join(','),
        horasPorDia: Number(proyecto.calendario?.horasPorDia ?? 8),
      },
      feriados: (proyecto.calendario?.feriados ?? []).map((f) => ({
        fecha: f.fecha.toISOString().slice(0, 10),
        descripcion: f.descripcion,
      })),
      tareas: tareasExport,
      dependencias: dependenciasExport,
      profesionales: profesionalesExport,
      recursos: recursosExport,
      asignaciones: asignacionesExport,
      hitos: hitosExport,
      kpis: kpisExport,
      solicitudes: solicitudesExport,
    };

    const buffer = await generarExportacion(datos);
    const nombreArchivo = `proyecto_${proyectoId}_${this.reloj.hoy()}.xlsx`;
    return { buffer, nombreArchivo };
  }

  async vistaPrevia(
    archivo: ArchivoEntrada | undefined,
    proyectoId?: number,
  ): Promise<ResultadoVistaPrevia> {
    if (!archivo || !archivo.buffer) {
      throw new ExcepcionApi(
        HttpStatus.BAD_REQUEST,
        'SOLICITUD_INVALIDA',
        'Debe adjuntar un archivo para la vista previa.',
      );
    }

    if (!esXlsx(archivo.originalname, archivo.buffer)) {
      throw new ExcepcionApi(
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
        'TIPO_ARCHIVO_NO_PERMITIDO',
        'El archivo debe ser un libro Excel con extensión .xlsx válido.',
      );
    }

    let tieneDatos = false;
    if (proyectoId !== undefined && !isNaN(proyectoId)) {
      const proyectoDestino = await this.prisma.proyecto.findUnique({
        where: { id: proyectoId },
        select: {
          id: true,
          estado: true,
          _count: {
            select: {
              tareas: true,
              hitos: true,
              solicitudes: true,
              lineasBase: true,
            },
          },
        },
      });

      if (!proyectoDestino) {
        throw new ExcepcionApi(
          HttpStatus.NOT_FOUND,
          'REGISTRO_NO_ENCONTRADO',
          'El proyecto destino no existe.',
        );
      }

      if (proyectoDestino.estado === EstadoProyecto.CERRADO) {
        throw new ExcepcionApi(
          HttpStatus.CONFLICT,
          'PROYECTO_CERRADO',
          'El proyecto está cerrado y no admite modificaciones.',
        );
      }

      tieneDatos =
        proyectoDestino._count.tareas > 0 ||
        proyectoDestino._count.hitos > 0 ||
        proyectoDestino._count.solicitudes > 0 ||
        proyectoDestino._count.lineasBase > 0;
    }

    const { libro, ordenHojas, encabezadosPorHoja } = await leerLibro(archivo.buffer);

    const profesionalesDb = await this.prisma.profesional.findMany({
      select: { id: true, nombre: true, tarifaHora: true, activo: true },
    });

    const recursosDb = await this.prisma.recurso.findMany({
      select: { id: true, nombre: true, costoUnitario: true, activo: true },
    });

    const kpisDb = await this.prisma.kpiDefinicion.findMany({
      where: { activo: true },
      select: { id: true, codigo: true, nombre: true },
    });

    const catalogo = {
      profesionales: profesionalesDb.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        tarifaHora: Number(p.tarifaHora),
        activo: p.activo,
      })),
      recursos: recursosDb.map((r) => ({
        id: r.id,
        nombre: r.nombre,
        costoUnitario: Number(r.costoUnitario),
        activo: r.activo,
      })),
      kpis: kpisDb,
    };

    const resultado = validarLibro(libro, {
      catalogo,
      ordenHojas,
      encabezadosPorHoja,
    });

    return {
      valido: resultado.valido,
      hojas: resultado.hojas,
      errores: resultado.errores,
      advertencias: resultado.advertencias,
      truncado: resultado.truncado,
      destino: {
        proyectoId: proyectoId ?? null,
        tieneDatos,
      },
    };
  }

  async confirmar(
    archivo: ArchivoEntrada | undefined,
    proyectoId?: number,
    reemplazar?: boolean,
    rol?: Rol,
  ): Promise<ResultadoConfirmacionImportacion> {
    if (!archivo || !archivo.buffer) {
      throw new ExcepcionApi(
        HttpStatus.BAD_REQUEST,
        'SOLICITUD_INVALIDA',
        'Debe adjuntar un archivo para confirmar la importación.',
      );
    }

    if (!esXlsx(archivo.originalname, archivo.buffer)) {
      throw new ExcepcionApi(
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
        'TIPO_ARCHIVO_NO_PERMITIDO',
        'El archivo debe ser un libro Excel con extensión .xlsx válido.',
      );
    }

    const { libro, ordenHojas, encabezadosPorHoja } = await leerLibro(archivo.buffer);

    const profesionalesDb = await this.prisma.profesional.findMany({
      select: { id: true, nombre: true, tarifaHora: true, activo: true },
    });

    const recursosDb = await this.prisma.recurso.findMany({
      select: { id: true, nombre: true, costoUnitario: true, activo: true },
    });

    const kpisDb = await this.prisma.kpiDefinicion.findMany({
      where: { activo: true },
      select: { id: true, codigo: true, nombre: true },
    });

    const catalogo = {
      profesionales: profesionalesDb.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        tarifaHora: Number(p.tarifaHora),
        activo: p.activo,
      })),
      recursos: recursosDb.map((r) => ({
        id: r.id,
        nombre: r.nombre,
        costoUnitario: Number(r.costoUnitario),
        activo: r.activo,
      })),
      kpis: kpisDb,
    };

    const resultado = validarLibro(libro, {
      catalogo,
      ordenHojas,
      encabezadosPorHoja,
    });

    if (!resultado.valido) {
      throw new ExcepcionApi(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'IMPORTACION_INVALIDA',
        'El archivo contiene errores de validación.',
        resultado.errores,
      );
    }

    return this.prisma.$transaction(
      async (tx) => {
        let idDestino = proyectoId;

        if (idDestino !== undefined && !isNaN(idDestino)) {
          await obtenerProyectoAbierto(tx, idDestino, { bloquear: true });

          const conteoTareas = await tx.tarea.count({ where: { proyectoId: idDestino } });
          const conteoHitos = await tx.hito.count({ where: { proyectoId: idDestino } });
          const conteoSolicitudes = await tx.solicitudCambio.count({
            where: { proyectoId: idDestino },
          });
          const conteoLineasBase = await tx.lineaBase.count({
            where: { proyectoId: idDestino },
          });

          const tieneDatos =
            conteoTareas > 0 || conteoHitos > 0 || conteoSolicitudes > 0 || conteoLineasBase > 0;

          if (tieneDatos && !reemplazar) {
            throw new ExcepcionApi(
              HttpStatus.CONFLICT,
              'PROYECTO_CON_DATOS',
              'El proyecto destino contiene datos y no se especificó reemplazar=true.',
            );
          }

          if (tieneDatos && reemplazar) {
            await tx.solicitudCambio.deleteMany({ where: { proyectoId: idDestino } });
            await tx.lineaBase.deleteMany({ where: { proyectoId: idDestino } });
            await tx.kpiMedicion.deleteMany({ where: { proyectoId: idDestino } });
            await tx.alerta.deleteMany({ where: { proyectoId: idDestino } });
            await tx.hito.deleteMany({ where: { proyectoId: idDestino } });
            await tx.dependencia.deleteMany({ where: { proyectoId: idDestino } });
            await tx.asignacion.deleteMany({ where: { tarea: { proyectoId: idDestino } } });
            await tx.registroAvance.deleteMany({ where: { tarea: { proyectoId: idDestino } } });
            await tx.tarea.deleteMany({ where: { proyectoId: idDestino } });
            await tx.feriado.deleteMany({ where: { calendario: { proyectoId: idDestino } } });
          }

          const filaProy = libro.Proyecto![0]!;
          const fechaIni = normalizarFechaCelda(filaProy.fechaInicio)!;
          const fechaFin = normalizarFechaCelda(filaProy.fechaFin);

          await tx.proyecto.update({
            where: { id: idDestino },
            data: {
              nombre: String(filaProy.nombre).trim(),
              descripcion: filaProy.descripcion ? String(filaProy.descripcion).trim() : null,
              responsable: String(filaProy.responsable).trim(),
              presupuesto: Number(filaProy.presupuesto),
              fechaInicio: new Date(`${fechaIni}T00:00:00.000Z`),
              fechaFin: fechaFin ? new Date(`${fechaFin}T00:00:00.000Z`) : null,
            },
          });

          const filaCal = libro.Calendario![0]!;
          const diasLaborables = String(filaCal.diasLaborables)
            .split(',')
            .map((s) => Number(s.trim()));
          const horasPorDia = Number(filaCal.horasPorDia);

          let calDb = await tx.calendario.findUnique({ where: { proyectoId: idDestino } });
          if (!calDb) {
            calDb = await tx.calendario.create({
              data: { proyectoId: idDestino, diasLaborables, horasPorDia },
            });
          } else {
            calDb = await tx.calendario.update({
              where: { proyectoId: idDestino },
              data: { diasLaborables, horasPorDia },
            });
          }

          const feriadosFilas = libro.Feriados ?? [];
          if (feriadosFilas.length > 0) {
            await tx.feriado.createMany({
              data: feriadosFilas.map((f) => ({
                calendarioId: calDb!.id,
                fecha: new Date(`${normalizarFechaCelda(f.fecha)!}T00:00:00.000Z`),
                descripcion: String(f.descripcion).trim(),
              })),
            });
          }
        } else {
          const filaProy = libro.Proyecto![0]!;
          const fechaIni = normalizarFechaCelda(filaProy.fechaInicio)!;
          const fechaFin = normalizarFechaCelda(filaProy.fechaFin);

          const nuevoProyecto = await tx.proyecto.create({
            data: {
              nombre: String(filaProy.nombre).trim(),
              descripcion: filaProy.descripcion ? String(filaProy.descripcion).trim() : null,
              responsable: String(filaProy.responsable).trim(),
              presupuesto: Number(filaProy.presupuesto),
              fechaInicio: new Date(`${fechaIni}T00:00:00.000Z`),
              fechaFin: fechaFin ? new Date(`${fechaFin}T00:00:00.000Z`) : null,
              estado: EstadoProyecto.PLANIFICADO,
            },
          });

          idDestino = nuevoProyecto.id;

          const filaCal = libro.Calendario![0]!;
          const diasLaborables = String(filaCal.diasLaborables)
            .split(',')
            .map((s) => Number(s.trim()));
          const horasPorDia = Number(filaCal.horasPorDia);

          const calDb = await tx.calendario.create({
            data: { proyectoId: idDestino, diasLaborables, horasPorDia },
          });

          const feriadosFilas = libro.Feriados ?? [];
          if (feriadosFilas.length > 0) {
            await tx.feriado.createMany({
              data: feriadosFilas.map((f) => ({
                calendarioId: calDb.id,
                fecha: new Date(`${normalizarFechaCelda(f.fecha)!}T00:00:00.000Z`),
                descripcion: String(f.descripcion).trim(),
              })),
            });
          }
        }

        const profExistentes = await tx.profesional.findMany();
        const mapaProfPorClave = new Map(profExistentes.map((p) => [p.claveNombre, p]));
        const mapaProfPorNombre = new Map(profExistentes.map((p) => [p.nombre.toLowerCase(), p]));

        for (const filaProf of libro.Profesionales ?? []) {
          const nom = String(filaProf.nombre).trim();
          const cNom = claveNombre(nom);
          const nomLower = nom.toLowerCase();
          if (!mapaProfPorClave.has(cNom) && !mapaProfPorNombre.has(nomLower)) {
            const creado = await tx.profesional.create({
              data: {
                nombre: nom,
                claveNombre: cNom,
                cargo: String(filaProf.cargo).trim(),
                tarifaHora: Number(filaProf.tarifaHora),
                horasDiarias: filaProf.horasDiarias ? Number(filaProf.horasDiarias) : 8,
                activo: true,
              },
            });
            mapaProfPorClave.set(cNom, creado);
            mapaProfPorNombre.set(nomLower, creado);
          } else {
            const existente = mapaProfPorClave.get(cNom) ?? mapaProfPorNombre.get(nomLower);
            if (existente) {
              mapaProfPorClave.set(cNom, existente);
            }
          }
        }

        const tiposRecursoDb = await tx.tipoRecurso.findMany();
        const mapaTiposRecurso = new Map(
          tiposRecursoDb.map((tr) => [tr.nombre.toLowerCase(), tr.id]),
        );
        const recExistentes = await tx.recurso.findMany();
        const mapaRecPorClave = new Map(recExistentes.map((r) => [r.claveNombre, r]));
        const mapaRecPorNombre = new Map(recExistentes.map((r) => [r.nombre.toLowerCase(), r]));

        for (const filaRec of libro.Recursos ?? []) {
          const nom = String(filaRec.nombre).trim();
          const cNom = claveNombre(nom);
          const nomLower = nom.toLowerCase();
          if (!mapaRecPorClave.has(cNom) && !mapaRecPorNombre.has(nomLower)) {
            const tipoStr = String(filaRec.tipo).trim().toLowerCase();
            const tipoRecursoId = mapaTiposRecurso.get(tipoStr);
            if (!tipoRecursoId) {
              throw new ExcepcionApi(
                HttpStatus.UNPROCESSABLE_ENTITY,
                'IMPORTACION_INVALIDA',
                `El tipo de recurso '${filaRec.tipo}' no existe en el catálogo.`,
              );
            }
            const creado = await tx.recurso.create({
              data: {
                nombre: nom,
                claveNombre: cNom,
                tipoRecursoId,
                unidad: String(filaRec.unidad).trim(),
                costoUnitario: Number(filaRec.costoUnitario),
                activo: true,
              },
            });
            mapaRecPorClave.set(cNom, creado);
            mapaRecPorNombre.set(nomLower, creado);
          } else {
            const existente = mapaRecPorClave.get(cNom) ?? mapaRecPorNombre.get(nomLower);
            if (existente) {
              mapaRecPorClave.set(cNom, existente);
            }
          }
        }

        const mapaCodigoAId = new Map<string, number>();
        const tareasFilas = libro.Tareas ?? [];

        const tareasPorProfundidad: Array<Array<(typeof tareasFilas)[0]>> = [[], [], []];
        for (const t of tareasFilas) {
          const codigo = codigoDesdeCelda(t.codigo);
          const profundidad = codigo.split('.').length;
          const idx = Math.min(Math.max(profundidad, 1), 3) - 1;
          tareasPorProfundidad[idx]!.push(t);
        }

        for (let nivelIdx = 0; nivelIdx < 3; nivelIdx += 1) {
          const nivelFilas = tareasPorProfundidad[nivelIdx]!;
          for (const fila of nivelFilas) {
            const codigo = codigoDesdeCelda(fila.codigo);
            const partes = codigo.split('.');
            const orden = Number(partes[partes.length - 1]);
            const padreCodigo = partes.length > 1 ? partes.slice(0, -1).join('.') : null;
            const padreId = padreCodigo ? (mapaCodigoAId.get(padreCodigo) ?? null) : null;

            const fechaFija = fila.fechaFija ? normalizarFechaCelda(fila.fechaFija) : null;
            const inicioReal = fila.inicioReal ? normalizarFechaCelda(fila.inicioReal) : null;
            const finReal = fila.finReal ? normalizarFechaCelda(fila.finReal) : null;

            const tareaCreada = await tx.tarea.create({
              data: {
                proyectoId: idDestino!,
                padreId,
                nivel: String(fila.nivel).trim().toUpperCase() as NivelTarea,
                codigo,
                orden,
                nombre: String(fila.nombre).trim(),
                descripcion: fila.descripcion ? String(fila.descripcion).trim() : null,
                responsable: fila.responsable ? String(fila.responsable).trim() : null,
                duracionDias: Number(fila.duracionDias ?? 1),
                fechaFija: fechaFija ? new Date(`${fechaFija}T00:00:00.000Z`) : null,
                porcentajeAvance: fila.porcentajeAvance ? Number(fila.porcentajeAvance) : 0,
                inicioReal: inicioReal ? new Date(`${inicioReal}T00:00:00.000Z`) : null,
                finReal: finReal ? new Date(`${finReal}T00:00:00.000Z`) : null,
              },
            });
            mapaCodigoAId.set(codigo, tareaCreada.id);
          }
        }

        const dependenciasFilas = libro.Dependencias ?? [];
        if (dependenciasFilas.length > 0) {
          await tx.dependencia.createMany({
            data: dependenciasFilas.map((d) => ({
              proyectoId: idDestino!,
              predecesoraId: mapaCodigoAId.get(codigoDesdeCelda(d.predecesora))!,
              sucesoraId: mapaCodigoAId.get(codigoDesdeCelda(d.sucesora))!,
              tipo: (String(d.tipo).trim().toUpperCase() || 'FS') as TipoDependencia,
              desfaseDias: d.desfaseDias ? Number(d.desfaseDias) : 0,
            })),
          });
        }

        const asignacionesData = [];
        for (const filaAsig of libro.Asignaciones ?? []) {
          const codTarea = codigoDesdeCelda(filaAsig.tarea);
          const tareaId = mapaCodigoAId.get(codTarea)!;
          const nomProf = filaAsig.profesional ? String(filaAsig.profesional).trim() : null;
          const nomRec = filaAsig.recurso ? String(filaAsig.recurso).trim() : null;
          const prof = nomProf ? mapaProfPorClave.get(claveNombre(nomProf)) : null;
          const rec = nomRec ? mapaRecPorClave.get(claveNombre(nomRec)) : null;

          const horasPlan =
            filaAsig.horasPlan !== undefined &&
            filaAsig.horasPlan !== null &&
            String(filaAsig.horasPlan).trim() !== ''
              ? Number(filaAsig.horasPlan)
              : null;
          const horasPlanManual = horasPlan !== null;

          const tarifaAplicada =
            filaAsig.tarifaAplicada !== undefined &&
            filaAsig.tarifaAplicada !== null &&
            String(filaAsig.tarifaAplicada).trim() !== ''
              ? Number(filaAsig.tarifaAplicada)
              : prof
                ? Number(prof.tarifaHora)
                : null;

          const costoUnitarioAplicado =
            filaAsig.costoUnitarioAplicado !== undefined &&
            filaAsig.costoUnitarioAplicado !== null &&
            String(filaAsig.costoUnitarioAplicado).trim() !== ''
              ? Number(filaAsig.costoUnitarioAplicado)
              : rec
                ? Number(rec.costoUnitario)
                : null;

          asignacionesData.push({
            tareaId,
            profesionalId: prof?.id ?? null,
            recursoId: rec?.id ?? null,
            dedicacion: filaAsig.dedicacion ? Number(filaAsig.dedicacion) : prof ? 100 : null,
            horasPlan,
            horasPlanManual,
            horasReales: filaAsig.horasReales ? Number(filaAsig.horasReales) : null,
            cantidadPlan: filaAsig.cantidadPlan ? Number(filaAsig.cantidadPlan) : null,
            cantidadReal: filaAsig.cantidadReal ? Number(filaAsig.cantidadReal) : null,
            tarifaAplicada,
            costoUnitarioAplicado,
          });
        }

        if (asignacionesData.length > 0) {
          await tx.asignacion.createMany({ data: asignacionesData });
        }

        const hitosData = [];
        for (const filaHito of libro.Hitos ?? []) {
          const codTarea = filaHito.tarea ? codigoDesdeCelda(filaHito.tarea) : null;
          const tareaId = codTarea ? (mapaCodigoAId.get(codTarea) ?? null) : null;
          const fObj = normalizarFechaCelda(filaHito.fechaObjetivo)!;
          const fCum = filaHito.fechaCumplimiento
            ? normalizarFechaCelda(filaHito.fechaCumplimiento)
            : null;
          hitosData.push({
            proyectoId: idDestino!,
            tareaId,
            nombre: String(filaHito.nombre).trim(),
            fechaObjetivo: new Date(`${fObj}T00:00:00.000Z`),
            fechaCumplimiento: fCum ? new Date(`${fCum}T00:00:00.000Z`) : null,
            criterio: filaHito.criterio ? String(filaHito.criterio).trim() : null,
            responsable: filaHito.responsable ? String(filaHito.responsable).trim() : null,
          });
        }

        if (hitosData.length > 0) {
          await tx.hito.createMany({ data: hitosData });
        }

        const kpisExistentes = await tx.kpiDefinicion.findMany();
        const kpisCodigosDb = new Set(kpisExistentes.map((k) => k.codigo.toLowerCase()));

        for (const filaKpi of libro.KPI ?? []) {
          const codKpi = String(filaKpi.codigo).trim();
          if (!kpisCodigosDb.has(codKpi.toLowerCase())) {
            await tx.kpiDefinicion.create({
              data: {
                codigo: codKpi,
                nombre: String(filaKpi.nombre).trim(),
                ambito: String(filaKpi.ambito).trim().toUpperCase() as AmbitoKpi,
                formula: String(filaKpi.formula).trim(),
                unidad: String(filaKpi.unidad).trim().toUpperCase() as UnidadKpi,
                meta:
                  filaKpi.meta !== undefined &&
                  filaKpi.meta !== null &&
                  String(filaKpi.meta).trim() !== ''
                    ? Number(filaKpi.meta)
                    : null,
                direccion: String(filaKpi.direccion).trim().toUpperCase() as DireccionKpi,
                activo: true,
              },
            });
            kpisCodigosDb.add(codKpi.toLowerCase());
          }
        }

        const solicitudesExistentes = await tx.solicitudCambio.findMany({
          where: { proyectoId: idDestino! },
          select: { codigo: true },
        });
        const codigosSolExistentes = solicitudesExistentes.map((s) => s.codigo);

        let conteoSolicitudesCreadas = 0;
        for (const filaSol of libro.Solicitudes ?? []) {
          let codSol = filaSol.codigo ? String(filaSol.codigo).trim() : '';
          if (!codSol) {
            codSol = siguienteCodigo(codigosSolExistentes);
          }
          codigosSolExistentes.push(codSol);

          const creada = await tx.solicitudCambio.create({
            data: {
              proyectoId: idDestino!,
              codigo: codSol,
              titulo: String(filaSol.titulo).trim(),
              descripcion: String(filaSol.descripcion).trim(),
              justificacion: String(filaSol.justificacion).trim(),
              solicitante: String(filaSol.solicitante).trim(),
              responsable: String(filaSol.responsable).trim(),
              prioridad: (String(filaSol.prioridad).trim().toUpperCase() || 'MEDIA') as Prioridad,
              categoria: (String(filaSol.categoria).trim().toUpperCase() ||
                'ALCANCE') as CategoriaCambio,
              probabilidadRiesgo: Number(filaSol.probabilidadRiesgo),
              impactoRiesgo: Number(filaSol.impactoRiesgo),
              estado: EstadoSolicitud.REGISTRADA,
              etapaActual: 1,
            },
          });

          const etapasData = Array.from({ length: 10 }, (_, i) => ({
            solicitudId: creada.id,
            numero: i + 1,
            nombre: NOMBRES_ETAPAS[i + 1] ?? `Etapa ${i + 1}`,
            estado: EstadoEtapa.PENDIENTE,
          }));

          await tx.etapaCambio.createMany({ data: etapasData });
          conteoSolicitudesCreadas += 1;
        }

        await this.recalculo.ejecutar(idDestino!, tx, {
          rol: rol ?? 'JP',
          descripcion: 'Importación de proyecto',
        });

        return {
          proyectoId: idDestino!,
          conteos: {
            tareas: mapaCodigoAId.size,
            dependencias: dependenciasFilas.length,
            asignaciones: asignacionesData.length,
            hitos: hitosData.length,
            solicitudes: conteoSolicitudesCreadas,
          },
        };
      },
      { timeout: 30000 },
    );
  }
}
