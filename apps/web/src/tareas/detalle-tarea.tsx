import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Card,
  Divider,
  Drawer,
  Group,
  NumberInput,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { IconAlertCircle, IconInfoCircle, IconPlus, IconTrash } from '@tabler/icons-react';
import {
  formatearFecha,
  NOMBRES_NIVEL,
  NOMBRES_TIPO_DEPENDENCIA,
  predecesorasDisponibles,
  TIPOS_DEPENDENCIA,
  type EstadoProyecto,
  type TareaArbol,
  type TipoDependencia,
} from '@autofix/core';
import { useCrearDependencia, useDependencias, useEliminarDependencia } from '../api/dependencias';
import { AccionProtegida, BotonProtegido } from '../componentes/boton-protegido';
import { usePermisos } from '../sesion/use-permisos';
import { AsignacionesTarea } from './asignaciones-tarea';

interface DetalleTareaProps {
  tarea: TareaArbol | null;
  todasLasTareas: readonly TareaArbol[];
  proyectoId: number;
  estadoProyecto?: EstadoProyecto;
  abierto: boolean;
  alCerrar: () => void;
}

function formatearDesfase(desfaseDias: number): string {
  if (desfaseDias > 0) return `+${desfaseDias} d`;
  if (desfaseDias < 0) return `${desfaseDias} d`;
  return '0 d';
}

