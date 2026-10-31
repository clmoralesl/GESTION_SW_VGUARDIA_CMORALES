import { useMemo, useState } from 'react';
import { Alert, Center, Container, Group, Loader, Stack, Text, Title } from '@mantine/core';
import { IconInfoCircle, IconPlus } from '@tabler/icons-react';
import { type KpiDetalleRespuesta } from '@autofix/core';
import { useKpis, useKpisProyecto } from '../api/kpi';
import { useProyecto } from '../api/proyectos';
import { BotonProtegido } from '../componentes/boton-protegido';
import { GraficoHistorialKpi } from '../kpi/grafico-historial-kpi';
import { ModalKpi } from '../kpi/modal-kpi';
import { TablaKpi, type FilaKpiTabla } from '../kpi/tabla-kpi';
import { useSesion } from '../sesion/proveedor-sesion';

export function PaginaKpi() {
  const { proyectoActivoId } = useSesion();
  const { data: proyecto } = useProyecto(proyectoActivoId ?? 0);

  const {
    data: kpiDefiniciones,
    isLoading: cargandoDefiniciones,
    error: errorDefiniciones,
  } = useKpis();

  const {
    data: kpiProyecto,
    isLoading: cargandoProyecto,
    error: errorProyecto,
  } = useKpisProyecto(proyectoActivoId);

  const [modalFormulario, setModalFormulario] = useState<{
    abierto: boolean;
    kpiParaEditar: KpiDetalleRespuesta | null;
  }>({
    abierto: false,
    kpiParaEditar: null,
  });

  const [modalGrafico, setModalGrafico] = useState<{
    abierto: boolean;
    kpi: FilaKpiTabla | null;
  }>({
    abierto: false,
    kpi: null,
  });

  const cargando = cargandoDefiniciones || (Boolean(proyectoActivoId) && cargandoProyecto);

  const filas = useMemo((): FilaKpiTabla[] => {
    if (!kpiDefiniciones) return [];

    const resumenesPorKpiId = new Map((kpiProyecto ?? []).map((r) => [r.kpiId, r]));

    return kpiDefiniciones.map((def) => {
      const resumen = resumenesPorKpiId.get(def.id);
      return {
        id: def.id,
        codigo: def.codigo,
        nombre: def.nombre,
        descripcion: def.descripcion,
        ambito: def.ambito,
        unidad: def.unidad,
        meta: def.meta,
        direccion: def.direccion,
        valor: resumen ? resumen.valor : null,
        semaforo: resumen ? resumen.semaforo : null,
        medidoEn: resumen ? resumen.medidoEn : null,
        umbrales: def.umbrales,
        activo: def.activo,
        formula: def.formula,
        esAdicional: def.esAdicional,
      };
    });
  }, [kpiDefiniciones, kpiProyecto]);

  const alAbrirCrear = () => {
    setModalFormulario({ abierto: true, kpiParaEditar: null });
  };

  const alAbrirEditar = (fila: FilaKpiTabla) => {
    const definicion = kpiDefiniciones?.find((d) => d.id === fila.id) ?? null;
    setModalFormulario({ abierto: true, kpiParaEditar: definicion });
  };

  const alAbrirGrafico = (fila: FilaKpiTabla) => {
    setModalGrafico({ abierto: true, kpi: fila });
  };

  return (
    <Container size="xl" py="lg">
      <Stack gap="lg">
        <Group justify="space-between" align="center">
          <div>
            <Title order={2}>Indicadores Clave de Desempeño (KPI)</Title>
            <Text c="dimmed" size="sm">
              Monitoreo del valor ganado (EVM), avance, duración y asignaciones del proyecto
            </Text>
          </div>
          <BotonProtegido
            permiso="editarKpi"
            leftSection={<IconPlus size={16} />}
            onClick={alAbrirCrear}
          >
            Nuevo KPI
          </BotonProtegido>
        </Group>

        {!proyectoActivoId ? (
          <Alert color="blue" icon={<IconInfoCircle size={16} />}>
            Seleccione un proyecto en la cabecera superior para visualizar los valores calculados y
            las alertas de semáforo en tiempo real.
          </Alert>
        ) : null}

        {errorDefiniciones || errorProyecto ? (
          <Alert color="red" title="Error al cargar indicadores">
            No se pudieron recuperar las definiciones o mediciones de KPI.
          </Alert>
        ) : null}

        {cargando ? (
          <Center h={300}>
            <Loader size="lg" />
          </Center>
        ) : (
          <TablaKpi filas={filas} alVerGrafico={alAbrirGrafico} alEditar={alAbrirEditar} />
        )}

        <ModalKpi
          abierto={modalFormulario.abierto}
          alCerrar={() => setModalFormulario({ abierto: false, kpiParaEditar: null })}
          kpiParaEditar={modalFormulario.kpiParaEditar}
          proyectoId={proyectoActivoId}
        />

        <GraficoHistorialKpi
          abierto={modalGrafico.abierto}
          alCerrar={() => setModalGrafico({ abierto: false, kpi: null })}
          kpi={modalGrafico.kpi}
          proyectoId={proyectoActivoId}
          nombreProyecto={proyecto?.nombre}
        />
      </Stack>
    </Container>
  );
}
