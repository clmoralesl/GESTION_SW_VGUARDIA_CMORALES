import { Button, Card, Group, Select, TextInput } from '@mantine/core';
import { IconFilterOff } from '@tabler/icons-react';
import type {
  CategoriaCambio,
  ConsultaTableroCambio,
  NivelRiesgo,
  PrioridadSolicitud,
  TableroCambio,
} from '@autofix/core';

interface BarraFiltrosProps {
  opciones: TableroCambio['opciones'];
  filtros: ConsultaTableroCambio;
  alCambiarFiltros: (nuevos: ConsultaTableroCambio) => void;
}

const PRIORIDADES: { value: PrioridadSolicitud; label: string }[] = [
  { value: 'BAJA', label: 'Baja' },
  { value: 'MEDIA', label: 'Media' },
  { value: 'ALTA', label: 'Alta' },
  { value: 'CRITICA', label: 'Crítica' },
];

const CATEGORIAS: { value: CategoriaCambio; label: string }[] = [
  { value: 'ALCANCE', label: 'Alcance' },
  { value: 'PLAZO', label: 'Plazo' },
  { value: 'COSTO', label: 'Costo' },
  { value: 'RECURSO', label: 'Recurso' },
  { value: 'CALIDAD', label: 'Calidad' },
];

const NIVELES: { value: NivelRiesgo; label: string }[] = [
  { value: 'BAJO', label: 'Bajo' },
  { value: 'MEDIO', label: 'Medio' },
  { value: 'ALTO', label: 'Alto' },
  { value: 'CRITICO', label: 'Crítico' },
];

export function BarraFiltros({ opciones, filtros, alCambiarFiltros }: BarraFiltrosProps) {
  const rangoInvalido = Boolean(filtros.desde && filtros.hasta && filtros.desde > filtros.hasta);

  const responsablesOpciones = opciones.responsables.map((r) => ({
    value: r,
    label: r,
  }));

  const hayFiltrosActivos =
    Boolean(filtros.prioridad) ||
    Boolean(filtros.categoria) ||
    Boolean(filtros.nivelRiesgo) ||
    Boolean(filtros.responsable) ||
    Boolean(filtros.desde) ||
    Boolean(filtros.hasta);

  const limpiar = () => {
    alCambiarFiltros({});
  };

  return (
    <Card withBorder padding="sm" radius="md">
      <Group gap="sm" align="flex-end" wrap="wrap">
        <Select
          label="Prioridad"
          placeholder="Todas"
          data={PRIORIDADES}
          value={filtros.prioridad ?? null}
          onChange={(val) =>
            alCambiarFiltros({
              ...filtros,
              prioridad: (val as PrioridadSolicitud) || undefined,
            })
          }
          clearable
          style={{ minWidth: 130, flex: 1 }}
        />

        <Select
          label="Categoría"
          placeholder="Todas"
          data={CATEGORIAS}
          value={filtros.categoria ?? null}
          onChange={(val) =>
            alCambiarFiltros({
              ...filtros,
              categoria: (val as CategoriaCambio) || undefined,
            })
          }
          clearable
          style={{ minWidth: 130, flex: 1 }}
        />

        <Select
          label="Nivel de riesgo"
          placeholder="Todos"
          data={NIVELES}
          value={filtros.nivelRiesgo ?? null}
          onChange={(val) =>
            alCambiarFiltros({
              ...filtros,
              nivelRiesgo: (val as NivelRiesgo) || undefined,
            })
          }
          clearable
          style={{ minWidth: 130, flex: 1 }}
        />

        <Select
          label="Responsable"
          placeholder="Todos"
          data={responsablesOpciones}
          value={filtros.responsable ?? null}
          onChange={(val) =>
            alCambiarFiltros({
              ...filtros,
              responsable: val || undefined,
            })
          }
          searchable
          clearable
          style={{ minWidth: 180, flex: 1 }}
        />

        <TextInput
          type="date"
          label="Desde"
          value={filtros.desde ?? ''}
          onChange={(e) =>
            alCambiarFiltros({
              ...filtros,
              desde: e.currentTarget.value || undefined,
            })
          }
          style={{ minWidth: 140 }}
        />

        <TextInput
          type="date"
          label="Hasta"
          value={filtros.hasta ?? ''}
          error={
            rangoInvalido ? 'La fecha final debe ser igual o posterior a la inicial.' : undefined
          }
          onChange={(e) =>
            alCambiarFiltros({
              ...filtros,
              hasta: e.currentTarget.value || undefined,
            })
          }
          style={{ minWidth: 140 }}
        />

        {hayFiltrosActivos ? (
          <Button
            variant="subtle"
            color="gray"
            leftSection={<IconFilterOff size={16} />}
            onClick={limpiar}
          >
            Limpiar filtros
          </Button>
        ) : null}
      </Group>
    </Card>
  );
}
