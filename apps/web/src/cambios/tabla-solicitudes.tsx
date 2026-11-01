import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Grid,
  Group,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { IconArrowRight, IconFilterOff, IconSearch } from '@tabler/icons-react';
import {
  CATEGORIAS_CAMBIO,
  ESTADOS_SOLICITUD,
  filtrarSolicitudes,
  formatearFecha,
  NIVELES_RIESGO,
  PRIORIDADES_SOLICITUD,
  type CategoriaCambio,
  type EstadoSolicitud,
  type FiltrosSolicitud,
  type NivelRiesgo,
  type PrioridadSolicitud,
} from '@autofix/core';
import type { DetalleSolicitudCambio } from '../api/cambios';
import { EncabezadoOrdenable } from '../componentes/tablas/encabezado-ordenable';
import { filtrarYOrdenar, siguienteOrden, type Orden } from '../componentes/tablas/ordenar-filas';

interface TablaSolicitudesProps {
  solicitudes: readonly DetalleSolicitudCambio[];
  filtros: FiltrosSolicitud;
  onCambiarFiltros: (filtros: FiltrosSolicitud) => void;
  onLimpiarFiltros: () => void;
}

type ColumnaOrdenable =
  | 'codigo'
  | 'titulo'
  | 'responsable'
  | 'prioridad'
  | 'categoria'
  | 'nivelRiesgo'
  | 'estado'
  | 'etapaActual'
  | 'fechaRegistro';

const colorPorEstado: Record<EstadoSolicitud, string> = {
  REGISTRADA: 'gray',
  EN_EVALUACION: 'blue',
  APROBADA: 'teal',
  RECHAZADA: 'red',
  IMPLEMENTADA: 'grape',
  CERRADA: 'dark',
};

const colorPorRiesgo: Record<NivelRiesgo, string> = {
  BAJO: 'teal',
  MEDIO: 'blue',
  ALTO: 'orange',
  CRITICO: 'red',
};

const colorPorPrioridad: Record<PrioridadSolicitud, string> = {
  BAJA: 'gray',
  MEDIA: 'blue',
  ALTA: 'orange',
  CRITICA: 'red',
};

