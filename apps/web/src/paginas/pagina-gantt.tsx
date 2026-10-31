import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Card, Container, Group, Loader, Stack, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle } from '@tabler/icons-react';
import {
  calendarioLaboralDe,
  formatearFecha,
  hoyEnZona,
  preverInicioTarea,
  type CalendarioLaboral,
  type CalendarioProyecto,
  type TareaArbol,
} from '@autofix/core';
import { useCalendario } from '../api/calendario';
import { useDependencias } from '../api/dependencias';
import { useHitos } from '../api/hitos';
import { useLineaBaseVigente } from '../api/lineas-base';
import { useProyecto } from '../api/proyectos';
import { useActualizarTarea, useArbolTareas } from '../api/tareas';
import { BarraHerramientasGantt } from '../gantt/barra-herramientas-gantt';
import type { NivelZoom } from '../gantt/escala';
import {
  ANCHO_GRILLA,
  descargarBlob,
  exportarPdf,
  exportarPng,
  nombreArchivo,
  ventanaVisible,
} from '../gantt/exportar';
import { Gantt } from '../gantt/gantt';
import { construirModeloGantt } from '../gantt/modelo-gantt';
import { usePaletaGantt } from '../gantt/paleta-gantt';
import { useSesion } from '../sesion/proveedor-sesion';
import { usePermisos } from '../sesion/use-permisos';
import { DetalleTarea } from '../tareas/detalle-tarea';

