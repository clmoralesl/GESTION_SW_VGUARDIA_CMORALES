import { useDeferredValue, useMemo, useState } from 'react';
import { Badge, Card, Group, Select, Stack, Switch, Table, Text, TextInput } from '@mantine/core';
import { modals } from '@mantine/modals';
import {
  IconPencil,
  IconPlus,
  IconSearch,
  IconTrash,
  IconUserCheck,
  IconUserOff,
} from '@tabler/icons-react';
import {
  formatearMonto,
  textoAsignaciones,
  type RecursoResumen,
  type TipoRecursoResumen,
} from '@autofix/core';
import { useActualizarRecurso, useEliminarRecurso } from '../api/catalogos';
import { AccionProtegida, BotonProtegido } from '../componentes/boton-protegido';
import { EncabezadoOrdenable } from '../componentes/tablas/encabezado-ordenable';
import {
  filtrarYOrdenar,
  siguienteOrden,
  type Orden,
  type ValorOrdenable,
} from '../componentes/tablas/ordenar-filas';

interface TablaRecursosProps {
  recursos: RecursoResumen[];
  tiposRecurso: TipoRecursoResumen[];
  alCrear: () => void;
  alEditar: (recurso: RecursoResumen) => void;
}

type ColumnaRecurso =
  'nombre' | 'tipo' | 'unidad' | 'costoUnitario' | 'activo' | 'numeroAsignaciones';

const CAMPOS_BUSQUEDA = [
  (r: RecursoResumen) => r.nombre,
  (r: RecursoResumen) => r.tipoRecurso.nombre,
  (r: RecursoResumen) => r.unidad,
] as const;

const COLUMNAS: Record<ColumnaRecurso, (r: RecursoResumen) => ValorOrdenable> = {
  nombre: (r) => r.nombre,
  tipo: (r) => r.tipoRecurso.nombre,
  unidad: (r) => r.unidad,
  costoUnitario: (r) => r.costoUnitario,
  activo: (r) => r.activo,
  numeroAsignaciones: (r) => r.numeroAsignaciones,
};