export function DetalleTarea({
  tarea,
  todasLasTareas,
  proyectoId,
  estadoProyecto,
  abierto,
  alCerrar,
}: DetalleTareaProps) {
  const { puede } = usePermisos();
  const edicionHabilitada = puede('editarPlanificacion', estadoProyecto);

  const { data: dependencias } = useDependencias(proyectoId);
  const crearMutacion = useCrearDependencia(proyectoId);
  const eliminarMutacion = useEliminarDependencia(proyectoId);

  const [predecesoraSeleccionada, setPredecesoraSeleccionada] = useState<string | null>(null);
  const [tipoSeleccionado, setTipoSeleccionado] = useState<TipoDependencia>('FS');
  const [desfase, setDesfase] = useState<number | string>(0);
  const { reset: reiniciarCreacion } = crearMutacion;

  useEffect(() => {
    setPredecesoraSeleccionada(null);
    setTipoSeleccionado('FS');
    setDesfase(0);
    reiniciarCreacion();
  }, [tarea?.id, reiniciarCreacion]);

  const tareaPorId = useMemo(() => new Map(todasLasTareas.map((t) => [t.id, t])), [todasLasTareas]);

  const disponibles = useMemo(() => {
    if (!tarea) return [];
    return predecesorasDisponibles(todasLasTareas, dependencias ?? [], tarea.id);
  }, [tarea, todasLasTareas, dependencias]);

  const opcionesDisponibles = useMemo(
    () =>
      disponibles.map((t) => ({
        value: String(t.id),
        label: `${t.codigo} · ${t.nombre}`,
      })),
    [disponibles],
  );

  const predecesoras = useMemo(() => {
    if (!tarea) return [];
    return (dependencias ?? []).filter((d) => d.sucesoraId === tarea.id);
  }, [dependencias, tarea]);

  const sucesoras = useMemo(() => {
    if (!tarea) return [];
    return (dependencias ?? []).filter((d) => d.predecesoraId === tarea.id);
  }, [dependencias, tarea]);

  if (!tarea) {
    return <Drawer opened={false} onClose={alCerrar} position="right" size="lg" />;
  }

  const alAgregarPredecesora = () => {
    if (!predecesoraSeleccionada) return;
    crearMutacion.mutate(
      {
        predecesoraId: Number(predecesoraSeleccionada),
        sucesoraId: tarea.id,
        tipo: tipoSeleccionado,
        desfaseDias: Number(desfase) || 0,
      },
      {
        onSuccess: () => {
          setPredecesoraSeleccionada(null);
          setTipoSeleccionado('FS');
          setDesfase(0);
        },
      },
    );
  };

  return (
    <Drawer
      opened={abierto}
      onClose={alCerrar}
      position="right"
      size="lg"
      title={
        <Group gap="xs">
          <Badge size="sm" variant="light">
            {NOMBRES_NIVEL[tarea.nivel]}
          </Badge>
          <Text fw={600} size="lg">
            {tarea.codigo} · {tarea.nombre}
          </Text>
        </Group>
      }
    >
      <Stack gap="lg">
        <Card withBorder padding="sm">
          <Stack gap="xs">
            <Group justify="space-between" align="center">
              <Title order={5}>Cronograma</Title>
              {tarea.esCritica && (
                <Badge color="red" variant="filled">
                  Crítica
                </Badge>
              )}
            </Group>

            <SimpleGrid cols={2} spacing="xs">
              <div>
                <Text size="xs" c="dimmed">
                  Inicio plan
                </Text>
                <Text size="sm" fw={500}>
                  {formatearFecha(tarea.inicioPlan) ?? '—'}
                </Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">
                  Fin plan
                </Text>
                <Text size="sm" fw={500}>
                  {formatearFecha(tarea.finPlan) ?? '—'}
                </Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">
                  Inicio tardío
                </Text>
                <Text size="sm">{formatearFecha(tarea.inicioTardio) ?? '—'}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">
                  Fin tardío
                </Text>
                <Text size="sm">{formatearFecha(tarea.finTardio) ?? '—'}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">
                  Holgura
                </Text>
                <Text size="sm" fw={500}>
                  {tarea.holguraDias !== null && tarea.holguraDias !== undefined
                    ? `${tarea.holguraDias} días hábiles`
                    : '—'}
                </Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">
                  Fecha fija
                </Text>
                <Text size="sm">{formatearFecha(tarea.fechaFija) ?? 'Sin restricción'}</Text>
              </div>
            </SimpleGrid>
          </Stack>
        </Card>

        <Divider />

        {tarea.tieneHijas ? (
          <Alert color="blue" icon={<IconInfoCircle size={18} />}>
            Las dependencias se definen entre tareas sin subtareas.
          </Alert>
        ) : (
          <Stack gap="md">
            <div>
              <Title order={5} mb="xs">
                Predecesoras
              </Title>
              {predecesoras.length === 0 ? (
                <Text size="sm" c="dimmed">
                  Sin dependencias predecesoras.
                </Text>
              ) : (
                <Table verticalSpacing="xs" striped withTableBorder>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Tarea</Table.Th>
                      <Table.Th style={{ width: 130 }}>Tipo</Table.Th>
                      <Table.Th style={{ width: 80 }}>Desfase</Table.Th>
                      <Table.Th style={{ width: 60 }}></Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {predecesoras.map((dep) => {
                      const t = tareaPorId.get(dep.predecesoraId);
                      return (
                        <Table.Tr key={dep.id}>
                          <Table.Td>
                            <Text size="sm">
                              {t ? `${t.codigo} · ${t.nombre}` : `Tarea #${dep.predecesoraId}`}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Tooltip label={NOMBRES_TIPO_DEPENDENCIA[dep.tipo]}>
                              <Text size="xs">
                                {dep.tipo} ({NOMBRES_TIPO_DEPENDENCIA[dep.tipo]})
                              </Text>
                            </Tooltip>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">{formatearDesfase(dep.desfaseDias)}</Text>
                          </Table.Td>
                          <Table.Td>
                            <AccionProtegida
                              size="sm"
                              variant="subtle"
                              color="red"
                              permiso="editarPlanificacion"
                              estadoProyecto={estadoProyecto}
                              tooltip="Eliminar dependencia"
                              loading={eliminarMutacion.isPending}
                              onClick={() => eliminarMutacion.mutate(dep.id)}
                            >
                              <IconTrash size={16} />
                            </AccionProtegida>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              )}
            </div>

            <Card withBorder padding="sm">
              <Stack gap="xs">
                <Text size="sm" fw={500}>
                  Agregar predecesora
                </Text>

                {crearMutacion.isError && (
                  <Alert
                    color="red"
                    icon={<IconAlertCircle size={18} />}
                    title="No se pudo agregar la dependencia"
                  >
                    {crearMutacion.error.cuerpo?.mensaje ?? crearMutacion.error.message}
                  </Alert>
                )}

                <Select
                  label="Tarea predecesora"
                  placeholder="Seleccione una tarea"
                  data={opcionesDisponibles}
                  searchable
                  clearable
                  value={predecesoraSeleccionada}
                  onChange={(val) => {
                    setPredecesoraSeleccionada(val);
                    if (crearMutacion.isError) crearMutacion.reset();
                  }}
                  disabled={!edicionHabilitada}
                  nothingFoundMessage="No hay predecesoras disponibles"
                />

                <Group grow align="flex-start">
                  <div>
                    <Text size="xs" fw={500} mb={4}>
                      Tipo de dependencia
                    </Text>
                    <SegmentedControl
                      fullWidth
                      value={tipoSeleccionado}
                      onChange={(val) => setTipoSeleccionado(val as TipoDependencia)}
                      data={TIPOS_DEPENDENCIA.map((tipo) => ({
                        value: tipo,
                        label: tipo,
                      }))}
                      disabled={!edicionHabilitada}
                    />
                    <Text size="xs" c="dimmed" mt={4}>
                      {NOMBRES_TIPO_DEPENDENCIA[tipoSeleccionado]}
                    </Text>
                  </div>

                  <NumberInput
                    label="Desfase (días hábiles)"
                    value={desfase}
                    onChange={(val) => setDesfase(val)}
                    min={-365}
                    max={365}
                    step={1}
                    disabled={!edicionHabilitada}
                  />
                </Group>

                <Group justify="flex-end" mt="xs">
                  <BotonProtegido
                    permiso="editarPlanificacion"
                    estadoProyecto={estadoProyecto}
                    leftSection={<IconPlus size={16} />}
                    disabled={!edicionHabilitada || !predecesoraSeleccionada}
                    loading={crearMutacion.isPending}
                    onClick={alAgregarPredecesora}
                  >
                    Agregar predecesora
                  </BotonProtegido>
                </Group>
              </Stack>
            </Card>

            <div>
              <Title order={5} mb="xs">
                Sucesoras
              </Title>
              {sucesoras.length === 0 ? (
                <Text size="sm" c="dimmed">
                  Sin dependencias sucesoras (ninguna tarea depende de esta).
                </Text>
              ) : (
                <Table verticalSpacing="xs" striped withTableBorder>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Tarea sucesora</Table.Th>
                      <Table.Th style={{ width: 130 }}>Tipo</Table.Th>
                      <Table.Th style={{ width: 80 }}>Desfase</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {sucesoras.map((dep) => {
                      const t = tareaPorId.get(dep.sucesoraId);
                      return (
                        <Table.Tr key={dep.id}>
                          <Table.Td>
                            <Text size="sm">
                              {t ? `${t.codigo} · ${t.nombre}` : `Tarea #${dep.sucesoraId}`}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Tooltip label={NOMBRES_TIPO_DEPENDENCIA[dep.tipo]}>
                              <Text size="xs">
                                {dep.tipo} ({NOMBRES_TIPO_DEPENDENCIA[dep.tipo]})
                              </Text>
                            </Tooltip>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">{formatearDesfase(dep.desfaseDias)}</Text>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              )}
            </div>

            <Divider />

            <AsignacionesTarea
              tarea={tarea}
              proyectoId={proyectoId}
              estadoProyecto={estadoProyecto}
            />
          </Stack>
        )}
      </Stack>
    </Drawer>
  );
}