export function PaginaGantt() {
  const { proyectoActivoId } = useSesion();
  const { data: proyecto, isLoading: cargandoProyecto } = useProyecto(proyectoActivoId ?? 0);
  const { data: arbol, isLoading: cargandoTareas } = useArbolTareas(proyectoActivoId);
  const { data: dependencias, isLoading: cargandoDeps } = useDependencias(proyectoActivoId);
  const { data: hitosData, isLoading: cargandoHitos } = useHitos(proyectoActivoId);
  const { data: calendarioData, isLoading: cargandoCal } = useCalendario(proyectoActivoId);
  const { data: lineaBaseData, isLoading: cargandoLb } = useLineaBaseVigente(proyectoActivoId);

  const actualizarTarea = useActualizarTarea(proyectoActivoId ?? 0);
  const { puede, motivoBloqueo } = usePermisos();
  const paleta = usePaletaGantt();

  const [zoom, setZoom] = useState<NivelZoom>('DIA');
  const [rutaCriticaActiva, setRutaCriticaActiva] = useState(false);
  const [lineaBaseActiva, setLineaBaseActiva] = useState(false);
  const [colapsadas, setColapsadas] = useState<Set<number>>(new Set());
  const [tareaSeleccionada, setTareaSeleccionada] = useState<TareaArbol | null>(null);
  const [exportando, setExportando] = useState(false);

  const contenedorRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const centradoInicialRef = useRef<number | null>(null);

  const hoyCalculo = hitosData?.fechaCalculo || hoyEnZona();

  const calLaboral: CalendarioLaboral = useMemo(() => {
    if (!calendarioData)
      return calendarioLaboralDe({ diasLaborables: [1, 2, 3, 4, 5], feriados: [] });
    return calendarioLaboralDe(calendarioData as CalendarioProyecto);
  }, [calendarioData]);

  const modelo = useMemo(() => {
    if (!arbol) return null;
    return construirModeloGantt({
      tareas: arbol.tareas,
      colapsadas,
      dependencias: dependencias ?? [],
      hitos: hitosData?.hitos ?? [],
      lineaBase: lineaBaseData?.lineaBase ?? null,
      calendario: calLaboral,
      hoy: hoyCalculo,
      zoom,
      rutaCriticaActiva,
    });
  }, [
    arbol,
    colapsadas,
    dependencias,
    hitosData,
    lineaBaseData,
    calLaboral,
    hoyCalculo,
    zoom,
    rutaCriticaActiva,
  ]);

  const ultimoProyectoMedidoRef = useRef<number | null>(null);

  useEffect(() => {
    if (proyectoActivoId && ultimoProyectoMedidoRef.current !== proyectoActivoId) {
      ultimoProyectoMedidoRef.current = proyectoActivoId;
      try {
        performance.clearMarks('gantt-inicio');
        performance.clearMarks('gantt-dibujado');
        performance.clearMeasures('gantt-carga');
        performance.mark('gantt-inicio');
      } catch (_error) {
        void _error;
      }
    }
  }, [proyectoActivoId]);

  useEffect(() => {
    if (!modelo || modelo.filas.length === 0) return;
    if (performance.getEntriesByName('gantt-inicio').length === 0) return;
    if (performance.getEntriesByName('gantt-dibujado').length > 0) return;

    const medir = () => {
      try {
        if (performance.getEntriesByName('gantt-dibujado').length === 0) {
          performance.mark('gantt-dibujado');
          performance.measure('gantt-carga', 'gantt-inicio', 'gantt-dibujado');
        }
      } catch (_error) {
        void _error;
      }
    };

    requestAnimationFrame(medir);
  }, [modelo]);

  const puedeEditar = useMemo(() => {
    if (!proyecto) return false;
    return puede('editarPlanificacion', proyecto.estado);
  }, [proyecto, puede]);

  const alAlternarColapso = useCallback((tareaId: number) => {
    setColapsadas((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(tareaId)) nuevo.delete(tareaId);
      else nuevo.add(tareaId);
      return nuevo;
    });
  }, []);

  const alIrAHoy = useCallback(() => {
    if (!contenedorRef.current || !modelo) return;
    const anchoContenedor = contenedorRef.current.clientWidth - ANCHO_GRILLA;
    const scrollTarget = Math.max(0, modelo.xHoy - anchoContenedor / 2);
    contenedorRef.current.scrollTo({ left: scrollTarget, behavior: 'smooth' });
  }, [modelo]);

  useEffect(() => {
    if (!modelo || !contenedorRef.current || !proyectoActivoId) return;
    if (centradoInicialRef.current === proyectoActivoId) return;
    centradoInicialRef.current = proyectoActivoId;
    const anchoContenedor = contenedorRef.current.clientWidth - ANCHO_GRILLA;
    const scrollTarget = Math.max(0, modelo.xHoy - anchoContenedor / 2);
    contenedorRef.current.scrollLeft = scrollTarget;
  }, [modelo, proyectoActivoId]);

  const prever = useCallback(
    (tarea: TareaArbol, cambios: { fechaPropuesta?: string; nuevaDuracion?: number }) => {
      const fechasPredecesoras = new Map(
        (arbol?.tareas ?? [])
          .filter((t) => t.inicioPlan !== null && t.finPlan !== null)
          .map((t) => [t.id, { inicioPlan: t.inicioPlan!, finPlan: t.finPlan! }]),
      );
      const entrantes = (dependencias ?? []).filter((d) => d.sucesoraId === tarea.id);
      const inicioProy = proyecto?.fechaInicio || '';

      const duracion = cambios.nuevaDuracion ?? tarea.duracionDias;
      const tareaParaPrever = {
        ...tarea,
        duracionDias: duracion,
        fechaFija: cambios.fechaPropuesta !== undefined ? cambios.fechaPropuesta : tarea.fechaFija,
      };

      const prevision = preverInicioTarea(
        tareaParaPrever,
        entrantes,
        fechasPredecesoras,
        calLaboral,
        inicioProy,
      );

      const esInvalido =
        cambios.fechaPropuesta !== undefined && cambios.fechaPropuesta < prevision.inicioPlan;

      return {
        inicioPlan: prevision.inicioPlan,
        finPlan: prevision.finPlan,
        esInvalido,
      };
    },
    [arbol, dependencias, proyecto, calLaboral],
  );

  const alMoverTarea = useCallback(
    (tarea: TareaArbol, fechaPropuesta: string) => {
      const fechasPredecesoras = new Map(
        (arbol?.tareas ?? [])
          .filter((t) => t.inicioPlan !== null && t.finPlan !== null)
          .map((t) => [t.id, { inicioPlan: t.inicioPlan!, finPlan: t.finPlan! }]),
      );
      const entrantes = (dependencias ?? []).filter((d) => d.sucesoraId === tarea.id);
      const inicioProy = proyecto?.fechaInicio || '';

      const prevision = preverInicioTarea(
        { ...tarea, fechaFija: null },
        entrantes,
        fechasPredecesoras,
        calLaboral,
        inicioProy,
      );

      if (fechaPropuesta < prevision.inicioPlan) {
        let mensaje = '';
        if (prevision.limitante.tipo === 'DEPENDENCIA') {
          const dep = prevision.limitante.dependencia;
          const pred = arbol?.tareas.find((t) => t.id === dep.predecesoraId);
          const codigoPred = pred?.codigo ?? String(dep.predecesoraId);
          const desfase = dep.desfaseDias >= 0 ? `+${dep.desfaseDias}` : `${dep.desfaseDias}`;
          mensaje = `${tarea.codigo} no puede empezar antes del ${formatearFecha(prevision.inicioPlan)} por la dependencia ${dep.tipo} ${desfase} con ${codigoPred}.`;
        } else if (prevision.limitante.tipo === 'PROYECTO') {
          mensaje = `${tarea.codigo} no puede empezar antes del inicio del proyecto (${formatearFecha(prevision.inicioPlan)}).`;
        } else {
          mensaje = `${tarea.codigo} no puede empezar antes del ${formatearFecha(prevision.inicioPlan)}.`;
        }

        notifications.show({
          color: 'red',
          title: 'Movimiento no permitido',
          message: mensaje,
        });
        return;
      }

      const fechaFija = fechaPropuesta === prevision.inicioPlan ? null : fechaPropuesta;

      actualizarTarea.mutate(
        { tareaId: tarea.id, datos: { fechaFija } },
        {
          onSuccess: (resultado) => {
            const tareaEnResultado = resultado.arbol.tareas.find((t) => t.id === tarea.id);
            if (tareaEnResultado && tareaEnResultado.inicioPlan !== fechaPropuesta) {
              notifications.show({
                color: 'yellow',
                title: 'Posición distinta a la prevista',
                message: `${tarea.codigo} quedó en ${formatearFecha(tareaEnResultado.inicioPlan)} en vez de ${formatearFecha(fechaPropuesta)}.`,
              });
            }
          },
          onError: (err) => {
            notifications.show({
              color: 'red',
              title: 'Error al mover tarea',
              message: err.cuerpo?.mensaje || 'No se pudo mover la tarea.',
            });
          },
        },
      );
    },
    [actualizarTarea, arbol, dependencias, proyecto, calLaboral],
  );

  const alEstirarTarea = useCallback(
    (tarea: TareaArbol, nuevaDuracion: number) => {
      actualizarTarea.mutate(
        { tareaId: tarea.id, datos: { duracionDias: nuevaDuracion } },
        {
          onError: (err) => {
            notifications.show({
              color: 'red',
              title: 'Error al cambiar duración',
              message: err.cuerpo?.mensaje || 'No se pudo cambiar la duración.',
            });
          },
        },
      );
    },
    [actualizarTarea],
  );

  const alExportarPng = useCallback(async () => {
    if (!svgRef.current || !contenedorRef.current || !proyecto || !modelo) return;
    try {
      setExportando(true);
      const ventana = ventanaVisible(contenedorRef.current);
      const blob = await exportarPng(
        svgRef.current,
        modelo,
        ventana,
        paleta,
        zoom,
        proyecto.nombre,
      );
      descargarBlob(blob, nombreArchivo(proyecto.nombre, 'png'));
    } catch {
      notifications.show({
        color: 'red',
        title: 'Error al exportar PNG',
        message: 'No fue posible exportar la imagen PNG.',
      });
    } finally {
      setExportando(false);
    }
  }, [proyecto, modelo, paleta, zoom]);

  const alExportarPdf = useCallback(async () => {
    if (!svgRef.current || !contenedorRef.current || !proyecto || !modelo) return;
    try {
      setExportando(true);
      const ventana = ventanaVisible(contenedorRef.current);
      const blob = await exportarPdf(
        svgRef.current,
        modelo,
        ventana,
        paleta,
        zoom,
        proyecto.nombre,
        formatearFecha(hoyCalculo),
      );
      descargarBlob(blob, nombreArchivo(proyecto.nombre, 'pdf'));
    } catch {
      notifications.show({
        color: 'red',
        title: 'Error al exportar PDF',
        message: 'No fue posible exportar el documento PDF.',
      });
    } finally {
      setExportando(false);
    }
  }, [proyecto, modelo, paleta, zoom, hoyCalculo]);

  if (!proyectoActivoId) {
    return (
      <Container size="xl" py="md">
        <Alert icon={<IconAlertCircle size={16} />} title="Sin proyecto activo" color="blue">
          Seleccione un proyecto en la barra superior para visualizar la carta Gantt.
        </Alert>
      </Container>
    );
  }

  const cargando =
    cargandoProyecto ||
    cargandoTareas ||
    cargandoDeps ||
    cargandoHitos ||
    cargandoCal ||
    cargandoLb;

  if (cargando) {
    return (
      <Container size="xl" py="xl">
        <Group justify="center" py="xl">
          <Loader size="lg" />
          <Text size="sm" c="dimmed">
            Cargando carta Gantt...
          </Text>
        </Group>
      </Container>
    );
  }

  const ocupado = actualizarTarea.isPending || cargandoCal || !calendarioData;
  const motivo = motivoBloqueo('editarPlanificacion', proyecto?.estado);

  return (
    <Container size="xl" py="md" fluid>
      <Stack gap="md">
        <Group justify="space-between" align="baseline">
          <div>
            <Title order={2}>Carta Gantt</Title>
            <Text size="sm" c="dimmed">
              {proyecto?.nombre} — Cronograma y relaciones de dependencias
            </Text>
          </div>
        </Group>

        <Card withBorder padding="md">
          <BarraHerramientasGantt
            zoom={zoom}
            alCambiarZoom={setZoom}
            alIrAHoy={alIrAHoy}
            puedeIrAHoy={Boolean(modelo && modelo.filas.length > 0)}
            rutaCriticaActiva={rutaCriticaActiva}
            alCambiarRutaCritica={setRutaCriticaActiva}
            lineaBaseActiva={lineaBaseActiva}
            alCambiarLineaBase={setLineaBaseActiva}
            tieneLineaBase={Boolean(lineaBaseData?.lineaBase)}
            alExportarPng={alExportarPng}
            alExportarPdf={alExportarPdf}
            exportando={exportando}
          />

          {!modelo || modelo.filas.length === 0 ? (
            <Alert icon={<IconAlertCircle size={16} />} title="Sin tareas" color="gray">
              El proyecto no tiene tareas planificadas.
            </Alert>
          ) : (
            <Gantt
              modelo={modelo}
              colapsadas={colapsadas}
              alAlternarColapso={alAlternarColapso}
              alSeleccionarTarea={setTareaSeleccionada}
              lineaBaseActiva={lineaBaseActiva}
              rutaCriticaActiva={rutaCriticaActiva}
              puedeEditar={puedeEditar}
              ocupado={ocupado}
              motivoBloqueo={motivo}
              alMoverTarea={alMoverTarea}
              alEstirarTarea={alEstirarTarea}
              prever={prever}
              calendario={calLaboral}
              paleta={paleta}
              zoom={zoom}
              anchoGrilla={ANCHO_GRILLA}
              contenedorRef={contenedorRef}
              svgRef={svgRef}
            />
          )}
        </Card>
      </Stack>

      {tareaSeleccionada !== null && (
        <DetalleTarea
          tarea={tareaSeleccionada}
          todasLasTareas={arbol?.tareas ?? []}
          proyectoId={proyectoActivoId}
          estadoProyecto={proyecto?.estado}
          abierto={true}
          alCerrar={() => setTareaSeleccionada(null)}
        />
      )}
    </Container>
  );
}
