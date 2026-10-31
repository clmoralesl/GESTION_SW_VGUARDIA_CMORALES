import { useDeferredValue, useMemo, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Card,
  Group,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconChartLine, IconEdit, IconSearch, IconTrash } from '@tabler/icons-react';
import type { AmbitoKpi, DireccionKpi, Semaforo, UmbralesKpi, UnidadKpi } from '@autofix/core';
import { useEliminarKpi } from '../api/kpi';
import { AccionProtegida } from '../componentes/boton-protegido';
import { EncabezadoOrdenable } from '../componentes/tablas/encabezado-ordenable';
import {
  filtrarYOrdenar,
  siguienteOrden,
  type Orden,
  type ValorOrdenable,
} from '../componentes/tablas/ordenar-filas';
import {
  formatearUnidadKpi,
  formatearValorKpi,
  obtenerColorSemaforo,
  obtenerEtiquetaSemaforo,
} from './formato-kpi';

export interface FilaKpiTabla {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  ambito: AmbitoKpi;
  unidad: UnidadKpi;
  meta: number | null;
  direccion: DireccionKpi;
  valor: number | null;
  semaforo: Semaforo | null;
  medidoEn: string | null;
  umbrales: UmbralesKpi;
  activo: boolean;
  formula?: string;
  esAdicional?: boolean;
}

interface TablaKpiProps {
  filas: FilaKpiTabla[];
  alVerGrafico: (fila: FilaKpiTabla) => void;
  alEditar: (fila: FilaKpiTabla) => void;
}

type ColumnaKpi = 'codigo' | 'nombre' | 'valor' | 'semaforo' | 'meta' | 'unidad';

const CAMPOS_BUSQUEDA = [
  (f: FilaKpiTabla) => f.codigo,
  (f: FilaKpiTabla) => f.nombre,
  (f: FilaKpiTabla) => f.descripcion ?? '',
] as const;

const COLUMNAS: Record<ColumnaKpi, (f: FilaKpiTabla) => ValorOrdenable> = {
  codigo: (f) => f.codigo,
  nombre: (f) => f.nombre,
  valor: (f) => f.valor,
  semaforo: (f) => f.semaforo,
  meta: (f) => f.meta,
  unidad: (f) => f.unidad,
};

