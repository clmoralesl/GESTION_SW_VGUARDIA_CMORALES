import { Badge, Box, Card, Group, Stack, Table, Text, Title } from '@mantine/core';
import type { TableroProyecto } from '@autofix/core';

interface PanelAlertasProps {
  alertas: TableroProyecto['alertas'];
}

function colorSeveridad(severidad: string): string {
  switch (severidad) {
    case 'CRITICA':
      return 'red';
    case 'ADVERTENCIA':
      return 'yellow';
    case 'INFO':
    default:
      return 'blue';
  }
}

export function PanelAlertas({ alertas }: PanelAlertasProps) {
  return (
    <Card withBorder padding="md" radius="md">
      <Stack gap="xs">
        <Group justify="space-between">
          <Title order={5}>Alertas activas ({alertas.length})</Title>
        </Group>

        {alertas.length === 0 ? (
          <Box p="md" ta="center">
            <Text size="sm" c="dimmed">
              No hay alertas activas en el proyecto.
            </Text>
          </Box>
        ) : (
          <Table.ScrollContainer minWidth={500}>
            <Table verticalSpacing="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Tipo</Table.Th>
                  <Table.Th>Severidad</Table.Th>
                  <Table.Th>Mensaje</Table.Th>
                  <Table.Th>Origen</Table.Th>
                  <Table.Th>Fecha</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {alertas.map((a) => (
                  <Table.Tr key={a.id}>
                    <Table.Td>
                      <Badge variant="outline" size="sm">
                        {a.tipo}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={colorSeveridad(a.severidad)} size="sm">
                        {a.severidad}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{a.mensaje}</Table.Td>
                    <Table.Td>{a.entidad ?? '—'}</Table.Td>
                    <Table.Td style={{ whiteSpace: 'nowrap' }}>
                      <Text size="xs" c="dimmed">
                        {new Date(a.creadaEn).toLocaleDateString('es-CL')}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Stack>
    </Card>
  );
}
