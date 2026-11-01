import { Badge, Card, Group, SimpleGrid, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconActivity, IconChartBar, IconClockPlay, IconCoin } from '@tabler/icons-react';
import { formatearMonto, type TableroProyecto } from '@autofix/core';
import { obtenerColorSemaforo } from '../kpi/formato-kpi';

interface TarjetasResumenProps {
  tarjetas: TableroProyecto['tarjetas'];
}

export function TarjetasResumen({ tarjetas }: TarjetasResumenProps) {
  const { avance, spi, cpi, costo } = tarjetas;

  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
      <Card withBorder padding="md" radius="md">
        <Stack gap="xs">
          <Group justify="space-between">
            <Group gap="xs">
              <ThemeIcon color="blue" variant="light" size="md">
                <IconClockPlay size={18} />
              </ThemeIcon>
              <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                % Avance (Proyecto completo)
              </Text>
            </Group>
            {avance.semaforo ? (
              <Badge color={obtenerColorSemaforo(avance.semaforo)} size="sm">
                {avance.semaforo}
              </Badge>
            ) : null}
          </Group>
          <Group align="baseline" gap="xs">
            <Text size="xl" fw={700}>
              {avance.real !== null ? `${avance.real}%` : 'N/D'}
            </Text>
            <Text size="sm" c="dimmed">
              / Plan {avance.plan !== null ? `${avance.plan}%` : 'N/D'}
            </Text>
          </Group>
          <Text size="xs" c="dimmed">
            Variación:{' '}
            {avance.variacion !== null
              ? `${avance.variacion > 0 ? '+' : ''}${avance.variacion}%`
              : 'Sin medición anterior'}
          </Text>
          {avance.notaColor ? (
            <Text size="xs" c="dimmed">
              ({avance.notaColor})
            </Text>
          ) : null}
        </Stack>
      </Card>

      <Card withBorder padding="md" radius="md">
        <Stack gap="xs">
          <Group justify="space-between">
            <Group gap="xs">
              <ThemeIcon color="teal" variant="light" size="md">
                <IconActivity size={18} />
              </ThemeIcon>
              <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                SPI (Proyecto completo)
              </Text>
            </Group>
            {spi.semaforo ? (
              <Badge color={obtenerColorSemaforo(spi.semaforo)} size="sm">
                {spi.semaforo}
              </Badge>
            ) : null}
          </Group>
          <Group align="baseline" gap="xs">
            <Text size="xl" fw={700}>
              {spi.valor !== null ? spi.valor : 'N/D'}
            </Text>
          </Group>
          <Text size="xs" c="dimmed">
            Variación:{' '}
            {spi.variacion !== null
              ? `${spi.variacion > 0 ? '+' : ''}${spi.variacion}`
              : 'Sin medición anterior'}
          </Text>
        </Stack>
      </Card>

      <Card withBorder padding="md" radius="md">
        <Stack gap="xs">
          <Group justify="space-between">
            <Group gap="xs">
              <ThemeIcon color="cyan" variant="light" size="md">
                <IconChartBar size={18} />
              </ThemeIcon>
              <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                CPI (Proyecto completo)
              </Text>
            </Group>
            {cpi.semaforo ? (
              <Badge color={obtenerColorSemaforo(cpi.semaforo)} size="sm">
                {cpi.semaforo}
              </Badge>
            ) : null}
          </Group>
          <Group align="baseline" gap="xs">
            <Text size="xl" fw={700}>
              {cpi.valor !== null ? cpi.valor : 'N/D'}
            </Text>
          </Group>
          <Text size="xs" c="dimmed">
            Variación:{' '}
            {cpi.variacion !== null
              ? `${cpi.variacion > 0 ? '+' : ''}${cpi.variacion}`
              : 'Sin medición anterior'}
          </Text>
        </Stack>
      </Card>

      <Card withBorder padding="md" radius="md">
        <Stack gap="xs">
          <Group justify="space-between">
            <Group gap="xs">
              <ThemeIcon color="orange" variant="light" size="md">
                <IconCoin size={18} />
              </ThemeIcon>
              <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                Costo (Proyecto completo)
              </Text>
            </Group>
            {costo.semaforo ? (
              <Badge color={obtenerColorSemaforo(costo.semaforo)} size="sm">
                {costo.semaforo}
              </Badge>
            ) : null}
          </Group>
          <Group align="baseline" gap="xs">
            <Text size="lg" fw={700}>
              {formatearMonto(costo.costoReal)}
            </Text>
            <Text size="xs" c="dimmed">
              / {formatearMonto(costo.presupuesto)} (
              {costo.porcentaje !== null ? `${costo.porcentaje}%` : 'N/D'})
            </Text>
          </Group>
          <Text size="xs" c="dimmed">
            Variación CV:{' '}
            {costo.variacion !== null
              ? `${costo.variacion > 0 ? '+' : ''}${costo.variacion}%`
              : 'Sin medición anterior'}
          </Text>
        </Stack>
      </Card>
    </SimpleGrid>
  );
}
