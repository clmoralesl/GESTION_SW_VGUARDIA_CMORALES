import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  Alert,
  Badge,
  Button,
  Card,
  Center,
  Container,
  Grid,
  Group,
  Loader,
  Modal,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { IconAlertCircle, IconArrowLeft, IconEdit } from '@tabler/icons-react';
import {
  formatearFecha,
  type EntradaActualizarSolicitud,
  type EstadoSolicitud,
  type NivelRiesgo,
  type PrioridadSolicitud,
} from '@autofix/core';
import { useActualizarSolicitudCambio, useSolicitudCambio } from '../api/cambios';
import { FormularioSolicitud } from '../cambios/formulario-solicitud';
import { LineaTiempoEtapas } from '../cambios/linea-tiempo-etapas';
import { PanelEtapa } from '../cambios/panel-etapa';
import { usePermisos } from '../sesion/use-permisos';

const colorPorEstado: Record<EstadoSolicitud, string> = {
  REGISTRADA: 'gray',
  EN_EVALUACION: 'blue',
  APROBADA: 'teal',
  RECHAZADA: 'red',
  IMPLEMENTADA: 'grape',
  CERRADA: 'dark',
};

const colorPorRiesgo: Record<NivelRiesgo, string> = {
  BAJO: 'teal',
  MEDIO: 'blue',
  ALTO: 'orange',
  CRITICO: 'red',
};

const colorPorPrioridad: Record<PrioridadSolicitud, string> = {
  BAJA: 'gray',
  MEDIA: 'blue',
  ALTA: 'orange',
  CRITICA: 'red',
};

