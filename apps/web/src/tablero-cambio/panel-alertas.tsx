import { Alert, Badge, Card, Grid, Group, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconCalendarDue,
  IconCheck,
} from '@tabler/icons-react';
import { Link } from 'react-router';
import type { TableroCambio } from '@autofix/core';

interface PanelAlertasProps {
  alertas: TableroCambio['alertas'];
}

export function PanelAlertas({ alertas }: PanelAlertasProps) {
  const { etapasVencidas, riesgosAltos, kpiEnRojo } = alertas;
  const sinAlertas =
    etapasVencidas.length === 0 && riesgosAltos.length === 0 && kpiEnRojo.length === 0;

  if (sinAlertas) {
    return (
      <Card withBorder padding="md" radius="md">
        <Stack gap="xs">
          <Title order={4}>Alertas del proceso de cambio</Title>
          <Alert icon={<IconCheck size={18} />} color="teal" variant="light">
            No hay alertas activas en el proceso de cambio para los filtros seleccionados.
          </Alert>
        </Stack>
      </Card>
    );
  }

  return (
    <Card withBorder padding="md" radius="md">
      <Stack gap="md">
        <Group justify="space-between">
          <Title order={4}>Panel de alertas de gestión del cambio</Title>
          <Badge color="red" size="sm">
            {etapasVencidas.length + riesgosAltos.length + kpiEnRojo.length} alertas
          </Badge>
        </Group>

        <Grid gutter="md">
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Card withBorder padding="sm" radius="sm">
              <Stack gap="xs">
                <Group gap="xs">
                  <ThemeIcon color="orange" variant="light" size="sm">
                    <IconCalendarDue size={14} />
                  </ThemeIcon>
                  <Text size="xs" fw={700} tt="uppercase">
                    Etapas vencidas ({etapasVencidas.length})
                  </Text>
                </Group>

                {etapasVencidas.length === 0 ? (
                  <Text size="xs" c="dimmed">
                    Sin etapas vencidas
                  </Text>
                ) : (
                  <Stack gap={6}>
                    {etapasVencidas.map((e) => (
                      <Group
                        key={`${e.solicitudId}-${e.etapaId}`}
                        justify="space-between"
                        p={4}
                        style={{ borderBottom: '1px solid #f1f3f5' }}
                      >
                        <Group gap={6}>
                          <Badge
                            component={Link}
                            to={`/cambios/${e.solicitudId}`}
                            size="xs"
                            color="blue"
                            style={{ cursor: 'pointer' }}
                          >
                            {e.codigo}
                          </Badge>
                          <Text size="xs">Etapa {e.numero}</Text>
                        </Group>
                        <Text size="10px" c="red" fw={600}>
                          Venció: {e.fechaFin}
                        </Text>
                      </Group>
                    ))}
                  </Stack>
                )}
              </Stack>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 4 }}>
            <Card withBorder padding="sm" radius="sm">
              <Stack gap="xs">
                <Group gap="xs">
                  <ThemeIcon color="red" variant="light" size="sm">
                    <IconAlertTriangle size={14} />
                  </ThemeIcon>
                  <Text size="xs" fw={700} tt="uppercase">
                    Riesgos altos ({riesgosAltos.length})
                  </Text>
                </Group>

                {riesgosAltos.length === 0 ? (
                  <Text size="xs" c="dimmed">
                    Sin riesgos altos
                  </Text>
                ) : (
                  <Stack gap={6}>
                    {riesgosAltos.map((r) => (
                      <Group
                        key={r.solicitudId}
                        justify="space-between"
                        p={4}
                        style={{ borderBottom: '1px solid #f1f3f5' }}
                      >
                        <Group gap={6}>
                          <Badge
                            component={Link}
                            to={`/cambios/${r.solicitudId}`}
                            size="xs"
                            color="red"
                            style={{ cursor: 'pointer' }}
                          >
                            {r.codigo}
                          </Badge>
                          <Text size="xs" lineClamp={1} style={{ maxWidth: 120 }}>
                            {r.titulo}
                          </Text>
                        </Group>
                        <Badge size="xs" color="red" variant="light">
                          {r.nivel}
                        </Badge>
                      </Group>
                    ))}
                  </Stack>
                )}
              </Stack>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 4 }}>
            <Card withBorder padding="sm" radius="sm">
              <Stack gap="xs">
                <Group gap="xs">
                  <ThemeIcon color="red" variant="light" size="sm">
                    <IconAlertCircle size={14} />
                  </ThemeIcon>
                  <Text size="xs" fw={700} tt="uppercase">
                    KPI en rojo ({kpiEnRojo.length})
                  </Text>
                </Group>

                {kpiEnRojo.length === 0 ? (
                  <Text size="xs" c="dimmed">
                    Sin indicadores en estado crítico
                  </Text>
                ) : (
                  <Stack gap={6}>
                    {kpiEnRojo.map((k) => (
                      <Stack
                        key={k.alertaId}
                        gap={2}
                        p={4}
                        style={{ borderBottom: '1px solid #f1f3f5' }}
                      >
                        <Text size="xs" c="red" fw={600}>
                          {k.mensaje}
                        </Text>
                        <Text size="10px" c="dimmed">
                          {k.creadaEn.slice(0, 10)}
                        </Text>
                      </Stack>
                    ))}
                  </Stack>
                )}
              </Stack>
            </Card>
          </Grid.Col>
        </Grid>
      </Stack>
    </Card>
  );
}