export function TablaRecursos({ recursos, tiposRecurso, alCrear, alEditar }: TablaRecursosProps) {
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<string | null>(null);
  const [mostrarInactivos, setMostrarInactivos] = useState(false);
  const [orden, setOrden] = useState<Orden<ColumnaRecurso> | null>({
    columna: 'nombre',
    direccion: 'asc',
  });

  const busquedaDiferida = useDeferredValue(busqueda);
  const actualizarMutacion = useActualizarRecurso();
  const eliminarMutacion = useEliminarRecurso();

  const opcionesTipos = useMemo(
    () => [
      { value: '', label: 'Todos los tipos' },
      ...tiposRecurso.map((t) => ({ value: String(t.id), label: t.nombre })),
    ],
    [tiposRecurso],
  );

  const alOrdenar = (columna: ColumnaRecurso) => {
    setOrden((prev) => siguienteOrden(prev, columna));
  };

  const filtrados = useMemo(() => {
    let base = mostrarInactivos ? recursos : recursos.filter((r) => r.activo);

    if (filtroTipo && filtroTipo !== '') {
      const tipoId = Number(filtroTipo);
      base = base.filter((r) => r.tipoRecurso.id === tipoId);
    }

    return filtrarYOrdenar(base, {
      busqueda: busquedaDiferida,
      camposBusqueda: CAMPOS_BUSQUEDA,
      columnas: COLUMNAS,
      orden,
    });
  }, [recursos, busquedaDiferida, filtroTipo, orden, mostrarInactivos]);

  const alternarActivo = (r: RecursoResumen) => {
    actualizarMutacion.mutate({
      id: r.id,
      datos: { activo: !r.activo },
    });
  };

  const confirmarEliminar = (r: RecursoResumen) => {
    modals.openConfirmModal({
      title: 'Eliminar recurso',
      children: (
        <Text size="sm">
          ¿Está seguro de eliminar el recurso «{r.nombre}»? Esta acción no se puede deshacer.
        </Text>
      ),
      labels: { confirm: 'Eliminar', cancel: 'Cancelar' },
      confirmProps: { color: 'red' },
      onConfirm: () => eliminarMutacion.mutate(r.id),
    });
  };

  return (
    <Card withBorder padding="md">
      <Stack gap="md">
        <Group justify="space-between" wrap="wrap">
          <Group gap="md" wrap="wrap">
            <TextInput
              placeholder="Buscar recursos..."
              leftSection={<IconSearch size={16} />}
              value={busqueda}
              onChange={(e) => setBusqueda(e.currentTarget.value)}
              style={{ minWidth: 240 }}
            />
            <Select
              placeholder="Filtrar por tipo"
              data={opcionesTipos}
              value={filtroTipo ?? ''}
              onChange={(val) => setFiltroTipo(val === '' ? null : val)}
              clearable
              style={{ width: 190 }}
            />
            <Switch
              label="Mostrar inactivos"
              checked={mostrarInactivos}
              onChange={(e) => setMostrarInactivos(e.currentTarget.checked)}
            />
          </Group>

          <Group gap="sm">
            <Text size="sm" c="dimmed">
              {filtrados.length} de {recursos.length} recursos
            </Text>
            <BotonProtegido
              permiso="gestionarRecursos"
              leftSection={<IconPlus size={16} />}
              onClick={alCrear}
            >
              Nuevo recurso
            </BotonProtegido>
          </Group>
        </Group>

        <Table.ScrollContainer minWidth={700}>
          <Table verticalSpacing="sm" striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <EncabezadoOrdenable columna="nombre" orden={orden} alOrdenar={alOrdenar}>
                  Nombre
                </EncabezadoOrdenable>
                <EncabezadoOrdenable columna="tipo" orden={orden} alOrdenar={alOrdenar}>
                  Tipo
                </EncabezadoOrdenable>
                <EncabezadoOrdenable columna="unidad" orden={orden} alOrdenar={alOrdenar}>
                  Unidad
                </EncabezadoOrdenable>
                <EncabezadoOrdenable columna="costoUnitario" orden={orden} alOrdenar={alOrdenar}>
                  Costo unitario
                </EncabezadoOrdenable>
                <EncabezadoOrdenable columna="activo" orden={orden} alOrdenar={alOrdenar}>
                  Estado
                </EncabezadoOrdenable>
                <EncabezadoOrdenable
                  columna="numeroAsignaciones"
                  orden={orden}
                  alOrdenar={alOrdenar}
                >
                  Asignaciones
                </EncabezadoOrdenable>
                <Table.Th style={{ width: 130, textAlign: 'right' }}>Acciones</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {recursos.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={7} style={{ textAlign: 'center' }}>
                    <Text c="dimmed" py="xl">
                      No hay recursos registrados.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : filtrados.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={7} style={{ textAlign: 'center' }}>
                    <Text c="dimmed" py="xl">
                      Ningún recurso coincide con la búsqueda.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                filtrados.map((r) => (
                  <Table.Tr key={r.id}>
                    <Table.Td fw={500}>{r.nombre}</Table.Td>
                    <Table.Td>{r.tipoRecurso.nombre}</Table.Td>
                    <Table.Td>{r.unidad}</Table.Td>
                    <Table.Td>{formatearMonto(r.costoUnitario)}</Table.Td>
                    <Table.Td>
                      <Badge color={r.activo ? 'green' : 'gray'} variant="light">
                        {r.activo ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{r.numeroAsignaciones}</Table.Td>
                    <Table.Td>
                      <Group gap="xs" justify="flex-end" wrap="nowrap">
                        <AccionProtegida
                          permiso="gestionarRecursos"
                          variant="subtle"
                          tooltip="Editar recurso"
                          aria-label="Editar recurso"
                          onClick={() => alEditar(r)}
                        >
                          <IconPencil size={16} />
                        </AccionProtegida>

                        <AccionProtegida
                          permiso="gestionarRecursos"
                          variant="subtle"
                          color={r.activo ? 'orange' : 'teal'}
                          tooltip={r.activo ? 'Desactivar recurso' : 'Reactivar recurso'}
                          aria-label={r.activo ? 'Desactivar recurso' : 'Reactivar recurso'}
                          onClick={() => alternarActivo(r)}
                        >
                          {r.activo ? <IconUserOff size={16} /> : <IconUserCheck size={16} />}
                        </AccionProtegida>

                        <AccionProtegida
                          permiso="gestionarRecursos"
                          variant="subtle"
                          color="red"
                          tooltip="Eliminar recurso"
                          aria-label="Eliminar recurso"
                          bloqueo={
                            r.numeroAsignaciones > 0
                              ? `Tiene ${textoAsignaciones(r.numeroAsignaciones)}; solo puede desactivarlo`
                              : null
                          }
                          onClick={() => confirmarEliminar(r)}
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
