import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  Alert,
  Badge,
  Button,
  Card,
  Grid,
  Group,
  Loader,
  Modal,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconArrowLeft,
  IconCalendar,
  IconChecklist,
  IconCoins,
  IconEdit,
  IconLock,
  IconPlayerPlay,
} from '@tabler/icons-react';
import {
  formatearFecha,
  formatearFechaHora,
  formatearMonto,
  formatearPorcentaje,
  NOMBRES_ESTADO_PROYECTO,
  puedeTransicionar,
  type EstadoProyecto,
} from '@autofix/core';
import { useAlertasProyecto, useCostosProyecto } from '../api/asignaciones';
import { useCambiarEstadoProyecto, useProyecto } from '../api/proyectos';
import { BotonProtegido } from '../componentes/boton-protegido';
import { AvisoProyectoCerrado } from '../proyectos/aviso-proyecto-cerrado';
import { FormularioProyecto } from '../proyectos/formulario-proyecto';
import { useSesion } from '../sesion/proveedor-sesion';

const COLORES_ESTADO: Record<EstadoProyecto, string> = {
  PLANIFICADO: 'blue',
  EN_CURSO: 'teal',
  CERRADO: 'gray',
};

const ETIQUETAS_TIPO_ALERTA: Record<string, string> = {
  SOBREASIGNACION: 'Sobreasignación',
  PRESUPUESTO: 'Presupuesto',
};

const ETIQUETAS_SEVERIDAD: Record<string, string> = {
  ADVERTENCIA: 'Advertencia',
  CRITICA: 'Crítica',
  INFO: 'Información',
};