export function TablaKpi({ filas, alVerGrafico, alEditar }: TablaKpiProps) {
  const [busqueda, setBusqueda] = useState('');
  const [mostrarInactivos, setMostrarInactivos] = useState(false);
  const [orden, setOrden] = useState<Orden<ColumnaKpi> | null>({
    columna: 'codigo',
    direccion: 'asc',
  });

  const busquedaDiferida = useDeferredValue(busqueda);
  const eliminarMutacion = useEliminarKpi();

  const alOrdenar = (columna: ColumnaKpi) => {
    setOrden((prev) => siguienteOrden(prev, columna));
  };

  const filtrados = useMemo(() => {
    const base = mostrarInactivos ? filas : filas.filter((f) => f.activo);
    return filtrarYOrdenar(base, {
      busqueda: busquedaDiferida,
      camposBusqueda: CAMPOS_BUSQUEDA,
      columnas: COLUMNAS,
      orden,
    });
  }, [filas, mostrarInactivos, busquedaDiferida, orden]);

  const confirmarEliminacion = (fila: FilaKpiTabla) => {
    modals.openConfirmModal({
      title: 'Eliminar KPI',
      children: (
        <Text size="sm">
          ¿Está seguro de eliminar el indicador <strong>{fila.codigo}</strong> ({fila.nombre})? Si
          ya cuenta con mediciones históricas registradas, la acción será rechazada y deberá
          desactivarlo.
        </Text>
      ),
      labels: { confirm: 'Eliminar', cancel: 'Cancelar' },
      confirmProps: { color: 'red' },
      onConfirm: () => eliminarMutacion.mutate(fila.id),
    });
  };

  return (
    <Card withBorder radius="md" p="md">
      <Stack gap="md">
        <Group justify="space-between">
          <TextInput
            placeholder="Buscar por código, nombre o descripción..."
            leftSection={<IconSearch size={16} />}
            value={busqueda}
            onChange={(e) => setBusqueda(e.currentTarget.value)}
            w={{ base: '100%', sm: 360 }}
          />
          <Switch
            label="Mostrar inactivos"
            checked={mostrarInactivos}
            onChange={(e) => setMostrarInactivos(e.currentTarget.checked)}
          />
        </Group>

        <Table.ScrollContainer minWidth={750}>
          <Table verticalSpacing="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <EncabezadoOrdenable columna="codigo" orden={orden} alOrdenar={alOrdenar}>
                  Código
                </EncabezadoOrdenable>
                <EncabezadoOrdenable columna="nombre" orden={orden} alOrdenar={alOrdenar}>
                  Nombre del KPI
                </EncabezadoOrdenable>
                <EncabezadoOrdenable columna="valor" orden={orden} alOrdenar={alOrdenar}>
                  Valor actual
                </EncabezadoOrdenable>
                <EncabezadoOrdenable columna="semaforo" orden={orden} alOrdenar={alOrdenar}>
                  Semáforo
                </EncabezadoOrdenable>
                <EncabezadoOrdenable columna="meta" orden={orden} alOrdenar={alOrdenar}>
                  Meta
                </EncabezadoOrdenable>
                <EncabezadoOrdenable columna="unidad" orden={orden} alOrdenar={alOrdenar}>
                  Unidad
                </EncabezadoOrdenable>
                <Table.Th style={{ width: 100, textAlign: 'right' }}>Acciones</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtrados.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={7}>
                    <Text ta="center" c="dimmed" py="xl">
                      No se encontraron indicadores KPI que coincidan con la búsqueda.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                filtrados.map((fila) => (
                  <Table.Tr key={fila.id}>
                    <Table.Td>
                      <Group gap="xs">
                        <Badge
                          variant={fila.activo ? 'filled' : 'outline'}
                          color={fila.activo ? 'blue' : 'gray'}
                        >
                          {fila.codigo}
                        </Badge>
                        {!fila.activo ? (
                          <Badge size="xs" color="gray" variant="light">
                            Inactivo
                          </Badge>
                        ) : null}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Stack gap={2}>
                        <Text fw={600} size="sm">
                          {fila.nombre}
                        </Text>
                        {fila.descripcion ? (
                          <Text size="xs" c="dimmed" lineClamp={1}>
                            {fila.descripcion}
                          </Text>
                        ) : null}
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Text fw={700} size="sm">
                        {formatearValorKpi(fila.valor, fila.unidad)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={obtenerColorSemaforo(fila.semaforo)} variant="filled">
                        {obtenerEtiquetaSemaforo(fila.semaforo, fila.valor)}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {fila.meta !== null ? formatearValorKpi(fila.meta, fila.unidad) : 'N/D'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge size="xs" variant="light" color="gray">
                        {formatearUnidadKpi(fila.unidad)}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} justify="flex-end">
                        <Tooltip label="Ver historial gráfico">
                          <ActionIcon
                            variant="subtle"
                            color="blue"
                            aria-label="Ver historial del KPI"
                            onClick={() => alVerGrafico(fila)}
                          >
                            <IconChartLine size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <AccionProtegida
                          permiso="editarKpi"
                          tooltip="Editar KPI"
                          variant="subtle"
                          color="yellow"
                          onClick={() => alEditar(fila)}
                        >
                          <IconEdit size={16} />
                        </AccionProtegida>
                        <AccionProtegida
                          permiso="editarKpi"
                          tooltip="Eliminar KPI"
                          variant="subtle"
                          color="red"
                          onClick={() => confirmarEliminacion(fila)}
                        >
                          <IconTrash size={16} />
                        </AccionProtegida>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Stack>
    </Card>
  );
}
