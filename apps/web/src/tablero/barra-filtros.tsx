import { Button, Card, Group, Select, TextInput } from '@mantine/core';
import { IconFilterOff } from '@tabler/icons-react';
import type { ConsultaTablero, TableroProyecto } from '@autofix/core';

interface BarraFiltrosProps {
  opciones: TableroProyecto['opciones'];
  filtros: ConsultaTablero;
  alCambiarFiltros: (nuevos: ConsultaTablero) => void;
}

export function BarraFiltros({ opciones, filtros, alCambiarFiltros }: BarraFiltrosProps) {
  const etapasOpciones = opciones.etapas.map((e) => ({
    value: String(e.id),
    label: `${e.codigo}. ${e.nombre}`,
  }));

  const profesionalesOpciones = opciones.profesionales.map((p) => ({
    value: String(p.id),
    label: p.nombre,
  }));

  const hayFiltrosActivos =
    filtros.etapaId !== undefined ||
    filtros.profesionalId !== undefined ||
    (filtros.desde !== undefined && filtros.desde !== '') ||
    (filtros.hasta !== undefined && filtros.hasta !== '');

  const limpiar = () => {
    alCambiarFiltros({});
  };

  return (
    <Card withBorder padding="sm" radius="md">
      <Group gap="sm" align="flex-end">
        <Select
          label="Etapa"
          placeholder="Todas las etapas"
          data={etapasOpciones}
          value={filtros.etapaId ? String(filtros.etapaId) : null}
          onChange={(val) =>
            alCambiarFiltros({
              ...filtros,
              etapaId: val ? Number(val) : undefined,
            })
          }
          clearable
          style={{ minWidth: 200, flex: 1 }}
        />

        <Select
          label="Profesional"
          placeholder="Todos los profesionales"
          data={profesionalesOpciones}
          value={filtros.profesionalId ? String(filtros.profesionalId) : null}
          onChange={(val) =>
            alCambiarFiltros({
              ...filtros,
              profesionalId: val ? Number(val) : undefined,
            })
          }
          clearable
          style={{ minWidth: 200, flex: 1 }}
        />

        <TextInput
          label="Desde"
          type="date"
          value={filtros.desde ?? ''}
          onChange={(e) =>
            alCambiarFiltros({
              ...filtros,
              desde: e.target.value || undefined,
            })
          }
          style={{ width: 140 }}
        />

        <TextInput
          label="Hasta"
          type="date"
          value={filtros.hasta ?? ''}
          onChange={(e) =>
            alCambiarFiltros({
              ...filtros,
              hasta: e.target.value || undefined,
            })
          }
          style={{ width: 140 }}
        />

        <Button
          variant="light"
          color="gray"
          leftSection={<IconFilterOff size={16} />}
          onClick={limpiar}
          disabled={!hayFiltrosActivos}
        >
          Limpiar filtros
        </Button>
      </Group>
    </Card>
  );
}
