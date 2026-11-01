import { useRef, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Divider,
  FileInput,
  Grid,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconDownload,
  IconEdit,
  IconPlayerPlay,
  IconPlus,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import {
  ETAPAS_OBLIGATORIAS,
  formatearFecha,
  type EntradaActualizarEtapa,
  type EntradaCrearAccionCorrectiva,
  type EstadoAccion,
  type EstadoEtapa,
} from '@autofix/core';
import {
  descargarEvidencia,
  useActualizarAccionCorrectiva,
  useActualizarEtapa,
  useCompletarEtapa,
  useCrearAccionCorrectiva,
  useEliminarEvidencia,
  useIniciarEtapa,
  useOmitirEtapa,
  useSubirEvidencia,
  type DetalleEtapaCambio,
  type DetalleSolicitudCambio,
} from '../api/cambios';
import { usePermisos } from '../sesion/use-permisos';

interface PanelEtapaProps {
  solicitud: DetalleSolicitudCambio;
  etapa: DetalleEtapaCambio;
}

const colorPorEstado: Record<EstadoEtapa, string> = {
  PENDIENTE: 'gray',
  EN_CURSO: 'blue',
  COMPLETADA: 'green',
  OMITIDA: 'orange',
};

const etiquetaEstado: Record<EstadoEtapa, string> = {
  PENDIENTE: 'Pendiente',
  EN_CURSO: 'En curso',
  COMPLETADA: 'Completada',
  OMITIDA: 'Omitida',
};

function formatearTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PanelEtapa({ solicitud, etapa }: PanelEtapaProps) {
  const { puede } = usePermisos();
  const puedeAvanzar = puede('avanzarEtapasCambio');
  const puedeAdjuntar = puede('adjuntarEvidencias');
  const esTerminalSolicitud = solicitud.estado === 'RECHAZADA' || solicitud.estado === 'CERRADA';

  const iniciarMutacion = useIniciarEtapa(solicitud.id);
  const completarMutacion = useCompletarEtapa(solicitud.id);
  const omitirMutacion = useOmitirEtapa(solicitud.id);
  const actualizarEtapaMutacion = useActualizarEtapa(solicitud.id);
  const subirEvidenciaMutacion = useSubirEvidencia(solicitud.id);
  const eliminarEvidenciaMutacion = useEliminarEvidencia(solicitud.id);
  const crearAccionMutacion = useCrearAccionCorrectiva(solicitud.id);
  const actualizarAccionMutacion = useActualizarAccionCorrectiva(solicitud.id);

  const [modalOmitir, setModalOmitir] = useState(false);
  const [comentarioOmitir, setComentarioOmitir] = useState('');
  const [modalEditarEtapa, setModalEditarEtapa] = useState(false);
  const [modalNuevaAccion, setModalNuevaAccion] = useState(false);

  const fileInputRef = useRef<HTMLButtonElement>(null);
  const [archivoSeleccionado, setArchivoSeleccionado] = useState<File | null>(null);

  const formEditarEtapa = useForm<EntradaActualizarEtapa>({
    initialValues: {
      responsable: etapa.responsable ?? '',
      fechaInicio: etapa.fechaInicio ?? null,
      fechaFin: etapa.fechaFin ?? null,
      comentario: etapa.comentario ?? '',
      porcentajeAdopcion: etapa.porcentajeAdopcion ?? null,
    },
  });

  const formAccion = useForm<EntradaCrearAccionCorrectiva>({
    initialValues: {
      descripcion: '',
      responsable: '',
      fechaCompromiso: '',
    },
    validate: {
      descripcion: (v) =>
        v.trim().length >= 3 ? null : 'La descripción debe tener al menos 3 caracteres.',
      responsable: (v) =>
        v.trim().length >= 2 ? null : 'El responsable debe tener al menos 2 caracteres.',
      fechaCompromiso: (v) => (v ? null : 'La fecha de compromiso es requerida.'),
    },
  });

  const esObligatoria = (ETAPAS_OBLIGATORIAS as readonly number[]).includes(etapa.numero);
  const puedeIniciar = puedeAvanzar && !esTerminalSolicitud && etapa.estado === 'PENDIENTE';
  const puedeCompletar = puedeAvanzar && !esTerminalSolicitud && etapa.estado === 'EN_CURSO';
  const puedeOmitir =
    puedeAvanzar &&
    !esTerminalSolicitud &&
    !esObligatoria &&
    etapa.estado !== 'COMPLETADA' &&
    etapa.estado !== 'OMITIDA';

  const handleSubirArchivo = (file: File | null) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      notifications.show({
        color: 'red',
        title: 'Archivo demasiado grande',
        message: 'El archivo supera el límite máximo permitido de 10 MB.',
      });
      return;
    }
    subirEvidenciaMutacion.mutate(
      { numero: etapa.numero, archivo: file },
      {
        onSuccess: () => setArchivoSeleccionado(null),
      },
    );
  };

  const handleOmitir = () => {
    if (!comentarioOmitir.trim()) {
      notifications.show({
        color: 'red',
        title: 'Comentario requerido',
        message: 'Debe ingresar una justificación para omitir la etapa.',
      });
      return;
    }
    omitirMutacion.mutate(
      { numero: etapa.numero, datos: { comentario: comentarioOmitir.trim() } },
      {
        onSuccess: () => {
          setModalOmitir(false);
          setComentarioOmitir('');
        },
      },
    );
  };

  const handleGuardarEdicionEtapa = (valores: EntradaActualizarEtapa) => {
    actualizarEtapaMutacion.mutate(
      { numero: etapa.numero, datos: valores },
      {
        onSuccess: () => setModalEditarEtapa(false),
      },
    );
  };

  const handleCrearAccion = (valores: EntradaCrearAccionCorrectiva) => {
    crearAccionMutacion.mutate(valores, {
      onSuccess: () => {
        setModalNuevaAccion(false);
        formAccion.reset();
      },
    });
  };

  return (
    <Card withBorder p="md" radius="md">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <div>
            <Group gap="xs" mb={4}>
              <Text size="sm" fw={700} c="dimmed">
                Etapa {etapa.numero} de 10
              </Text>
              <Badge color={colorPorEstado[etapa.estado]} variant="filled">
                {etiquetaEstado[etapa.estado]}
              </Badge>
              {esObligatoria && (
                <Badge color="gray" variant="outline" size="xs">
                  Obligatoria
                </Badge>
              )}
            </Group>
            <Text fw={700} size="lg">
              {etapa.nombre}
            </Text>
          </div>

          <Group gap="xs">
            {puedeIniciar && (
              <Button
                leftSection={<IconPlayerPlay size={16} />}
                color="blue"
                size="sm"
                loading={iniciarMutacion.isPending}
                onClick={() => iniciarMutacion.mutate(etapa.numero)}
              >
                Iniciar etapa
              </Button>
            )}
            {puedeCompletar && (
              <Button
                leftSection={<IconCheck size={16} />}
                color="green"
                size="sm"
                loading={completarMutacion.isPending}
                onClick={() => completarMutacion.mutate(etapa.numero)}
              >
                Completar etapa
              </Button>
            )}
            {puedeOmitir && (
              <Button
                leftSection={<IconX size={16} />}
                color="orange"
                variant="light"
                size="sm"
                onClick={() => setModalOmitir(true)}
              >
                Omitir etapa
              </Button>
            )}
            {puedeAvanzar && !esTerminalSolicitud && (
              <Button
                leftSection={<IconEdit size={16} />}
                variant="default"
                size="sm"
                onClick={() => setModalEditarEtapa(true)}
              >
                Editar etapa
              </Button>
            )}
          </Group>
        </Group>

        <Grid gutter="sm">
          <Grid.Col span={{ base: 12, sm: 3 }}>
            <Text size="xs" c="dimmed" fw={600}>
              Responsable
            </Text>
            <Text size="sm">{etapa.responsable ?? 'No asignado'}</Text>
          </Grid.Col>
          <Grid.Col span={{ base: 6, sm: 3 }}>
            <Text size="xs" c="dimmed" fw={600}>
              Fecha inicio plan
            </Text>
            <Text size="sm">{etapa.fechaInicio ? formatearFecha(etapa.fechaInicio) : '—'}</Text>
          </Grid.Col>
          <Grid.Col span={{ base: 6, sm: 3 }}>
            <Text size="xs" c="dimmed" fw={600}>
              Fecha fin plan
            </Text>
            <Text size="sm">{etapa.fechaFin ? formatearFecha(etapa.fechaFin) : '—'}</Text>
          </Grid.Col>
          <Grid.Col span={{ base: 6, sm: 3 }}>
            <Text size="xs" c="dimmed" fw={600}>
              Duración real
            </Text>
            <Text size="sm" fw={600}>
              {etapa.duracionRealDias !== null
                ? `${etapa.duracionRealDias} ${etapa.duracionRealDias === 1 ? 'día corrido' : 'días corridos'}`
                : '—'}
            </Text>
          </Grid.Col>
        </Grid>

        {etapa.numero === 10 && (
          <Grid gutter="sm">
            <Grid.Col span={6}>
              <Text size="xs" c="dimmed" fw={600}>
                Porcentaje de adopción cultural
              </Text>
              <Text size="sm" fw={700}>
                {etapa.porcentajeAdopcion !== null
                  ? `${etapa.porcentajeAdopcion} %`
                  : 'Pendiente de registrar'}
              </Text>
            </Grid.Col>
          </Grid>
        )}

        {etapa.comentario && (
          <div>
            <Text size="xs" c="dimmed" fw={600}>
              Comentario / Justificación de omisión
            </Text>
            <Text size="sm">{etapa.comentario}</Text>
          </div>
        )}

        <Divider my="xs" />

        <Stack gap="xs">
          <Group justify="space-between">
            <Text fw={600} size="sm">
              Evidencias adjuntas ({etapa.evidencias.length})
            </Text>
            {puedeAdjuntar && !esTerminalSolicitud && (
              <Group gap="xs">
                <FileInput
                  ref={fileInputRef}
                  value={archivoSeleccionado}
                  onChange={handleSubirArchivo}
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx,.doc,.xls"
                  placeholder="Subir PDF, imagen, Excel o Word (máx 10 MB)"
                  size="xs"
                  style={{ width: 280 }}
                  clearable
                />
              </Group>
            )}
          </Group>

          {etapa.evidencias.length === 0 ? (
            <Text size="sm" c="dimmed" fs="italic">
              No hay evidencias adjuntas para esta etapa.
            </Text>
          ) : (
            <Table withTableBorder withColumnBorders striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Nombre del archivo</Table.Th>
                  <Table.Th>Tamaño</Table.Th>
                  <Table.Th>Subido por</Table.Th>
                  <Table.Th>Fecha</Table.Th>
                  <Table.Th style={{ width: 100 }}>Acciones</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {etapa.evidencias.map((ev) => (
                  <Table.Tr key={ev.id}>
                    <Table.Td fw={500}>{ev.nombreArchivo}</Table.Td>
                    <Table.Td>{formatearTamano(ev.tamanoBytes)}</Table.Td>
                    <Table.Td>
                      <Badge size="xs" variant="light">
                        {ev.subidoPor}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{formatearFecha(ev.subidoEn)}</Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color="blue"
                          title="Descargar evidencia"
                          aria-label={`Descargar ${ev.nombreArchivo}`}
                          onClick={() => descargarEvidencia(ev.id, ev.nombreArchivo)}
                        >
                          <IconDownload size={16} />
                        </ActionIcon>
                        {puedeAdjuntar && !esTerminalSolicitud && (
                          <ActionIcon
                            size="sm"
                            variant="subtle"
                            color="red"
                            title="Eliminar evidencia"
                            aria-label={`Eliminar ${ev.nombreArchivo}`}
                            onClick={() => {
                              if (
                                window.confirm(
                                  `¿Desea eliminar la evidencia "${ev.nombreArchivo}"?`,
                                )
                              ) {
                                eliminarEvidenciaMutacion.mutate(ev.id);
                              }
                            }}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        )}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Stack>

        {etapa.numero === 9 && (
          <>
            <Divider my="xs" />
            <Stack gap="xs">
              <Group justify="space-between">
                <div>
                  <Text fw={600} size="sm">
                    Acciones correctivas ({etapa.acciones.length})
                  </Text>
                  <Text size="xs" c="dimmed">
                    Todas las acciones deben estar cerradas para completar la etapa 9
                  </Text>
                </div>
                {puedeAvanzar && !esTerminalSolicitud && etapa.estado === 'EN_CURSO' && (
                  <Button
                    size="xs"
                    leftSection={<IconPlus size={14} />}
                    onClick={() => setModalNuevaAccion(true)}
                  >
                    Nueva acción correctiva
                  </Button>
                )}
              </Group>

              {etapa.acciones.length === 0 ? (
                <Text size="sm" c="dimmed" fs="italic">
                  No se han registrado acciones correctivas en esta etapa.
                </Text>
              ) : (
                <Table withTableBorder withColumnBorders striped>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Descripción</Table.Th>
                      <Table.Th>Responsable</Table.Th>
                      <Table.Th>Fecha compromiso</Table.Th>
                      <Table.Th>Fecha cierre</Table.Th>
                      <Table.Th>Estado</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {etapa.acciones.map((ac) => (
                      <Table.Tr key={ac.id}>
                        <Table.Td fw={500}>{ac.descripcion}</Table.Td>
                        <Table.Td>{ac.responsable}</Table.Td>
                        <Table.Td>{formatearFecha(ac.fechaCompromiso)}</Table.Td>
                        <Table.Td>{ac.fechaCierre ? formatearFecha(ac.fechaCierre) : '—'}</Table.Td>
                        <Table.Td>
                          {puedeAvanzar && !esTerminalSolicitud ? (
                            <Select
                              size="xs"
                              value={ac.estado}
                              data={[
                                { value: 'PENDIENTE', label: 'Pendiente' },
                                { value: 'EN_CURSO', label: 'En curso' },
                                { value: 'CERRADA', label: 'Cerrada' },
                              ]}
                              onChange={(val) => {
                                if (val) {
                                  actualizarAccionMutacion.mutate({
                                    accionId: ac.id,
                                    datos: { estado: val as EstadoAccion },
                                  });
                                }
                              }}
                              style={{ width: 130 }}
                            />
                          ) : (
                            <Badge
                              color={
                                ac.estado === 'CERRADA'
                                  ? 'green'
                                  : ac.estado === 'EN_CURSO'
                                    ? 'blue'
                                    : 'gray'
                              }
                              variant="filled"
                            >
                              {ac.estado}
                            </Badge>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}
            </Stack>
          </>
        )}
      </Stack>

      <Modal
        opened={modalOmitir}
        onClose={() => setModalOmitir(false)}
        title={`Omitir Etapa ${etapa.numero}: ${etapa.nombre}`}
      >
        <Stack gap="sm">
          <Text size="sm">Omitir una etapa exige registrar una justificación formal.</Text>
          <Textarea
            label="Comentario / Justificación"
            placeholder="Ingrese el motivo por el cual se omite esta etapa"
            required
            minRows={3}
            value={comentarioOmitir}
            onChange={(e) => setComentarioOmitir(e.currentTarget.value)}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setModalOmitir(false)}>
              Cancelar
            </Button>
            <Button color="orange" loading={omitirMutacion.isPending} onClick={handleOmitir}>
              Confirmar omisión
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={modalEditarEtapa}
        onClose={() => setModalEditarEtapa(false)}
        title={`Editar datos planificados: Etapa ${etapa.numero}`}
      >
        {modalEditarEtapa && (
          <form onSubmit={formEditarEtapa.onSubmit(handleGuardarEdicionEtapa)}>
            <Stack gap="sm">
              <TextInput
                label="Responsable"
                placeholder="Nombre del responsable"
                {...formEditarEtapa.getInputProps('responsable')}
              />
              <Grid gutter="xs">
                <Grid.Col span={6}>
                  <TextInput
                    label="Fecha inicio plan (AAAA-MM-DD)"
                    placeholder="2026-11-01"
                    {...formEditarEtapa.getInputProps('fechaInicio')}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextInput
                    label="Fecha fin plan (AAAA-MM-DD)"
                    placeholder="2026-11-15"
                    {...formEditarEtapa.getInputProps('fechaFin')}
                  />
                </Grid.Col>
              </Grid>

              {etapa.numero === 10 && (
                <NumberInput
                  label="Porcentaje de adopción (0 a 100)"
                  min={0}
                  max={100}
                  step={1}
                  {...formEditarEtapa.getInputProps('porcentajeAdopcion')}
                />
              )}

              <Textarea
                label="Comentario"
                placeholder="Observaciones o notas de la etapa"
                minRows={2}
                {...formEditarEtapa.getInputProps('comentario')}
              />

              <Group justify="flex-end" mt="md">
                <Button variant="default" onClick={() => setModalEditarEtapa(false)}>
                  Cancelar
                </Button>
                <Button type="submit" loading={actualizarEtapaMutacion.isPending}>
                  Guardar
                </Button>
              </Group>
            </Stack>
          </form>
        )}
      </Modal>

      <Modal
        opened={modalNuevaAccion}
        onClose={() => setModalNuevaAccion(false)}
        title="Nueva acción correctiva (Etapa 9)"
      >
        {modalNuevaAccion && (
          <form onSubmit={formAccion.onSubmit(handleCrearAccion)}>
            <Stack gap="sm">
              <Textarea
                label="Descripción de la acción correctiva"
                placeholder="Detalle de la corrección a realizar"
                required
                minRows={2}
                {...formAccion.getInputProps('descripcion')}
              />
              <TextInput
                label="Responsable"
                placeholder="Nombre del responsable"
                required
                {...formAccion.getInputProps('responsable')}
              />
              <TextInput
                label="Fecha de compromiso (AAAA-MM-DD)"
                placeholder="2026-11-20"
                required
                {...formAccion.getInputProps('fechaCompromiso')}
              />
              <Group justify="flex-end" mt="md">
                <Button variant="default" onClick={() => setModalNuevaAccion(false)}>
                  Cancelar
                </Button>
                <Button type="submit" loading={crearAccionMutacion.isPending}>
                  Crear acción
                </Button>
              </Group>
            </Stack>
          </form>
        )}
      </Modal>
    </Card>
  );
}
