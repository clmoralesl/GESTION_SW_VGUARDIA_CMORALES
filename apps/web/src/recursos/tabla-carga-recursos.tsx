import { useState } from 'react';
import {
  Badge,
  Card,
  Center,
  Checkbox,
  Group,
  Loader,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { useCargaRecursos } from '../api/asignaciones';

function formatearCabeceraSemana(semanaIso: string): string {
  const partes = semanaIso.split('-');
  if (partes.length !== 3) return semanaIso;
  return `${partes[2]}/${partes[1]}`;
}

export function TablaCargaRecursos() {
  const [desde, setDesde] = useState('2026-11-02');
  const [hasta, setHasta] = useState('2026-12-28');
  const [soloActivos, setSoloActivos] = useState(true);
  const [soloSobreasignados, setSoloSobreasignados] = useState(false);

  const { data, isLoading, isError } = useCargaRecursos(desde, hasta);

  const profesionales = data?.profesionales ?? [];
  const semanas = data?.semanas ?? [];

  const profesionalesFiltrados = profesionales.filter((p) => {
    if (soloActivos && !p.activo) return false;
    if (soloSobreasignados && !p.celdas.some((c) => c.sobreasignada)) return false;
    return true;
  });

  return (
    <Stack gap="md">
      <Card withBorder radius="md" p="md">
        <Group justify="space-between" align="flex-end" wrap="wrap" gap="md">
          <Group gap="md" align="flex-end">
            <TextInput
              label="Desde (lunes)"
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.currentTarget.value)}
            />
            <TextInput
              label="Hasta (domingo)"
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.currentTarget.value)}
            />
          </Group>

          <Group gap="md">
            <Checkbox
              label="Solo activos"
              checked={soloActivos}
              onChange={(e) => setSoloActivos(e.currentTarget.checked)}
            />
            <Checkbox
              label="Solo sobreasignados"
              checked={soloSobreasignados}
              onChange={(e) => setSoloSobreasignados(e.currentTarget.checked)}
            />
          </Group>
        </Group>
      </Card>

      <Card withBorder radius="md" p="md">
        <Group justify="space-between" mb="md">
          <Title order={4}>Distribución semanal de carga</Title>
          <Group gap="xs">
            <Badge color="red" variant="filled" size="sm">
              Sobreasignado (algún día &gt; 100 %)
            </Badge>
            <Badge color="yellow" variant="light" size="sm">
              80% - 100% Carga alta
            </Badge>
            <Badge color="gray" variant="light" size="sm">
              &lt; 80% Normal
            </Badge>
          </Group>
        </Group>

        {isLoading ? (
          <Center p="xl">
            <Loader size="md" />
          </Center>
        ) : isError ? (
          <Text color="red" size="sm">
            Error al consultar la carga de recursos.
          </Text>
        ) : profesionalesFiltrados.length === 0 ? (
          <Text size="sm" c="dimmed">
            No se encontraron profesionales para el rango seleccionado.
          </Text>
        ) : (
          <Table.ScrollContainer minWidth={700}>
            <Table withTableBorder withColumnBorders striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ minWidth: 200 }}>Profesional</Table.Th>
                  {semanas.map((s) => (
                    <Table.Th key={s} style={{ textAlign: 'center', minWidth: 70 }}>
                      Sem. {formatearCabeceraSemana(s)}
                    </Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {profesionalesFiltrados.map((p) => {
                  const tieneSobrecarga = p.celdas.some((c) => c.sobreasignada);
                  return (
                    <Table.Tr key={p.id}>
                      <Table.Td>
                        <Group justify="space-between" wrap="nowrap">
                          <Text size="sm" fw={500} c={p.activo ? undefined : 'dimmed'}>
                            {p.nombre}
                          </Text>
                          {tieneSobrecarga && (
                            <Tooltip label="Presenta sobreasignación en el período">
                              <IconAlertTriangle size={16} color="red" />
                            </Tooltip>
                          )}
                        </Group>
                      </Table.Td>
                      {p.celdas.map((c) => {
                        const esSobre = c.sobreasignada;
                        const esAlta = !esSobre && c.porcentaje >= 80;
                        const fondo = esSobre ? '#ffe3e3' : esAlta ? '#fff3bf' : undefined;
                        const colorTexto = esSobre
                          ? '#c92a2a'
                          : esAlta
                            ? '#d97706'
                            : c.porcentaje > 0
                              ? undefined
                              : 'dimmed';

                        return (
                          <Table.Td
                            key={c.semana}
                            style={{
                              textAlign: 'center',
                              backgroundColor: fondo,
                              color: colorTexto,
                              fontWeight: esSobre ? 700 : esAlta ? 600 : undefined,
                            }}
                          >
                            {c.porcentaje > 0 ? `${c.porcentaje}%` : '—'}
                          </Table.Td>
                        );
                      })}
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Card>
    </Stack>
  );
}
