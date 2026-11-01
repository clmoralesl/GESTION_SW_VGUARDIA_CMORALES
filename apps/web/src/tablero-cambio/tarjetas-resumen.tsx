import { Card, Group, SimpleGrid, Stack, Text, ThemeIcon } from '@mantine/core';
import {
  IconCheck,
  IconClock,
  IconClockPlay,
  IconGitPullRequest,
  IconPercentage,
  IconTrendingUp,
  IconX,
} from '@tabler/icons-react';
import type { TableroCambio } from '@autofix/core';

interface TarjetasResumenProps {
  resumen: TableroCambio['resumen'];
}

export function TarjetasResumen({ resumen }: TarjetasResumenProps) {
  const {
    total,
    abiertas,
    aprobadas,
    rechazadas,
    tasaAprobacion,
    tiempoCicloPromedio,
    adopcionPromedio,
  } = resumen;

  return (
    <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="md">
      <Card withBorder padding="md" radius="md">
        <Stack gap="xs">
          <Group justify="space-between">
            <Text size="xs" c="dimmed" fw={600} tt="uppercase">
              Total solicitudes
            </Text>
            <ThemeIcon color="blue" variant="light" size="md">
              <IconGitPullRequest size={18} />
            </ThemeIcon>
          </Group>
          <Text size="xl" fw={700}>
            {total}
          </Text>
          <Text size="xs" c="dimmed">
            Solicitudes en el proyecto
          </Text>
        </Stack>
      </Card>

      <Card withBorder padding="md" radius="md">
        <Stack gap="xs">
          <Group justify="space-between">
            <Text size="xs" c="dimmed" fw={600} tt="uppercase">
              Solicitudes abiertas
            </Text>
            <ThemeIcon color="violet" variant="light" size="md">
              <IconClockPlay size={18} />
            </ThemeIcon>
          </Group>
          <Text size="xl" fw={700}>
            {abiertas}
          </Text>
          <Text size="xs" c="dimmed">
            En evaluación o implementación
          </Text>
        </Stack>
      </Card>

      <Card withBorder padding="md" radius="md">
        <Stack gap="xs">
          <Group justify="space-between">
            <Text size="xs" c="dimmed" fw={600} tt="uppercase">
              Aprobadas
            </Text>
            <ThemeIcon color="teal" variant="light" size="md">
              <IconCheck size={18} />
            </ThemeIcon>
          </Group>
          <Text size="xl" fw={700}>
            {aprobadas}
          </Text>
          <Text size="xs" c="dimmed">
            Aprobadas, implementadas o cerradas
          </Text>
        </Stack>
      </Card>

      <Card withBorder padding="md" radius="md">
        <Stack gap="xs">
          <Group justify="space-between">
            <Text size="xs" c="dimmed" fw={600} tt="uppercase">
              Rechazadas
            </Text>
            <ThemeIcon color="red" variant="light" size="md">
              <IconX size={18} />
            </ThemeIcon>
          </Group>
          <Text size="xl" fw={700}>
            {rechazadas}
          </Text>
          <Text size="xs" c="dimmed">
            Desestimadas por el comité
          </Text>
        </Stack>
      </Card>

      <Card withBorder padding="md" radius="md">
        <Stack gap="xs">
          <Group justify="space-between">
            <Text size="xs" c="dimmed" fw={600} tt="uppercase">
              Tasa de aprobación
            </Text>
            <ThemeIcon color="cyan" variant="light" size="md">
              <IconPercentage size={18} />
            </ThemeIcon>
          </Group>
          <Text size="xl" fw={700}>
            {tasaAprobacion !== null ? `${tasaAprobacion}%` : 'Sin datos'}
          </Text>
          <Text size="xs" c="dimmed">
            Aprobadas / (Aprobadas + Rechazadas)
          </Text>
        </Stack>
      </Card>

      <Card withBorder padding="md" radius="md">
        <Stack gap="xs">
          <Group justify="space-between">
            <Text size="xs" c="dimmed" fw={600} tt="uppercase">
              Tiempo ciclo promedio
            </Text>
            <ThemeIcon color="orange" variant="light" size="md">
              <IconClock size={18} />
            </ThemeIcon>
          </Group>
          <Text size="xl" fw={700}>
            {tiempoCicloPromedio !== null ? `${tiempoCicloPromedio} días` : 'Sin datos'}
          </Text>
          <Text size="xs" c="dimmed">
            Días corridos de registro a cierre
          </Text>
        </Stack>
      </Card>

      <Card withBorder padding="md" radius="md">
        <Stack gap="xs">
          <Group justify="space-between">
            <Text size="xs" c="dimmed" fw={600} tt="uppercase">
              Adopción promedio
            </Text>
            <ThemeIcon color="green" variant="light" size="md">
              <IconTrendingUp size={18} />
            </ThemeIcon>
          </Group>
          <Text size="xl" fw={700}>
            {adopcionPromedio !== null ? `${adopcionPromedio}%` : 'Sin datos'}
          </Text>
          <Text size="xs" c="dimmed">
            Promedio en solicitudes cerradas
          </Text>
        </Stack>
      </Card>
    </SimpleGrid>
  );
}
