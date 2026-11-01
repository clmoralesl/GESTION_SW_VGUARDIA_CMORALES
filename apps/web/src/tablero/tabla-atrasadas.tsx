import { useNavigate } from 'react-router';
import { Badge, Box, Card, Stack, Table, Text, Title } from '@mantine/core';
import type { TableroProyecto } from '@autofix/core';

interface TablaAtrasadasProps {
  atrasadas: TableroProyecto['atrasadas'];
}

export function TablaAtrasadas({ atrasadas }: TablaAtrasadasProps) {
  const navigate = useNavigate();

  return (
    <Card withBorder padding="md" radius="md">
      <Stack gap="xs">
        <Title order={5}>Tareas atrasadas ({atrasadas.length})</Title>

        {atrasadas.length === 0 ? (
          <Box p="md" ta="center">
            <Text size="sm" c="dimmed">
              No hay tareas atrasadas en el proyecto.
            </Text>
          </Box>
        ) : (
          <Table.ScrollContainer minWidth={450}>
            <Table highlightOnHover verticalSpacing="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Código</Table.Th>
                  <Table.Th>Nombre</Table.Th>
                  <Table.Th ta="center">Días de atraso</Table.Th>
                  <Table.Th>Responsable</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {atrasadas.map((t) => (
                  <Table.Tr
                    key={t.tareaId}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/gantt?tarea=${t.tareaId}`)}
                    tabIndex={0}
                    role="button"
                    aria-label={`Ver tarea ${t.codigo} en Gantt`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(`/gantt?tarea=${t.tareaId}`);
                      }
                    }}
                  >
                    <Table.Td fw={600}>{t.codigo}</Table.Td>
                    <Table.Td>{t.nombre}</Table.Td>
                    <Table.Td ta="center">
                      <Badge color="red" variant="light">
                        {t.diasAtraso} d
                      </Badge>
                    </Table.Td>
                    <Table.Td>{t.responsable ?? '—'}</Table.Td>
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