export function PaginaDetalleCambio() {
  const { solicitudId } = useParams();
  const idNumero = solicitudId ? Number(solicitudId) : null;
  const navigate = useNavigate();
  const { puede, motivoBloqueo } = usePermisos();

  const { data: solicitud, isLoading, isError, error } = useSolicitudCambio(idNumero);

  const [etapaSeleccionadaNumero, setEtapaSeleccionadaNumero] = useState<number | null>(null);
  const [modalEditar, setModalEditar] = useState(false);

  const actualizarMutacion = useActualizarSolicitudCambio(idNumero ?? 0, solicitud?.proyectoId);

  const etapaActiva =
    solicitud?.etapas.find(
      (e) => e.numero === (etapaSeleccionadaNumero ?? solicitud.etapaActual ?? 1),
    ) ?? solicitud?.etapas[0];

  const motivoBloqueoEdicion = !puede('gestionarSolicitudesCambio')
    ? motivoBloqueo('gestionarSolicitudesCambio')
    : solicitud && solicitud.estado !== 'REGISTRADA' && solicitud.estado !== 'EN_EVALUACION'
      ? 'Solo se puede editar una solicitud en estado Registrada o En evaluación'
      : null;

  const handleGuardarEdicion = (valores: EntradaActualizarSolicitud) => {
    actualizarMutacion.mutate(valores, {
      onSuccess: () => setModalEditar(false),
    });
  };

  if (isLoading) {
    return (
      <Container size="xl" py="xl">
        <Center py="xl">
          <Loader />
        </Center>
      </Container>
    );
  }

  if (isError || !solicitud) {
    return (
      <Container size="xl" py="xl">
        <Stack gap="md">
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate('/cambios')}
            style={{ alignSelf: 'flex-start' }}
          >
            Volver a solicitudes de cambio
          </Button>
          <Alert icon={<IconAlertCircle size={16} />} color="red" title="Error">
            {error?.message ?? 'No se pudo cargar la solicitud de cambio.'}
          </Alert>
        </Stack>
      </Container>
    );
  }

  return (
    <Container size="xl" py="lg">
      <Stack gap="lg">
        <Group justify="space-between" align="center">
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate('/cambios')}
          >
            Volver a cambios
          </Button>

          {motivoBloqueoEdicion ? (
            <Tooltip label={motivoBloqueoEdicion}>
              <Button
                leftSection={<IconEdit size={16} />}
                variant="default"
                data-disabled
                aria-disabled
                onClick={(evento) => evento.preventDefault()}
              >
                Editar solicitud
              </Button>
            </Tooltip>
          ) : (
            <Button
              leftSection={<IconEdit size={16} />}
              variant="default"
              onClick={() => setModalEditar(true)}
            >
              Editar solicitud
            </Button>
          )}
        </Group>

        <Card withBorder p="md" radius="md">
          <Stack gap="sm">
            <Group justify="space-between" align="flex-start">
              <div>
                <Group gap="xs" mb={4}>
                  <Text fw={700} size="sm" c="dimmed">
                    {solicitud.codigo}
                  </Text>
                  <Badge color={colorPorEstado[solicitud.estado]} variant="filled">
                    {solicitud.estado}
                  </Badge>
                  <Badge color={colorPorRiesgo[solicitud.nivelRiesgo]} variant="filled">
                    Riesgo {solicitud.nivelRiesgo}
                  </Badge>
                  <Badge color={colorPorPrioridad[solicitud.prioridad]} variant="light">
                    Prioridad {solicitud.prioridad}
                  </Badge>
                  <Badge variant="outline" color="gray">
                    {solicitud.categoria}
                  </Badge>
                </Group>
                <Title order={3}>{solicitud.titulo}</Title>
              </div>
            </Group>

            <Grid gutter="md" mt="xs">
              <Grid.Col span={{ base: 12, md: 6 }}>
                <Card withBorder p="xs" radius="sm">
                  <Text size="xs" fw={700} c="dimmed" mb={4}>
                    Descripción
                  </Text>
                  <Text size="sm">{solicitud.descripcion}</Text>
                </Card>
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 6 }}>
                <Card withBorder p="xs" radius="sm">
                  <Text size="xs" fw={700} c="dimmed" mb={4}>
                    Justificación
                  </Text>
                  <Text size="sm">{solicitud.justificacion}</Text>
                </Card>
              </Grid.Col>
            </Grid>

            <Grid gutter="sm" mt="xs">
              <Grid.Col span={{ base: 6, sm: 3 }}>
                <Text size="xs" c="dimmed">
                  Solicitante
                </Text>
                <Text size="sm" fw={500}>
                  {solicitud.solicitante}
                </Text>
              </Grid.Col>
              <Grid.Col span={{ base: 6, sm: 3 }}>
                <Text size="xs" c="dimmed">
                  Responsable
                </Text>
                <Text size="sm" fw={500}>
                  {solicitud.responsable}
                </Text>
              </Grid.Col>
              <Grid.Col span={{ base: 6, sm: 3 }}>
                <Text size="xs" c="dimmed">
                  Fecha de registro
                </Text>
                <Text size="sm" fw={500}>
                  {formatearFecha(solicitud.fechaRegistro)}
                </Text>
              </Grid.Col>
              <Grid.Col span={{ base: 6, sm: 3 }}>
                <Text size="xs" c="dimmed">
                  Etapa actual
                </Text>
                <Text size="sm" fw={700}>
                  Etapa {solicitud.etapaActual} de 10
                </Text>
              </Grid.Col>
            </Grid>

            {solicitud.fechaDecision && (
              <Group gap="md">
                <Text size="xs" c="dimmed">
                  Fecha de decisión:{' '}
                  <Text component="span" size="sm" fw={500} c="inherit">
                    {formatearFecha(solicitud.fechaDecision)}
                  </Text>
                </Text>
              </Group>
            )}

            {solicitud.fechaCierre && (
              <Group gap="md">
                <Text size="xs" c="dimmed">
                  Fecha de cierre:{' '}
                  <Text component="span" size="sm" fw={500} c="inherit">
                    {formatearFecha(solicitud.fechaCierre)}
                  </Text>
                </Text>
              </Group>
            )}

            {solicitud.motivoRechazo && (
              <Alert color="red" title="Motivo del rechazo">
                {solicitud.motivoRechazo}
              </Alert>
            )}
          </Stack>
        </Card>

        <LineaTiempoEtapas
          etapas={solicitud.etapas}
          etapaSeleccionada={etapaActiva?.numero ?? 1}
          onSeleccionarEtapa={(num) => setEtapaSeleccionadaNumero(num)}
        />

        {etapaActiva && <PanelEtapa solicitud={solicitud} etapa={etapaActiva} />}
      </Stack>

      <Modal
        opened={modalEditar}
        onClose={() => setModalEditar(false)}
        title={`Editar solicitud ${solicitud.codigo}`}
        size="lg"
      >
        {modalEditar && (
          <FormularioSolicitud
            solicitud={solicitud}
            onSubmit={handleGuardarEdicion}
            onCancel={() => setModalEditar(false)}
            cargando={actualizarMutacion.isPending}
          />
        )}
      </Modal>
    </Container>
  );
}
