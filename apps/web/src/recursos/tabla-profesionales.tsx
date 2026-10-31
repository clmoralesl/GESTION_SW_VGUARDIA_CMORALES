import { useDeferredValue, useMemo, useState } from 'react';
import { Badge, Card, Group, Stack, Switch, Table, Text, TextInput } from '@mantine/core';
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
  formatearHoras,
  formatearMonto,
  textoAsignaciones,
  type ProfesionalResumen,
} from '@autofix/core';
import { useActualizarProfesional, useEliminarProfesional } from '../api/catalogos';
import { AccionProtegida, BotonProtegido } from '../componentes/boton-protegido';
import { EncabezadoOrdenable } from '../componentes/tablas/encabezado-ordenable';
import {
  filtrarYOrdenar,
  siguienteOrden,
  type Orden,
  type ValorOrdenable,
} from '../componentes/tablas/ordenar-filas';

interface TablaProfesionalesProps {
  profesionales: ProfesionalResumen[];
  alCrear: () => void;
  alEditar: (profesional: ProfesionalResumen) => void;
}

type ColumnaProfesional =
  'nombre' | 'cargo' | 'tarifaHora' | 'horasDiarias' | 'activo' | 'numeroAsignaciones';

const CAMPOS_BUSQUEDA = [
  (p: ProfesionalResumen) => p.nombre,
  (p: ProfesionalResumen) => p.cargo,
] as const;

const COLUMNAS: Record<ColumnaProfesional, (p: ProfesionalResumen) => ValorOrdenable> = {
  nombre: (p) => p.nombre,
  cargo: (p) => p.cargo,
  tarifaHora: (p) => p.tarifaHora,
  horasDiarias: (p) => p.horasDiarias,
  activo: (p) => p.activo,
  numeroAsignaciones: (p) => p.numeroAsignaciones,
};

export function TablaProfesionales({ profesionales, alCrear, alEditar }: TablaProfesionalesProps) {
  const [busqueda, setBusqueda] = useState('');
  const [mostrarInactivos, setMostrarInactivos] = useState(false);
  const [orden, setOrden] = useState<Orden<ColumnaProfesional> | null>({
    columna: 'nombre',
    direccion: 'asc',
  });

  const busquedaDiferida = useDeferredValue(busqueda);
  const actualizarMutacion = useActualizarProfesional();
  const eliminarMutacion = useEliminarProfesional();

  const alOrdenar = (columna: ColumnaProfesional) => {
    setOrden((prev) => siguienteOrden(prev, columna));
  };

  const filtrados = useMemo(() => {
    const base = mostrarInactivos ? profesionales : profesionales.filter((p) => p.activo);
    return filtrarYOrdenar(base, {
      busqueda: busquedaDiferida,
      camposBusqueda: CAMPOS_BUSQUEDA,
      columnas: COLUMNAS,
      orden,
    });
  }, [profesionales, busquedaDiferida, orden, mostrarInactivos]);

  const alternarActivo = (p: ProfesionalResumen) => {
    actualizarMutacion.mutate({
      id: p.id,
      datos: { activo: !p.activo },
    });
  };

  const confirmarEliminar = (p: ProfesionalResumen) => {
    modals.openConfirmModal({
      title: 'Eliminar profesional',
      children: (
        <Text size="sm">
          ¿Está seguro de eliminar el profesional «{p.nombre}»? Esta acción no se puede deshacer.
        </Text>
      ),
      labels: { confirm: 'Eliminar', cancel: 'Cancelar' },
      confirmProps: { color: 'red' },
      onConfirm: () => eliminarMutacion.mutate(p.id),
    });
  };

  return (
    <Card withBorder padding="md">
      <Stack gap="md">
        <Group justify="space-between" wrap="wrap">
          <Group gap="md">
            <TextInput
              placeholder="Buscar profesionales..."
              leftSection={<IconSearch size={16} />}
              value={busqueda}
              onChange={(e) => setBusqueda(e.currentTarget.value)}
              style={{ minWidth: 260 }}
            />
            <Switch
              label="Mostrar inactivos"
              checked={mostrarInactivos}
              onChange={(e) => setMostrarInactivos(e.currentTarget.checked)}
            />
          </Group>

          <Group gap="sm">
            <Text size="sm" c="dimmed">
              {filtrados.length} de {profesionales.length} profesionales
            </Text>
            <BotonProtegido
              permiso="gestionarRecursos"
              leftSection={<IconPlus size={16} />}
              onClick={alCrear}
            >
              Nuevo profesional
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
                <EncabezadoOrdenable columna="cargo" orden={orden} alOrdenar={alOrdenar}>
                  Cargo
                </EncabezadoOrdenable>
                <EncabezadoOrdenable columna="tarifaHora" orden={orden} alOrdenar={alOrdenar}>
                  Tarifa/hora
                </EncabezadoOrdenable>
                <EncabezadoOrdenable columna="horasDiarias" orden={orden} alOrdenar={alOrdenar}>
                  Horas/día
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
              {profesionales.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={7} style={{ textAlign: 'center' }}>
                    <Text c="dimmed" py="xl">
                      No hay profesionales registrados.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : filtrados.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={7} style={{ textAlign: 'center' }}>
                    <Text c="dimmed" py="xl">
                      Ningún profesional coincide con la búsqueda.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                filtrados.map((p) => (
                  <Table.Tr key={p.id}>
                    <Table.Td fw={500}>{p.nombre}</Table.Td>
                    <Table.Td>{p.cargo}</Table.Td>
                    <Table.Td>{formatearMonto(p.tarifaHora)}</Table.Td>
                    <Table.Td>{formatearHoras(p.horasDiarias)}</Table.Td>
                    <Table.Td>
                      <Badge color={p.activo ? 'green' : 'gray'} variant="light">
                        {p.activo ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{p.numeroAsignaciones}</Table.Td>
                    <Table.Td>
                      <Group gap="xs" justify="flex-end" wrap="nowrap">
                        <AccionProtegida
                          permiso="gestionarRecursos"
                          variant="subtle"
                          tooltip="Editar profesional"
                          aria-label="Editar profesional"
                          onClick={() => alEditar(p)}
                        >
                          <IconPencil size={16} />
                        </AccionProtegida>

                        <AccionProtegida
                          permiso="gestionarRecursos"
                          variant="subtle"
                          color={p.activo ? 'orange' : 'teal'}
                          tooltip={p.activo ? 'Desactivar profesional' : 'Reactivar profesional'}
                          aria-label={p.activo ? 'Desactivar profesional' : 'Reactivar profesional'}
                          onClick={() => alternarActivo(p)}
                        >
                          {p.activo ? <IconUserOff size={16} /> : <IconUserCheck size={16} />}
                        </AccionProtegida>

                        <AccionProtegida
                          permiso="gestionarRecursos"
                          variant="subtle"
                          color="red"
                          tooltip="Eliminar profesional"
                          aria-label="Eliminar profesional"
                          bloqueo={
                            p.numeroAsignaciones > 0
                              ? `Tiene ${textoAsignaciones(p.numeroAsignaciones)}; solo puede desactivarlo`
                              : null
                          }
                          onClick={() => confirmarEliminar(p)}
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
