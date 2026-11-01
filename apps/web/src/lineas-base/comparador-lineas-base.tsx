import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Card,
  Grid,
  Group,
  Loader,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { IconAlertCircle, IconInfoCircle } from '@tabler/icons-react';
import { formatearFecha, formatearMonto } from '@autofix/core';
import { useCompararLineasBase, useLineasBase } from '../api/lineas-base';

interface ComparadorLineasBaseProps {
  proyectoId: number;
}

const COLOR_ESTADO: Record<string, string> = {
  MODIFICADA: 'blue',
  AGREGADA: 'teal',
  ELIMINADA: 'red',
  IGUAL: 'gray',
};

const FONDO_ESTADO: Record<string, string | undefined> = {
  MODIFICADA: 'var(--mantine-color-blue-0)',
  AGREGADA: 'var(--mantine-color-teal-0)',
  ELIMINADA: 'var(--mantine-color-red-0)',
  IGUAL: undefined,
};

export function ComparadorLineasBase({ proyectoId }: ComparadorLineasBaseProps) {
  const { data: lista, isLoading: cargandoLista } = useLineasBase(proyectoId);

  const [versionA, setVersionA] = useState<string | null>(null);
  const [versionB, setVersionB] = useState<string | null>(null);

  const versiones = useMemo(() => {
    return (lista?.versiones ?? []).slice().sort((a, b) => a.version - b.version);
  }, [lista]);

  useEffect(() => {
    if (versiones.length >= 2) {
      if (versionA === null) setVersionA(String(versiones[0]!.version));
      if (versionB === null) setVersionB(String(versiones[versiones.length - 1]!.version));
    } else if (versiones.length === 1 && versionA === null) {
      setVersionA(String(versiones[0]!.version));
    }
  }, [versiones, versionA, versionB]);

  const numA = versionA ? Number(versionA) : null;
  const numB = versionB ? Number(versionB) : null;

  const {
    data: comparacion,
    isLoading: cargandoComparacion,
    isError,
    error,
  } = useCompararLineasBase(proyectoId, numA, numB);

  const opcionesVersiones = useMemo(
    () =>
      versiones.map((v) => ({
        value: String(v.version),
        label: `v${v.version} · ${v.descripcion || (v.solicitudCodigo ? `Cambio ${v.solicitudCodigo}` : 'Línea base')} (${formatearFecha(v.creadoEn)})`,
      })),
    [versiones],
  );

  if (cargandoLista) {
    return (
      <Group justify="center" p="xl">
        <Loader size="md" />
      </Group>
    );
  }

  if (versiones.length === 0) {
    return (
      <Card withBorder radius="md" p="md">
        <Alert icon={<IconInfoCircle size={16} />} color="blue" title="Sin líneas base">
          El proyecto no cuenta con versiones de línea base registradas. Se creará la primera línea
          base cuando el proyecto inicie o se apruebe una solicitud de cambio.
        </Alert>
      </Card>
    );
  }

  return (
    <Card withBorder radius="md" p="md">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <div>
            <Title order={4}>Comparador de Líneas Base</Title>
            <Text size="sm" c="dimmed">
              Contraste dos versiones aprobadas del plan para identificar variaciones en fechas,
              duraciones y costos.
            </Text>
          </div>

          <Badge size="lg" variant="light" color="blue">
            {versiones.length}{' '}
            {versiones.length === 1 ? 'versión registrada' : 'versiones registradas'}
          </Badge>
        </Group>

        <Grid gutter="md">
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Select
              label="Línea base de origen (Versión A)"
              placeholder="Seleccione la primera versión"
              data={opcionesVersiones}
              value={versionA}
              onChange={setVersionA}
              size="sm"
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Select
              label="Línea base de comparación (Versión B)"
              placeholder="Seleccione la segunda versión"
              data={opcionesVersiones}
              value={versionB}
              onChange={setVersionB}
              size="sm"
            />
          </Grid.Col>
        </Grid>

        {numA !== null && numB !== null && numA === numB && (
          <Alert icon={<IconInfoCircle size={16} />} color="yellow" title="Versiones idénticas">
            Ha seleccionado la misma versión en ambos selectores. Elija dos versiones distintas para
            visualizar la comparación.
          </Alert>
        )}

        {isError && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" title="Error en la comparación">
            {error?.message ??
              'No se pudo obtener la comparación entre las versiones seleccionadas.'}
          </Alert>
        )}

        {cargandoComparacion && numA !== numB && (
          <Group justify="center" p="lg">
            <Loader size="sm" />
            <Text size="sm" c="dimmed">
              Comparando versiones...
            </Text>
          </Group>
        )}

        {comparacion && numA !== numB && (
          <Stack gap="md" mt="xs">
            <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
              <Card withBorder radius="sm" p="xs">
                <Text size="xs" c="dimmed">
                  Tareas modificadas
                </Text>
                <Text size="lg" fw={700} c="blue">
                  {comparacion.totales.tareasModificadas}
                </Text>
              </Card>
              <Card withBorder radius="sm" p="xs">
                <Text size="xs" c="dimmed">
                  Tareas agregadas
                </Text>
                <Text size="lg" fw={700} c="teal">
                  {comparacion.totales.tareasAgregadas}
                </Text>
              </Card>
              <Card withBorder radius="sm" p="xs">
                <Text size="xs" c="dimmed">
                  Tareas eliminadas
                </Text>
                <Text size="lg" fw={700} c="red">
                  {comparacion.totales.tareasEliminadas}
                </Text>
              </Card>
              <Card withBorder radius="sm" p="xs">
                <Text size="xs" c="dimmed">
                  Diferencia costo total
                </Text>
                <Text
                  size="lg"
                  fw={700}
                  c={
                    comparacion.totales.diferenciaCostoTotal > 0
                      ? 'red'
                      : comparacion.totales.diferenciaCostoTotal < 0
                        ? 'teal'
                        : undefined
                  }
                >
                  {comparacion.totales.diferenciaCostoTotal > 0 ? '+' : ''}
                  {formatearMonto(comparacion.totales.diferenciaCostoTotal)}
                </Text>
              </Card>
            </SimpleGrid>

            <Table.ScrollContainer minWidth={900}>
              <Table striped highlightOnHover verticalSpacing="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th style={{ width: 80 }}>Código</Table.Th>
                    <Table.Th>Nombre de tarea</Table.Th>
                    <Table.Th style={{ width: 100 }}>Nivel</Table.Th>
                    <Table.Th style={{ width: 110 }}>Estado</Table.Th>
                    <Table.Th style={{ width: 120 }}>Duración (días)</Table.Th>
                    <Table.Th style={{ width: 140 }}>Inicio Plan</Table.Th>
                    <Table.Th style={{ width: 140 }}>Fin Plan</Table.Th>
                    <Table.Th style={{ width: 150 }}>Costo Plan</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {comparacion.filas.map((f) => {
                    const durCambio = f.duracionDiasA !== f.duracionDiasB;
                    const inicioCambio = f.inicioPlanA !== f.inicioPlanB;
                    const finCambio = f.finPlanA !== f.finPlanB;
                    const costoCambio = f.costoPlanA !== f.costoPlanB;

                    return (
                      <Table.Tr
                        key={`${f.tareaId ?? 'nueva'}-${f.codigo}`}
                        bg={FONDO_ESTADO[f.estado]}
                      >
                        <Table.Td fw={700}>{f.codigo}</Table.Td>
                        <Table.Td>{f.nombre}</Table.Td>
                        <Table.Td>
                          <Text size="xs" c="dimmed">
                            {f.nivel}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge color={COLOR_ESTADO[f.estado] ?? 'gray'} variant="light">
                            {f.estado}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          {durCambio ? (
                            <Text size="sm" fw={600} c="blue.7">
                              {f.duracionDiasA ?? '—'} → {f.duracionDiasB ?? '—'}
                            </Text>
                          ) : (
                            <Text size="sm">{f.duracionDiasB ?? f.duracionDiasA ?? '—'}</Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          {inicioCambio ? (
                            <Text size="xs" fw={600} c="blue.7">
                              {f.inicioPlanA ? formatearFecha(f.inicioPlanA) : '—'} →{' '}
                              {f.inicioPlanB ? formatearFecha(f.inicioPlanB) : '—'}
                            </Text>
                          ) : (
                            <Text size="xs">
                              {f.inicioPlanB ? formatearFecha(f.inicioPlanB) : '—'}
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          {finCambio ? (
                            <Text size="xs" fw={600} c="blue.7">
                              {f.finPlanA ? formatearFecha(f.finPlanA) : '—'} →{' '}
                              {f.finPlanB ? formatearFecha(f.finPlanB) : '—'}
                            </Text>
                          ) : (
                            <Text size="xs">{f.finPlanB ? formatearFecha(f.finPlanB) : '—'}</Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          {costoCambio ? (
                            <Text size="sm" fw={600} c="blue.7">
                              {formatearMonto(f.costoPlanA ?? 0)} →{' '}
                              {formatearMonto(f.costoPlanB ?? 0)}
                            </Text>
                          ) : (
                            <Text size="sm">
                              {formatearMonto(f.costoPlanB ?? f.costoPlanA ?? 0)}
                            </Text>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
                <Table.Tfoot>
                  <Table.Tr
                    style={{ fontWeight: 700, backgroundColor: 'var(--mantine-color-gray-1)' }}
                  >
                    <Table.Td colSpan={4}>Totales del proyecto</Table.Td>
                    <Table.Td>
                      {comparacion.totales.diferenciaDiasFinProyecto !== null &&
                      comparacion.totales.diferenciaDiasFinProyecto !== 0 ? (
                        <Text size="sm" fw={700} c="blue.7">
                          {comparacion.totales.diferenciaDiasFinProyecto > 0 ? '+' : ''}
                          {comparacion.totales.diferenciaDiasFinProyecto} días fin
                        </Text>
                      ) : (
                        '—'
                      )}
                    </Table.Td>
                    <Table.Td>
                      {comparacion.totales.fechaFinProyectoA
                        ? formatearFecha(comparacion.totales.fechaFinProyectoA)
                        : '—'}
                    </Table.Td>
                    <Table.Td>
                      {comparacion.totales.fechaFinProyectoB
                        ? formatearFecha(comparacion.totales.fechaFinProyectoB)
                        : '—'}
                    </Table.Td>
                    <Table.Td>
                      <Text
                        size="sm"
                        fw={700}
                        c={
                          comparacion.totales.diferenciaCostoTotal > 0
                            ? 'red'
                            : comparacion.totales.diferenciaCostoTotal < 0
                              ? 'teal'
                              : undefined
                        }
                      >
                        {formatearMonto(comparacion.totales.costoPlanTotalA)} →{' '}
                        {formatearMonto(comparacion.totales.costoPlanTotalB)}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                </Table.Tfoot>
              </Table>
            </Table.ScrollContainer>
          </Stack>
        )}
      </Stack>
    </Card>
  );
}
