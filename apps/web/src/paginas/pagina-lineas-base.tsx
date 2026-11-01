import { useNavigate, useParams } from 'react-router';
import { Button, Container, Group, Loader, Stack, Text } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { useProyecto } from '../api/proyectos';
import { ComparadorLineasBase } from '../lineas-base/comparador-lineas-base';

export function PaginaLineasBase() {
  const { proyectoId } = useParams();
  const idNumerico = Number(proyectoId);
  const navigate = useNavigate();

  const { data: proyecto, isLoading } = useProyecto(idNumerico, { silenciarError: true });

  if (isLoading) {
    return (
      <Container size="xl" py="xl">
        <Group justify="center" p="xl">
          <Loader size="md" />
        </Group>
      </Container>
    );
  }

  return (
    <Container size="xl" py="lg">
      <Stack gap="lg">
        <Group justify="space-between" align="center">
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate(proyecto ? `/proyectos/${proyecto.id}` : '/proyectos')}
            size="sm"
          >
            Volver a {proyecto ? proyecto.nombre : 'proyectos'}
          </Button>

          {proyecto && (
            <Text size="sm" c="dimmed">
              Proyecto: <strong>{proyecto.nombre}</strong>
            </Text>
          )}
        </Group>

        <ComparadorLineasBase proyectoId={idNumerico} />
      </Stack>
    </Container>
  );
}
