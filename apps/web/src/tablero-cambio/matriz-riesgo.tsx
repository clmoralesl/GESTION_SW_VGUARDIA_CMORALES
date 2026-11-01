import { Badge, Box, Card, Group, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { Link } from 'react-router';
import type { NivelRiesgo, PrioridadSolicitud, TableroCambio } from '@autofix/core';

interface MatrizRiesgoProps {
  matriz: TableroCambio['matrizRiesgo'];
}

const COLOR_NIVEL_FONDO: Record<NivelRiesgo, string> = {
  BAJO: '#ebfbee',
  MEDIO: '#fff9db',
  ALTO: '#ffe8cc',
  CRITICO: '#ffe3e3',
};

const COLOR_NIVEL_BORDE: Record<NivelRiesgo, string> = {
  BAJO: '#b2f2bb',
  MEDIO: '#ffe066',
  ALTO: '#ffc078',
  CRITICO: '#ffa8a8',
};

const COLOR_PRIORIDAD: Record<PrioridadSolicitud, string> = {
  BAJA: 'blue',
  MEDIA: 'yellow',
  ALTA: 'orange',
  CRITICA: 'red',
};

export function MatrizRiesgo({ matriz }: MatrizRiesgoProps) {
  return (
    <Card withBorder padding="md" radius="md">
      <Stack gap="md">
        <Group justify="space-between">
          <Title order={4}>Matriz de riesgo 5×5 (Probabilidad × Impacto)</Title>
          <Group gap="xs">
            <Badge color="teal" variant="light" size="xs">
              Bajo (1-4)
            </Badge>
            <Badge color="yellow" variant="light" size="xs">
              Medio (5-9)
            </Badge>
            <Badge color="orange" variant="light" size="xs">
              Alto (10-14)
            </Badge>
            <Badge color="red" variant="light" size="xs">
              Crítico (15-25)
            </Badge>
          </Group>
        </Group>

        <Box style={{ overflowX: 'auto' }}>
          <Box style={{ minWidth: 600 }}>
            <Group gap="xs" justify="center" mb="xs">
              <Text size="xs" fw={700} c="dimmed">
                Eje Horizontal: Impacto (1 a 5) | Eje Vertical: Probabilidad (5 a 1)
              </Text>
            </Group>

            <SimpleGrid cols={6} spacing={4}>
              <Box />
              {[1, 2, 3, 4, 5].map((i) => (
                <Box key={`header-${i}`} style={{ textAlign: 'center', padding: 4 }}>
                  <Text size="xs" fw={700}>
                    Impacto {i}
                  </Text>
                </Box>
              ))}

              {[5, 4, 3, 2, 1].map((p) => (
                <Box key={`row-${p}`} style={{ display: 'contents' }}>
                  <Box
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 4,
                    }}
                  >
                    <Text size="xs" fw={700}>
                      Prob. {p}
                    </Text>
                  </Box>
                  {[1, 2, 3, 4, 5].map((i) => {
                    const celda = matriz.find((c) => c.probabilidad === p && c.impacto === i);
                    if (!celda) return <Box key={`empty-${p}-${i}`} />;

                    const colorFondo = COLOR_NIVEL_FONDO[celda.nivel];
                    const colorBorde = COLOR_NIVEL_BORDE[celda.nivel];

                    return (
                      <Box
                        key={`cell-${p}-${i}`}
                        style={{
                          backgroundColor: colorFondo,
                          border: `1px solid ${colorBorde}`,
                          borderRadius: 6,
                          minHeight: 65,
                          padding: 6,
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                        }}
                      >
                        <Group justify="space-between" align="center">
                          <Text size="10px" c="dimmed" fw={600}>
                            {p * i} ({celda.nivel[0]})
                          </Text>
                        </Group>

                        <Group gap={4} wrap="wrap">
                          {celda.solicitudes.map((s) => (
                            <Badge
                              key={s.solicitudId}
                              component={Link}
                              to={`/cambios/${s.solicitudId}`}
                              color={COLOR_PRIORIDAD[s.prioridad]}
                              variant="filled"
                              size="xs"
                              style={{ cursor: 'pointer' }}
                            >
                              {s.codigo}
                            </Badge>
                          ))}
                        </Group>
                      </Box>
                    );
                  })}
                </Box>
              ))}
            </SimpleGrid>
          </Box>
        </Box>
      </Stack>
    </Card>
  );
}
