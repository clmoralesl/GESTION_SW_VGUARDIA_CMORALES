import { useState } from 'react';
import { Alert, Center, Container, Group, Loader, Modal, Stack, Text, Title } from '@mantine/core';
import { IconAlertCircle, IconInfoCircle, IconPlus } from '@tabler/icons-react';
import type { EntradaCrearSolicitud, FiltrosSolicitud } from '@autofix/core';
import { useCrearSolicitudCambio, useSolicitudesCambio } from '../api/cambios';
import { useProyecto } from '../api/proyectos';
import { FormularioSolicitud } from '../cambios/formulario-solicitud';
import { TablaSolicitudes } from '../cambios/tabla-solicitudes';
import { BotonProtegido } from '../componentes/boton-protegido';
import { AvisoProyectoCerrado } from '../proyectos/aviso-proyecto-cerrado';
import { useSesion } from '../sesion/proveedor-sesion';

export function PaginaCambios() {
  const { proyectoActivoId } = useSesion();

  const { data: proyecto, isLoading: cargandoProyecto } = useProyecto(proyectoActivoId ?? 0);

  const [filtros, setFiltros] = useState<FiltrosSolicitud>({});
  const [modalCrear, setModalCrear] = useState(false);

  const {
    data: solicitudes,
    isLoading: cargandoSolicitudes,
    isError,
    error,
  } = useSolicitudesCambio(proyectoActivoId);

  const crearMutacion = useCrearSolicitudCambio(proyectoActivoId ?? 0);

  const handleCrear = (valores: EntradaCrearSolicitud) => {
    crearMutacion.mutate(valores, {
      onSuccess: () => setModalCrear(false),
    });
  };

  if (!proyectoActivoId) {
    return (
      <Container size="xl" py="lg">
        <Alert icon={<IconInfoCircle size={16} />} title="Seleccione un proyecto" color="blue">
          Para consultar y gestionar las solicitudes de cambio, seleccione un proyecto en la
          cabecera superior.
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="xl" py="lg">
      <Stack gap="lg">
        {proyecto?.estado === 'CERRADO' && <AvisoProyectoCerrado />}

        <Group justify="space-between" align="center">
          <div>
            <Title order={2}>Gestión del cambio</Title>
            <Text c="dimmed" size="sm">
              Registro y seguimiento de solicitudes de cambio en las 10 etapas integradas
            </Text>
          </div>

          <BotonProtegido
            leftSection={<IconPlus size={16} />}
            permiso="gestionarSolicitudesCambio"
            estadoProyecto={proyecto?.estado}
            onClick={() => setModalCrear(true)}
          >
            Nueva solicitud
          </BotonProtegido>
        </Group>

        {cargandoProyecto || cargandoSolicitudes ? (
          <Center py="xl">
            <Loader />
          </Center>
        ) : isError ? (
          <Alert icon={<IconAlertCircle size={16} />} color="red" title="Error">
            {error?.message ?? 'Ocurrió un error al cargar las solicitudes de cambio.'}
          </Alert>
        ) : (
          <TablaSolicitudes
            solicitudes={solicitudes ?? []}
            filtros={filtros}
            onCambiarFiltros={setFiltros}
            onLimpiarFiltros={() => setFiltros({})}
          />
        )}
      </Stack>

      <Modal
        opened={modalCrear}
        onClose={() => setModalCrear(false)}
        title="Registrar nueva solicitud de cambio"
        size="lg"
      >
        {modalCrear && (
          <FormularioSolicitud
            onSubmit={handleCrear}
            onCancel={() => setModalCrear(false)}
            cargando={crearMutacion.isPending}
          />
        )}
      </Modal>
    </Container>
  );
}