export function TablaSolicitudes({
  solicitudes,
  filtros,
  onCambiarFiltros,
  onLimpiarFiltros,
}: TablaSolicitudesProps) {
  const navigate = useNavigate();
  const [orden, setOrden] = useState<Orden<ColumnaOrdenable> | null>({
    columna: 'codigo',
    direccion: 'asc',
  });

  const cambiarOrden = (columna: ColumnaOrdenable) => {
    setOrden((prev) => siguienteOrden(prev, columna));
  };

  const filasProcesadas = useMemo(() => {
    const filtrosSinTexto = { ...filtros, responsable: undefined };
    const filtradas = filtrarSolicitudes(solicitudes, filtrosSinTexto);
    return filtrarYOrdenar(filtradas, {
      busqueda: filtros.responsable ?? '',
      camposBusqueda: [(s) => s.responsable, (s) => s.titulo, (s) => s.codigo],
      columnas: {
        codigo: (s) => s.codigo,
        titulo: (s) => s.titulo,
        responsable: (s) => s.responsable,
        prioridad: (s) => s.prioridad,
        categoria: (s) => s.categoria,
        nivelRiesgo: (s) => s.nivelRiesgo,
        estado: (s) => s.estado,
        etapaActual: (s) => s.etapaActual,
        fechaRegistro: (s) => s.fechaRegistro,
      },
      orden,
    });
  }, [solicitudes, filtros, orden]);

  const hayFiltrosActivos =
    Boolean(filtros.estado) ||
    filtros.etapaActual !== undefined ||
    Boolean(filtros.responsable) ||
    Boolean(filtros.prioridad) ||
    Boolean(filtros.categoria) ||
    Boolean(filtros.nivelRiesgo) ||
    Boolean(filtros.fechaDesde) ||
    Boolean(filtros.fechaHasta);

  return (
    <Stack gap="md">
      <Card withBorder p="sm" radius="md">
        <Stack gap="xs">
          <Grid gutter="xs">
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <TextInput
                placeholder="Buscar por responsable o título"
                leftSection={<IconSearch size={16} />}
                value={filtros.responsable ?? ''}
                onChange={(e) =>
                  onCambiarFiltros({
                    ...filtros,
                    responsable: e.currentTarget.value || undefined,
                  })
                }
                size="xs"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 6, sm: 3, md: 2 }}>
              <Select
                placeholder="Estado"
                data={ESTADOS_SOLICITUD.map((e) => ({ value: e, label: e }))}
                value={filtros.estado ?? null}
                onChange={(v) =>
                  onCambiarFiltros({
                    ...filtros,
                    estado: (v as EstadoSolicitud) || undefined,
                  })
                }
                clearable
                size="xs"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 6, sm: 3, md: 1.5 }}>
              <Select
                placeholder="Etapa"
                data={Array.from({ length: 10 }, (_, i) => ({
                  value: String(i + 1),
                  label: `Etapa ${i + 1}`,
                }))}
                value={filtros.etapaActual !== undefined ? String(filtros.etapaActual) : null}
                onChange={(v) =>
                  onCambiarFiltros({
                    ...filtros,
                    etapaActual: v ? Number(v) : undefined,
                  })
                }
                clearable
                size="xs"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 6, sm: 3, md: 1.5 }}>
              <Select
                placeholder="Prioridad"
                data={PRIORIDADES_SOLICITUD.map((p) => ({ value: p, label: p }))}
                value={filtros.prioridad ?? null}
                onChange={(v) =>
                  onCambiarFiltros({
                    ...filtros,
                    prioridad: (v as PrioridadSolicitud) || undefined,
                  })
                }
                clearable
                size="xs"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 6, sm: 3, md: 2 }}>
              <Select
                placeholder="Categoría"
                data={CATEGORIAS_CAMBIO.map((c) => ({ value: c, label: c }))}
                value={filtros.categoria ?? null}
                onChange={(v) =>
                  onCambiarFiltros({
                    ...filtros,
                    categoria: (v as CategoriaCambio) || undefined,
                  })
                }
                clearable
                size="xs"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 6, sm: 3, md: 2 }}>
              <Select
                placeholder="Riesgo"
                data={NIVELES_RIESGO.map((r) => ({ value: r, label: r }))}
                value={filtros.nivelRiesgo ?? null}
                onChange={(v) =>
                  onCambiarFiltros({
                    ...filtros,
                    nivelRiesgo: (v as NivelRiesgo) || undefined,
                  })
                }
                clearable
                size="xs"
              />
            </Grid.Col>
          </Grid>

          <Group justify="space-between" align="center">
            <Group gap="xs">
              <TextInput
                placeholder="Fecha desde (AAAA-MM-DD)"
                value={filtros.fechaDesde ?? ''}
                onChange={(e) =>
                  onCambiarFiltros({
                    ...filtros,
                    fechaDesde: e.currentTarget.value || undefined,
                  })
                }
                size="xs"
                style={{ width: 170 }}
              />
              <TextInput
                placeholder="Fecha hasta (AAAA-MM-DD)"
                value={filtros.fechaHasta ?? ''}
                onChange={(e) =>
                  onCambiarFiltros({
                    ...filtros,
                    fechaHasta: e.currentTarget.value || undefined,
                  })
                }
                size="xs"
                style={{ width: 170 }}
              />
            </Group>

            {hayFiltrosActivos && (
              <Button
                variant="subtle"
                color="gray"
                size="xs"
                leftSection={<IconFilterOff size={14} />}
                onClick={onLimpiarFiltros}
              >
                Limpiar filtros
              </Button>
            )}
          </Group>
        </Stack>
      </Card>

      <Table.ScrollContainer minWidth={900}>
        <Table withTableBorder withColumnBorders striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <EncabezadoOrdenable columna="codigo" orden={orden} alOrdenar={cambiarOrden}>
                Código
              </EncabezadoOrdenable>
              <EncabezadoOrdenable columna="titulo" orden={orden} alOrdenar={cambiarOrden}>
                Título
              </EncabezadoOrdenable>
              <EncabezadoOrdenable columna="responsable" orden={orden} alOrdenar={cambiarOrden}>
                Responsable
              </EncabezadoOrdenable>
              <EncabezadoOrdenable columna="prioridad" orden={orden} alOrdenar={cambiarOrden}>
                Prioridad
              </EncabezadoOrdenable>
              <EncabezadoOrdenable columna="categoria" orden={orden} alOrdenar={cambiarOrden}>
                Categoría
              </EncabezadoOrdenable>
              <EncabezadoOrdenable columna="nivelRiesgo" orden={orden} alOrdenar={cambiarOrden}>
                Riesgo
              </EncabezadoOrdenable>
              <EncabezadoOrdenable columna="estado" orden={orden} alOrdenar={cambiarOrden}>
                Estado
              </EncabezadoOrdenable>
              <EncabezadoOrdenable columna="etapaActual" orden={orden} alOrdenar={cambiarOrden}>
                Etapa
              </EncabezadoOrdenable>
              <EncabezadoOrdenable columna="fechaRegistro" orden={orden} alOrdenar={cambiarOrden}>
                Registro
              </EncabezadoOrdenable>
              <Table.Th style={{ width: 70 }}>Detalle</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filasProcesadas.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={10} ta="center" py="xl">
                  <Text c="dimmed">
                    No se encontraron solicitudes de cambio que coincidan con los filtros.
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              filasProcesadas.map((s) => (
                <Table.Tr key={s.id}>
                  <Table.Td fw={700}>{s.codigo}</Table.Td>
                  <Table.Td fw={500}>{s.titulo}</Table.Td>
                  <Table.Td>{s.responsable}</Table.Td>
                  <Table.Td>
                    <Badge size="xs" color={colorPorPrioridad[s.prioridad]} variant="light">
                      {s.prioridad}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge size="xs" variant="outline" color="gray">
                      {s.categoria}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge size="xs" color={colorPorRiesgo[s.nivelRiesgo]} variant="filled">
                      {s.nivelRiesgo}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge size="xs" color={colorPorEstado[s.estado]} variant="filled">
                      {s.estado}
                    </Badge>
                  </Table.Td>
                  <Table.Td ta="center">
                    <Badge size="xs" variant="light" color="indigo">
                      {s.etapaActual} / 10
                    </Badge>
                  </Table.Td>
                  <Table.Td>{formatearFecha(s.fechaRegistro)}</Table.Td>
                  <Table.Td>
                    <ActionIcon
                      variant="subtle"
                      color="blue"
                      size="sm"
                      aria-label={`Ver detalle de ${s.codigo}`}
                      onClick={() => navigate(`/cambios/${s.id}`)}
                    >
                      <IconArrowRight size={16} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Stack>
  );
}
