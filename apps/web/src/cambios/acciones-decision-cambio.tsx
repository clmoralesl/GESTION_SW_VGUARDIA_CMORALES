import { useState } from 'react';
import { Button, Card, Group, Modal, Stack, Text, Textarea, Title, Tooltip } from '@mantine/core';
import { IconCheck, IconX } from '@tabler/icons-react';
import { puedeDecidir } from '@autofix/core';
import {
  useAprobarSolicitudCambio,
  useRechazarSolicitudCambio,
  type DetalleSolicitudCambio,
} from '../api/cambios';
import { usePermisos } from '../sesion/use-permisos';

interface AccionesDecisionCambioProps {
  solicitud: DetalleSolicitudCambio;
}

export function AccionesDecisionCambio({ solicitud }: AccionesDecisionCambioProps) {
  const { puede, motivoBloqueo } = usePermisos();
  const [modalRechazoAbierto, setModalRechazoAbierto] = useState(false);
  const [modalAprobacionAbierto, setModalAprobacionAbierto] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState('');

  const aprobarMutacion = useAprobarSolicitudCambio(solicitud.id, solicitud.proyectoId);
  const rechazarMutacion = useRechazarSolicitudCambio(solicitud.id, solicitud.proyectoId);

  const puedeRol = puede('decidirSolicitudesCambio');
  const habilitadoNegocio = puedeDecidir(solicitud);

  const etapa3 = solicitud.etapas.find((e) => e.numero === 3);

  const motivoInhabilitado = !puedeRol
    ? motivoBloqueo('decidirSolicitudesCambio')
    : !habilitadoNegocio
      ? etapa3?.estado !== 'COMPLETADA'
        ? 'Requiere que la etapa 3 (Evaluación de los riesgos) esté completada'
        : `La solicitud no está en un estado que permita decidir (estado: ${solicitud.estado})`
      : null;

  const handleConfirmarAprobacion = () => {
    aprobarMutacion.mutate(undefined, {
      onSuccess: () => setModalAprobacionAbierto(false),
    });
  };

  const handleConfirmarRechazo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!motivoRechazo.trim()) return;
    rechazarMutacion.mutate(
      { motivo: motivoRechazo.trim() },
      {
        onSuccess: () => {
          setModalRechazoAbierto(false);
          setMotivoRechazo('');
        },
      },
    );
  };

  if (
    !puedeRol &&
    (solicitud.estado === 'APROBADA' ||
      solicitud.estado === 'RECHAZADA' ||
      solicitud.estado === 'CERRADA')
  ) {
    return null;
  }

  return (
    <Card withBorder radius="md" p="md">
      <Group justify="space-between" align="center" wrap="wrap">
        <div>
          <Title order={4}>Decisión del Comité de Cambios</Title>
          <Text size="sm" c="dimmed">
            La aprobación aplicará automáticamente los impactos al plan del proyecto y registrará
            una nueva versión de línea base.
          </Text>
        </div>

        <Group gap="sm">
          {motivoInhabilitado ? (
            <>
              <Tooltip label={motivoInhabilitado}>
                <span>
                  <Button color="red" variant="light" leftSection={<IconX size={16} />} disabled>
                    Rechazar
                  </Button>
                </span>
              </Tooltip>
              <Tooltip label={motivoInhabilitado}>
                <span>
                  <Button
                    color="teal"
                    variant="filled"
                    leftSection={<IconCheck size={16} />}
                    disabled
                  >
                    Aprobar cambio
                  </Button>
                </span>
              </Tooltip>
            </>
          ) : (
            <>
              <Button
                color="red"
                variant="light"
                leftSection={<IconX size={16} />}
                onClick={() => setModalRechazoAbierto(true)}
              >
                Rechazar
              </Button>
              <Button
                color="teal"
                variant="filled"
                leftSection={<IconCheck size={16} />}
                onClick={() => setModalAprobacionAbierto(true)}
              >
                Aprobar cambio
              </Button>
            </>
          )}
        </Group>
      </Group>

      <Modal
        opened={modalAprobacionAbierto}
        onClose={() => setModalAprobacionAbierto(false)}
        title="Confirmar aprobación de cambio"
      >
        <Stack gap="md">
          <Text size="sm">
            ¿Está seguro de que desea aprobar la solicitud <strong>{solicitud.codigo}</strong>?
          </Text>
          <Text size="sm" c="dimmed">
            Esta acción aplicará todos los impactos configurados, recalculará el cronograma del
            proyecto y creará una nueva versión de línea base.
          </Text>
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setModalAprobacionAbierto(false)}>
              Cancelar
            </Button>
            <Button
              color="teal"
              loading={aprobarMutacion.isPending}
              onClick={handleConfirmarAprobacion}
            >
              Confirmar aprobación
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={modalRechazoAbierto}
        onClose={() => setModalRechazoAbierto(false)}
        title="Rechazar solicitud de cambio"
      >
        <form onSubmit={handleConfirmarRechazo}>
          <Stack gap="md">
            <Text size="sm">
              Indique el motivo del rechazo para la solicitud <strong>{solicitud.codigo}</strong>:
            </Text>
            <Textarea
              label="Motivo del rechazo"
              placeholder="Describa las razones por las cuales el cambio no fue aprobado..."
              minRows={3}
              value={motivoRechazo}
              onChange={(e) => setMotivoRechazo(e.currentTarget.value)}
              required
            />
            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={() => setModalRechazoAbierto(false)}>
                Cancelar
              </Button>
              <Button
                color="red"
                type="submit"
                loading={rechazarMutacion.isPending}
                disabled={!motivoRechazo.trim()}
              >
                Rechazar solicitud
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Card>
  );
}
