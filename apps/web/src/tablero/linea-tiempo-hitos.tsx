import { Badge, Box, Card, Group, Stack, Text, Timeline, Title } from '@mantine/core';
import { IconAlertTriangle, IconCheck, IconClock, IconX } from '@tabler/icons-react';
import type { EstadoHito, TableroProyecto } from '@autofix/core';

interface LineaTiempoHitosProps {
  hitos: TableroProyecto['hitos'];
  filtroProfesionalActivo: boolean;
}

function iconoHito(estado: EstadoHito) {
  switch (estado) {
    case 'CUMPLIDO':
      return <IconCheck size={14} />;
    case 'EN_RIESGO':
      return <IconAlertTriangle size={14} />;
    case 'ATRASADO':
      return <IconX size={14} />;
    case 'PENDIENTE':
    default:
      return <IconClock size={14} />;
  }
}

function colorHito(estado: EstadoHito) {
  switch (estado) {
    case 'CUMPLIDO':
      return 'teal';
    case 'EN_RIESGO':
      return 'yellow';
    case 'ATRASADO':
      return 'red';
    case 'PENDIENTE':
    default:
      return 'gray';
  }
}

export function LineaTiempoHitos({ hitos, filtroProfesionalActivo }: LineaTiempoHitosProps) {
  const { cumplidos, total, items } = hitos;

  return (
    <Card withBorder padding="md" radius="md">
      <Stack gap="sm">
        <Group justify="space-between" align="center">
          <div>
            <Title order={5}>Hitos del proyecto</Title>
            {filtroProfesionalActivo && (
              <Text size="xs" c="orange" fw={500}>
                El filtro por profesional no aplica a hitos
              </Text>
            )}
          </div>
          <Badge
            size="lg"
            variant="light"
            color={cumplidos === total && total > 0 ? 'teal' : 'blue'}
          >
            {cumplidos} / {total} cumplidos
          </Badge>
        </Group>

        {items.length === 0 ? (
          <Box p="md" ta="center">
            <Text size="sm" c="dimmed">
              No hay hitos para los filtros seleccionados.
            </Text>
          </Box>
        ) : (
          <Box pt="xs" style={{ maxHeight: 280, overflowY: 'auto' }}>
            <Timeline
              active={items.findIndex((i) => i.estado !== 'CUMPLIDO')}
              bulletSize={22}
              lineWidth={2}
            >
              {items.map((h) => (
                <Timeline.Item
                  key={h.id}
                  bullet={iconoHito(h.estado)}
                  color={colorHito(h.estado)}
                  title={
                    <Group gap="xs">
                      <Text size="sm" fw={600}>
                        {h.nombre}
                      </Text>
                      <Badge size="xs" color={colorHito(h.estado)}>
                        {h.estado}
                      </Badge>
                    </Group>
                  }
                >
                  <Text size="xs" c="dimmed">
                    Fecha: {h.fecha}
                  </Text>
                </Timeline.Item>
              ))}
            </Timeline>
          </Box>
        )}
      </Stack>
    </Card>
  );
}