export function PaginaDetalleProyecto() {
  const { proyectoId } = useParams();
  const navigate = useNavigate();
  const idNumerico = Number(proyectoId);

  const { data: proyecto, isLoading, isError } = useProyecto(idNumerico, { silenciarError: true });
  const { data: costos } = useCostosProyecto(idNumerico);
  const { data: alertas } = useAlertasProyecto(idNumerico);

  const cambiarEstadoMutacion = useCambiarEstadoProyecto(idNumerico);
  const { cambiarProyecto } = useSesion();

  const [modalEditarAbierto, setModalEditarAbierto] = useState(false);

  const idCargado = proyecto?.id;

  useEffect(() => {
    if (idCargado !== undefined) cambiarProyecto(idCargado);
  }, [idCargado, cambiarProyecto]);

  if (isLoading) {
    return (
      <Group justify="center" p="xl">
        <Loader size="md" />
      </Group>
    );
  }

  if (isError || !proyecto || Number.isNaN(idNumerico) || idNumerico <= 0) {
    return (
      <Stack gap="md">
        <Button
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => navigate('/proyectos')}
          w="fit-content"
        >
          Volver a proyectos
        </Button>
        <Alert color="red" title="Proyecto no encontrado" icon={<IconAlertCircle size={16} />}>
          El proyecto solicitado no existe o el identificador es inválido.
        </Alert>
      </Stack>
    );
  }

  const confirmarCierre = () => {
    modals.openConfirmModal({
      title: 'Confirmar cierre de proyecto',
      children: (
        <Text size="sm">
          Se cerrará el proyecto «{proyecto.nombre}». Un proyecto cerrado no admite modificaciones y
          no se puede reabrir.
        </Text>
      ),
      labels: { confirm: 'Cerrar proyecto', cancel: 'Cancelar' },
      confirmProps: { color: 'red' },
      onConfirm: () => cambiarEstadoMutacion.mutate('cerrar'),
    });
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <div>
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate('/proyectos')}
            size="xs"
            mb="xs"
          >
            Volver a proyectos
          </Button>
          <Group gap="sm" align="center">
            <Title order={2}>{proyecto.nombre}</Title>
            <Badge color={COLORES_ESTADO[proyecto.estado] ?? 'gray'} variant="light" size="md">
              {NOMBRES_ESTADO_PROYECTO[proyecto.estado] ?? proyecto.estado}
            </Badge>
          </Group>
          <Text c="dimmed" size="sm" mt={4}>
            Responsable: {proyecto.responsable}
          </Text>
        </div>

        <Group gap="sm">
          <Button
            variant="default"
            leftSection={<IconCalendar size={16} />}
            onClick={() => navigate(`/proyectos/${proyecto.id}/calendario`)}
          >
            Calendario laboral
          </Button>

          <BotonProtegido
            permiso="editarPlanificacion"
            estadoProyecto={proyecto.estado}
            variant="default"
            leftSection={<IconEdit size={16} />}
            onClick={() => setModalEditarAbierto(true)}
          >
            Editar
          </BotonProtegido>

          {puedeTransicionar(proyecto.estado, 'EN_CURSO') && (
            <BotonProtegido
              permiso="editarPlanificacion"
              estadoProyecto={proyecto.estado}
              color="teal"
              leftSection={<IconPlayerPlay size={16} />}
              loading={cambiarEstadoMutacion.isPending}
              onClick={() => cambiarEstadoMutacion.mutate('iniciar')}
            >
              Iniciar proyecto
            </BotonProtegido>
          )}

          {puedeTransicionar(proyecto.estado, 'CERRADO') && (
            <BotonProtegido
              permiso="editarPlanificacion"
              estadoProyecto={proyecto.estado}
              color="red"
              variant="light"
              leftSection={<IconLock size={16} />}
              loading={cambiarEstadoMutacion.isPending}
              onClick={confirmarCierre}
            >
              Cerrar proyecto
            </BotonProtegido>
          )}
        </Group>
      </Group>

      {proyecto.estado === 'CERRADO' && <AvisoProyectoCerrado />}

      {costos?.excedePresupuesto && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} title="Presupuesto excedido">
          El costo planificado supera el presupuesto asignado al proyecto.
        </Alert>
      )}

      {alertas && alertas.length > 0 && (
        <Card withBorder radius="md" p="md">
          <Group justify="space-between" mb="sm">
            <Group gap="xs">
              <IconAlertTriangle size={18} color="orange" />
              <Title order={4}>Alertas del proyecto</Title>
            </Group>
            <Badge color="orange" variant="light">
              {alertas.length} {alertas.length === 1 ? 'alerta' : 'alertas'}
            </Badge>
          </Group>
          <Stack gap="xs">
            {alertas.map((a) => (
              <Alert
                key={a.id}
                color={a.severidad === 'CRITICA' ? 'red' : 'orange'}
                title={`${ETIQUETAS_TIPO_ALERTA[a.tipo] ?? a.tipo} · ${ETIQUETAS_SEVERIDAD[a.severidad] ?? a.severidad}`}
                icon={<IconAlertTriangle size={16} />}
              >
                <Text size="sm">{a.mensaje}</Text>
                <Text size="xs" c="dimmed" mt={4}>
                  Detectada: {formatearFechaHora(a.creadaEn)}
                </Text>
              </Alert>
            ))}
          </Stack>
        </Card>
      )}

      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
        <Card withBorder radius="md" p="md">
          <Group justify="space-between" mb="xs">
            <Text size="xs" c="dimmed" fw={700} tt="uppercase">
              Tareas registradas
            </Text>
            <IconChecklist size={18} color="gray" />
          </Group>
          <Title order={3}>{proyecto.numeroTareas}</Title>
          <Text size="xs" c="dimmed" mt={4}>
            Total en todos los niveles
          </Text>
        </Card>

        <Card withBorder radius="md" p="md">
          <Group justify="space-between" mb="xs">
            <Text size="xs" c="dimmed" fw={700} tt="uppercase">
              Avance global
            </Text>
            <Text size="xs" fw={700} c="teal">
              {formatearPorcentaje(proyecto.porcentajeAvance)}
            </Text>
          </Group>
          <Progress
            value={proyecto.porcentajeAvance}
            color="teal"
            size="md"
            radius="xl"
            mt="xs"
            mb="xs"
          />
          <Text size="xs" c="dimmed">
            Ponderado por duración de etapas
          </Text>
        </Card>

        <Card withBorder radius="md" p="md">
          <Group justify="space-between" mb="xs">
            <Text size="xs" c="dimmed" fw={700} tt="uppercase">
              Presupuesto
            </Text>
            <IconCoins size={18} color="gray" />
          </Group>
          <Title order={3}>{formatearMonto(proyecto.presupuesto)}</Title>
          <Text size="xs" c="dimmed" mt={4}>
            Monto asignado al proyecto
          </Text>
        </Card>

        <Card withBorder radius="md" p="md">
          <Group justify="space-between" mb="xs">
            <Text size="xs" c="dimmed" fw={700} tt="uppercase">
              Plazo de ejecución
            </Text>
            <IconCalendar size={18} color="gray" />
          </Group>
          <Text size="sm" fw={500}>
            {formatearFecha(proyecto.fechaInicio)} al {formatearFecha(proyecto.fechaFin)}
          </Text>
          <Text size="xs" c="dimmed" mt={4}>
            Inicio y fin planificados
          </Text>
        </Card>
      </SimpleGrid>

      <Card withBorder radius="md" p="md">
        <Title order={4} mb="md">
          Costos y Presupuesto
        </Title>
        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
          <div>
            <Text size="xs" c="dimmed" fw={700} tt="uppercase">
              Presupuesto
            </Text>
            <Title order={4}>{costos ? formatearMonto(costos.presupuesto) : '—'}</Title>
            <Text size="xs" c="dimmed" mt={4}>
              Monto asignado
            </Text>
          </div>
          <div>
            <Text size="xs" c="dimmed" fw={700} tt="uppercase">
              Costo planificado
            </Text>
            <Title order={4} c={costos?.excedePresupuesto ? 'red' : undefined}>
              {costos ? formatearMonto(costos.costoPlan) : '—'}
            </Title>
            <Text size="xs" c="dimmed" mt={4}>
              Suma de asignaciones planificadas
            </Text>
          </div>
          <div>
            <Text size="xs" c="dimmed" fw={700} tt="uppercase">
              Costo real
            </Text>
            <Title order={4}>{costos ? formatearMonto(costos.costoReal) : '—'}</Title>
            <Text size="xs" c="dimmed" mt={4}>
              Suma de asignaciones reales
            </Text>
          </div>
          <div>
            <Text size="xs" c="dimmed" fw={700} tt="uppercase">
              Diferencia (Desvío)
            </Text>
            <Title
              order={4}
              c={
                costos && costos.diferenciaMonto > 0
                  ? 'red'
                  : costos && costos.diferenciaMonto < 0
                    ? 'teal'
                    : undefined
              }
            >
              {costos ? formatearMonto(costos.diferenciaMonto) : '—'}
            </Title>
            {costos && (
              <Text size="xs" c="dimmed" mt={4}>
                {costos.diferenciaPorcentaje !== null
                  ? `${formatearPorcentaje(costos.diferenciaPorcentaje)} vs presupuesto`
                  : '—'}
              </Text>
            )}
          </div>
        </SimpleGrid>
      </Card>

      <Card withBorder radius="md" p="md">
        <Title order={4} mb="sm">
          Descripción del proyecto
        </Title>
        <Text size="sm" c={proyecto.descripcion ? undefined : 'dimmed'}>
          {proyecto.descripcion || 'Sin descripción registrada.'}
        </Text>

        <Grid
          mt="xl"
          pt="md"
          style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}
        >
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Text size="xs" c="dimmed">
              Fecha de creación: {formatearFechaHora(proyecto.creadoEn)}
            </Text>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Text size="xs" c="dimmed">
              Última actualización: {formatearFechaHora(proyecto.actualizadoEn)}
            </Text>
          </Grid.Col>
        </Grid>
      </Card>

      <Modal
        opened={modalEditarAbierto}
        onClose={() => setModalEditarAbierto(false)}
        title="Editar proyecto"
        size="lg"
      >
        <FormularioProyecto
          modo="editar"
          proyecto={proyecto}
          alCerrar={() => setModalEditarAbierto(false)}
        />
      </Modal>
    </Stack>
  );
}
