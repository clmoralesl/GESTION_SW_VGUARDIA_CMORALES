import { useState } from 'react';
import { Alert, Badge, Button, Card, Grid, Group, Stack, Table, Text, Title } from '@mantine/core';
import { IconAlertCircle, IconPlayerPlay } from '@tabler/icons-react';
import { formatearFecha, formatearMonto, type ResultadoSimulacion } from '@autofix/core';
import { useSimularCambio } from '../api/cambios';

interface PanelSimulacionProps {
  solicitudId: number;
  estado?: string;
}

const COLOR_ESTADO_FILA: Record<string, string> = {
  MODIFICADA: 'blue',
  AGREGADA: 'teal',
  ELIMINADA: 'red',
  IGUAL: 'gray',
};

export function PanelSimulacion({ solicitudId, estado }: PanelSimulacionProps) {
  const [resultado, setResultado] = useState<ResultadoSimulacion | null>(null);
  const [errorSimulacion, setErrorSimulacion] = useState<string | null>(null);

  const simularMutacion = useSimularCambio(solicitudId);
  const puedeSimular =
    estado === undefined || estado === 'REGISTRADA' || estado === 'EN_EVALUACION';

  const handleSimular = () => {
    setErrorSimulacion(null);
    simularMutacion.mutate(undefined, {
      onSuccess: (res) => {
        setResultado(res);
      },
      onError: (err) => {
        setErrorSimulacion(err.message || 'Error al ejecutar la simulación de impacto.');
        setResultado(null);
      },
    });
  };

  return (
    <Card withBorder radius="md" p="md">
      <Stack gap="md">
        <Group justify="space-between" align="center" wrap="wrap">
          <div>
            <Title order={4}>Simulación de impacto del cambio</Title>
            <Text size="sm" c="dimmed">
              Calcula cómo afectarán los impactos registrados al cronograma, costos y KPIs sin
              alterar el proyecto.
            </Text>
          </div>

          <Button
            leftSection={<IconPlayerPlay size={16} />}
            variant="light"
            color="blue"
            disabled={!puedeSimular}
            loading={simularMutacion.isPending}
            onClick={handleSimular}
          >
            Simular impacto
          </Button>
        </Group>

        {errorSimulacion && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            color="red"
            title="Error en la simulación"
            withCloseButton
            onClose={() => setErrorSimulacion(null)}
          >
            {errorSimulacion}
          </Alert>
        )}

        {resultado && (
          <Stack gap="md" mt="xs">
            <Grid gutter="md">
              <Grid.Col span={{ base: 12, md: 6 }}>
                <Card withBorder radius="sm" p="sm" bg="var(--mantine-color-gray-0)">
                  <Title order={5} mb="xs" c="dimmed">
                    Situación actual (Antes)
                  </Title>
                  <Grid gutter="xs">
                    <Grid.Col span={6}>
                      <Text size="xs" c="dimmed">
                        Fin del proyecto
                      </Text>
                      <Text size="sm" fw={600}>
                        {resultado.antes.fechaFinProyecto
                          ? formatearFecha(resultado.antes.fechaFinProyecto)
                          : '—'}
                      </Text>
                    </Grid.Col>
                    <Grid.Col span={6}>
                      <Text size="xs" c="dimmed">
                        Costo planificado
                      </Text>
                      <Text size="sm" fw={600}>
                        {formatearMonto(resultado.antes.costoPlanTotal)}
                      </Text>
                    </Grid.Col>
                    <Grid.Col span={6}>
                      <Text size="xs" c="dimmed">
                        Presupuesto
                      </Text>
                      <Text size="sm" fw={600}>
                        {formatearMonto(resultado.antes.presupuesto)}
                      </Text>
                    </Grid.Col>
                    <Grid.Col span={6}>
                      <Text size="xs" c="dimmed">
                        SPI / CPI
                      </Text>
                      <Text size="sm" fw={600}>
                        {resultado.antes.spi !== null ? resultado.antes.spi.toFixed(2) : '—'} /{' '}
                        {resultado.antes.cpi !== null ? resultado.antes.cpi.toFixed(2) : '—'}
                      </Text>
                    </Grid.Col>
                  </Grid>
                </Card>
              </Grid.Col>

              <Grid.Col span={{ base: 12, md: 6 }}>
                <Card withBorder radius="sm" p="sm" bg="var(--mantine-color-blue-0)">
                  <Title order={5} mb="xs" c="blue.7">
                    Proyección simulada (Después)
                  </Title>
                  <Grid gutter="xs">
                    <Grid.Col span={6}>
                      <Text size="xs" c="dimmed">
                        Fin del proyecto
                      </Text>
                      <Text
                        size="sm"
                        fw={600}
                        c={
                          resultado.despues.fechaFinProyecto !== resultado.antes.fechaFinProyecto
                            ? 'blue.8'
                            : undefined
                        }
                      >
                        {resultado.despues.fechaFinProyecto
                          ? formatearFecha(resultado.despues.fechaFinProyecto)
                          : '—'}
                      </Text>
                    </Grid.Col>
                    <Grid.Col span={6}>
                      <Text size="xs" c="dimmed">
                        Costo planificado
                      </Text>
                      <Text
                        size="sm"
                        fw={600}
                        c={
                          resultado.despues.costoPlanTotal !== resultado.antes.costoPlanTotal
                            ? 'blue.8'
                            : undefined
                        }
                      >
                        {formatearMonto(resultado.despues.costoPlanTotal)}
                      </Text>
                    </Grid.Col>
                    <Grid.Col span={6}>
                      <Text size="xs" c="dimmed">
                        Presupuesto
                      </Text>
                      <Text
                        size="sm"
                        fw={600}
                        c={
                          resultado.despues.presupuesto !== resultado.antes.presupuesto
                            ? 'blue.8'
                            : undefined
                        }
                      >
                        {formatearMonto(resultado.despues.presupuesto)}
                      </Text>
                    </Grid.Col>
                    <Grid.Col span={6}>
                      <Text size="xs" c="dimmed">
                        SPI / CPI
                      </Text>
                      <Text size="sm" fw={600}>
                        {resultado.despues.spi !== null ? resultado.despues.spi.toFixed(2) : '—'} /{' '}
                        {resultado.despues.cpi !== null ? resultado.despues.cpi.toFixed(2) : '—'}
                      </Text>
                    </Grid.Col>
                  </Grid>
                </Card>
              </Grid.Col>
            </Grid>

            <div>
              <Title order={5} mb="xs">
                Tareas afectadas ({resultado.tareasAfectadas.length})
              </Title>
              {resultado.tareasAfectadas.length === 0 ? (
                <Text size="sm" c="dimmed">
                  El cambio no modifica las fechas ni los costos de las tareas existentes.
                </Text>
              ) : (
                <Table.ScrollContainer minWidth={600}>
                  <Table striped highlightOnHover verticalSpacing="xs">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th style={{ width: 80 }}>Código</Table.Th>
                        <Table.Th>Nombre</Table.Th>
                        <Table.Th style={{ width: 100 }}>Nivel</Table.Th>
                        <Table.Th style={{ width: 110 }}>Estado</Table.Th>
                        <Table.Th style={{ width: 120 }}>Dif. Duración</Table.Th>
                        <Table.Th style={{ width: 140 }}>Dif. Costo</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {resultado.tareasAfectadas.map((f) => (
                        <Table.Tr key={`${f.tareaId}-${f.codigo}`}>
                          <Table.Td fw={700}>{f.codigo}</Table.Td>
                          <Table.Td>{f.nombre}</Table.Td>
                          <Table.Td>{f.nivel}</Table.Td>
                          <Table.Td>
                            <Badge color={COLOR_ESTADO_FILA[f.estado] ?? 'gray'} variant="light">
                              {f.estado}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            {f.diferenciaDuracionDias !== null && f.diferenciaDuracionDias !== 0 ? (
                              <Text
                                size="sm"
                                fw={600}
                                c={f.diferenciaDuracionDias > 0 ? 'red' : 'teal'}
                              >
                                {f.diferenciaDuracionDias > 0
                                  ? `+${f.diferenciaDuracionDias}`
                                  : f.diferenciaDuracionDias}{' '}
                                días
                              </Text>
                            ) : (
                              <Text size="sm" c="dimmed">
                                0
                              </Text>
                            )}
                          </Table.Td>
                          <Table.Td>
                            {f.diferenciaCostoPlan !== null && f.diferenciaCostoPlan !== 0 ? (
                              <Text
                                size="sm"
                                fw={600}
                                c={f.diferenciaCostoPlan > 0 ? 'red' : 'teal'}
                              >
                                {f.diferenciaCostoPlan > 0
                                  ? `+${formatearMonto(f.diferenciaCostoPlan)}`
                                  : formatearMonto(f.diferenciaCostoPlan)}
                              </Text>
                            ) : (
                              <Text size="sm" c="dimmed">
                                $0
                              </Text>
                            )}
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              )}
            </div>
          </Stack>
        )}
      </Stack>
    </Card>
  );
}
