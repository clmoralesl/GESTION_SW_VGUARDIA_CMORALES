import { useMemo } from 'react';
import {
  Badge,
  Button,
  Grid,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import {
  CATEGORIAS_CAMBIO,
  nivelRiesgo,
  PRIORIDADES_SOLICITUD,
  type CategoriaCambio,
  type EntradaCrearSolicitud,
  type NivelRiesgo,
  type PrioridadSolicitud,
} from '@autofix/core';
import type { DetalleSolicitudCambio } from '../api/cambios';

interface FormularioSolicitudProps {
  solicitud?: DetalleSolicitudCambio | null;
  onSubmit: (valores: EntradaCrearSolicitud) => void;
  onCancel: () => void;
  cargando?: boolean;
}

const colorNivelRiesgo: Record<NivelRiesgo, string> = {
  BAJO: 'teal',
  MEDIO: 'blue',
  ALTO: 'orange',
  CRITICO: 'red',
};

export function FormularioSolicitud({
  solicitud,
  onSubmit,
  onCancel,
  cargando = false,
}: FormularioSolicitudProps) {
  const form = useForm<EntradaCrearSolicitud>({
    initialValues: {
      titulo: solicitud?.titulo ?? '',
      descripcion: solicitud?.descripcion ?? '',
      justificacion: solicitud?.justificacion ?? '',
      solicitante: solicitud?.solicitante ?? '',
      responsable: solicitud?.responsable ?? '',
      prioridad: (solicitud?.prioridad ?? 'MEDIA') as PrioridadSolicitud,
      categoria: (solicitud?.categoria ?? 'ALCANCE') as CategoriaCambio,
      probabilidadRiesgo: solicitud?.probabilidadRiesgo ?? 3,
      impactoRiesgo: solicitud?.impactoRiesgo ?? 3,
    },
    validate: {
      titulo: (v) =>
        v.trim().length >= 3 && v.trim().length <= 200
          ? null
          : 'El título debe tener entre 3 y 200 caracteres.',
      descripcion: (v) =>
        v.trim().length >= 3 ? null : 'La descripción debe tener al menos 3 caracteres.',
      justificacion: (v) =>
        v.trim().length >= 3 ? null : 'La justificación debe tener al menos 3 caracteres.',
      solicitante: (v) =>
        v.trim().length >= 2 && v.trim().length <= 120
          ? null
          : 'El solicitante debe tener entre 2 y 120 caracteres.',
      responsable: (v) =>
        v.trim().length >= 2 && v.trim().length <= 120
          ? null
          : 'El responsable debe tener entre 2 y 120 caracteres.',
      probabilidadRiesgo: (v) => (v >= 1 && v <= 5 ? null : 'Debe estar entre 1 y 5.'),
      impactoRiesgo: (v) => (v >= 1 && v <= 5 ? null : 'Debe estar entre 1 y 5.'),
    },
  });

  const riesgoCalculado = useMemo(
    () => nivelRiesgo(form.values.probabilidadRiesgo, form.values.impactoRiesgo),
    [form.values.probabilidadRiesgo, form.values.impactoRiesgo],
  );

  return (
    <form onSubmit={form.onSubmit(onSubmit)}>
      <Stack gap="sm">
        <TextInput
          label="Título de la solicitud"
          placeholder="Ej. Ampliación de memoria RAM en servidores"
          required
          {...form.getInputProps('titulo')}
        />

        <Grid gutter="sm">
          <Grid.Col span={6}>
            <TextInput
              label="Solicitante"
              placeholder="Nombre de quien solicita el cambio"
              required
              {...form.getInputProps('solicitante')}
            />
          </Grid.Col>
          <Grid.Col span={6}>
            <TextInput
              label="Responsable"
              placeholder="Nombre del responsable de gestionar el cambio"
              required
              {...form.getInputProps('responsable')}
            />
          </Grid.Col>
        </Grid>

        <Grid gutter="sm">
          <Grid.Col span={6}>
            <Select
              label="Prioridad"
              data={PRIORIDADES_SOLICITUD.map((p) => ({ value: p, label: p }))}
              required
              {...form.getInputProps('prioridad')}
            />
          </Grid.Col>
          <Grid.Col span={6}>
            <Select
              label="Categoría"
              data={CATEGORIAS_CAMBIO.map((c) => ({ value: c, label: c }))}
              required
              {...form.getInputProps('categoria')}
            />
          </Grid.Col>
        </Grid>

        <Textarea
          label="Descripción"
          placeholder="Detalle claro y completo del cambio requerido"
          minRows={2}
          required
          {...form.getInputProps('descripcion')}
        />

        <Textarea
          label="Justificación"
          placeholder="Motivos, beneficios y necesidades que sustentan el cambio"
          minRows={2}
          required
          {...form.getInputProps('justificacion')}
        />

        <Grid gutter="sm">
          <Grid.Col span={4}>
            <NumberInput
              label="Probabilidad (1 a 5)"
              min={1}
              max={5}
              required
              {...form.getInputProps('probabilidadRiesgo')}
            />
          </Grid.Col>
          <Grid.Col span={4}>
            <NumberInput
              label="Impacto (1 a 5)"
              min={1}
              max={5}
              required
              {...form.getInputProps('impactoRiesgo')}
            />
          </Grid.Col>
          <Grid.Col span={4}>
            <Stack gap={4}>
              <Text size="sm" fw={500}>
                Nivel de riesgo
              </Text>
              <Group h={36} align="center">
                <Badge color={colorNivelRiesgo[riesgoCalculado]} variant="filled" size="lg">
                  {riesgoCalculado} ({form.values.probabilidadRiesgo * form.values.impactoRiesgo})
                </Badge>
              </Group>
            </Stack>
          </Grid.Col>
        </Grid>

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onCancel} disabled={cargando}>
            Cancelar
          </Button>
          <Button type="submit" loading={cargando}>
            {solicitud ? 'Guardar cambios' : 'Crear solicitud'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
