import { Badge, Box, Card, Group, ScrollArea, Stack, Text, UnstyledButton } from '@mantine/core';
import type { EstadoEtapa } from '@autofix/core';
import type { DetalleEtapaCambio } from '../api/cambios';

interface LineaTiempoEtapasProps {
  etapas: readonly DetalleEtapaCambio[];
  etapaSeleccionada: number;
  onSeleccionarEtapa: (numero: number) => void;
}

const colorPorEstado: Record<EstadoEtapa, string> = {
  PENDIENTE: 'gray',
  EN_CURSO: 'blue',
  COMPLETADA: 'green',
  OMITIDA: 'orange',
};

const etiquetaEstado: Record<EstadoEtapa, string> = {
  PENDIENTE: 'Pendiente',
  EN_CURSO: 'En curso',
  COMPLETADA: 'Completada',
  OMITIDA: 'Omitida',
};

export function LineaTiempoEtapas({
  etapas,
  etapaSeleccionada,
  onSeleccionarEtapa,
}: LineaTiempoEtapasProps) {
  const etapasOrdenadas = etapas.slice().sort((a, b) => a.numero - b.numero);

  return (
    <Card withBorder p="md" radius="md">
      <Stack gap="xs">
        <Group justify="space-between">
          <Text fw={600} size="sm">
            Línea de tiempo de las 10 etapas
          </Text>
          <Text size="xs" c="dimmed">
            Haga clic en una etapa para ver sus detalles y gestionar acciones
          </Text>
        </Group>
        <ScrollArea type="auto" offsetScrollbars>
          <Group gap="xs" wrap="nowrap" py="xs">
            {etapasOrdenadas.map((e) => {
              const esSeleccionada = e.numero === etapaSeleccionada;
              return (
                <UnstyledButton
                  key={e.numero}
                  onClick={() => onSeleccionarEtapa(e.numero)}
                  style={{ flexShrink: 0 }}
                  aria-label={`Etapa ${e.numero}: ${e.nombre}`}
                >
                  <Card
                    withBorder
                    p="xs"
                    radius="md"
                    style={{
                      width: 170,
                      minHeight: 110,
                      borderColor: esSeleccionada ? 'var(--mantine-color-blue-filled)' : undefined,
                      borderWidth: esSeleccionada ? 2 : 1,
                      backgroundColor: esSeleccionada
                        ? 'var(--mantine-color-blue-light)'
                        : undefined,
                      cursor: 'pointer',
                    }}
                  >
                    <Stack gap={4} justify="space-between" h="100%">
                      <Group justify="space-between" wrap="nowrap">
                        <Text size="xs" fw={700} c="dimmed">
                          Etapa {e.numero}
                        </Text>
                        <Badge size="xs" color={colorPorEstado[e.estado]} variant="filled">
                          {etiquetaEstado[e.estado]}
                        </Badge>
                      </Group>
                      <Text size="xs" fw={600} lineClamp={2} title={e.nombre}>
                        {e.nombre}
                      </Text>
                      <Box mt="auto">
                        <Text size="xs" c="dimmed">
                          Duración:{' '}
                          <Text component="span" fw={600} c="inherit">
                            {e.duracionRealDias !== null ? `${e.duracionRealDias} d` : '—'}
                          </Text>
                        </Text>
                      </Box>
                    </Stack>
                  </Card>
                </UnstyledButton>
              );
            })}
          </Group>
        </ScrollArea>
      </Stack>
    </Card>
  );
}
