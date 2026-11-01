import { useCallback, useMemo, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { IconPlus, IconSearch, IconTrash } from '@tabler/icons-react';
import { formatearMonto, type EstadoSolicitud, type TipoImpacto } from '@autofix/core';
import { useEliminarImpactoCambio, useImpactosCambio, type DetalleImpacto } from '../api/cambios';
import { useProfesionales, useRecursos } from '../api/catalogos';
import { useArbolTareas } from '../api/tareas';
import { EncabezadoOrdenable } from '../componentes/tablas/encabezado-ordenable';
import { filtrarYOrdenar, siguienteOrden, type Orden } from '../componentes/tablas/ordenar-filas';
import { usePermisos } from '../sesion/use-permisos';
import { ModalCrearImpacto } from './modal-crear-impacto';

interface TablaImpactosProps {
  solicitudId: number;
  proyectoId: number;
  solicitudEstado: EstadoSolicitud;
  etapa3Completada: boolean;
}

type ColumnaOrdenable = 'tipo' | 'descripcion' | 'aplicado';

const COLOR_TIPO: Record<TipoImpacto, string> = {
  DURACION: 'blue',
  ASIGNACION: 'violet',
  NUEVA_TAREA: 'teal',
  PRESUPUESTO: 'orange',
};

const ETIQUETA_TIPO: Record<TipoImpacto, string> = {
  DURACION: 'Duración',
  ASIGNACION: 'Asignación',
  NUEVA_TAREA: 'Nueva tarea',
  PRESUPUESTO: 'Presupuesto',
};

export function TablaImpactos({
  solicitudId,
  proyectoId,
  solicitudEstado,
  etapa3Completada,
}: TablaImpactosProps) {
  const { puede, motivoBloqueo } = usePermisos();
  const [busqueda, setBusqueda] = useState('');
  const [orden, setOrden] = useState<Orden<ColumnaOrdenable> | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);

  const { data: impactos, isLoading } = useImpactosCambio(solicitudId);
  const { data: arbol } = useArbolTareas(proyectoId);
  const { data: profesionales } = useProfesionales();
  const { data: recursos } = useRecursos();

  const eliminarMutacion = useEliminarImpactoCambio(solicitudId);

  const mapaTareas = useMemo(() => {
    const mapa = new Map<number, string>();
    for (const t of arbol?.tareas ?? []) {
      mapa.set(t.id, `${t.codigo} · ${t.nombre}`);
    }
    return mapa;
  }, [arbol]);

  const mapaProfesionales = useMemo(() => {
    const mapa = new Map<number, string>();
    const lista = Array.isArray(profesionales) ? profesionales : [];
    for (const p of lista) {
      mapa.set(p.id, p.nombre);
    }
    return mapa;
  }, [profesionales]);

  const mapaRecursos = useMemo(() => {
    const mapa = new Map<number, string>();
    const lista = Array.isArray(recursos) ? recursos : [];
    for (const r of lista) {
      mapa.set(r.id, r.nombre);
    }
    return mapa;
  }, [recursos]);

  const describirImpacto = useCallback(
    (imp: DetalleImpacto): string => {
      const datos = (imp.datos ?? {}) as Record<string, unknown>;
      if (imp.tipo === 'DURACION') {
        const tarea = imp.tareaId ? (mapaTareas.get(imp.tareaId) ?? `ID ${imp.tareaId}`) : 'Tarea';
        const dias = datos.duracionDias ? `${String(datos.duracionDias)} días hábiles` : '';
        return `${tarea}: duración ${dias}`;
      }
      if (imp.tipo === 'PRESUPUESTO') {
        const pres =
          typeof datos.presupuesto === 'number'
            ? formatearMonto(datos.presupuesto)
            : '$' + String(datos.presupuesto ?? '');
        return `Presupuesto del proyecto: ${pres}`;
      }
      if (imp.tipo === 'NUEVA_TAREA') {
        const clave = typeof datos.clave === 'string' ? datos.clave : '';
        const nombre = typeof datos.nombre === 'string' ? datos.nombre : '';
        const dias = datos.duracionDias ? `(${String(datos.duracionDias)} días)` : '';
        return `Nueva tarea ${clave}: ${nombre} ${dias}`;
      }
      if (imp.tipo === 'ASIGNACION') {
        const op = String(datos.operacion ?? '');
        const elem = String(datos.elemento ?? '');
        const tarea = imp.tareaId ? (mapaTareas.get(imp.tareaId) ?? `ID ${imp.tareaId}`) : 'Tarea';
        if (elem === 'PROFESIONAL') {
          const prof =
            typeof datos.profesionalId === 'number'
              ? (mapaProfesionales.get(datos.profesionalId) ?? `ID ${datos.profesionalId}`)
              : '';
          const ded = datos.dedicacion ? `${String(datos.dedicacion)}%` : '';
          return `${op.toUpperCase()} ${prof} en ${tarea} ${ded}`;
        } else {
          const rec =
            typeof datos.recursoId === 'number'
              ? (mapaRecursos.get(datos.recursoId) ?? `ID ${datos.recursoId}`)
              : '';
          const cant = datos.cantidadPlan ? `${String(datos.cantidadPlan)} uds` : '';
          return `${op.toUpperCase()} ${rec} en ${tarea} ${cant}`;
        }
      }
      return '';
    },
    [mapaTareas, mapaProfesionales, mapaRecursos],
  );

  const puedeGestionar = puede('gestionarSolicitudesCambio');
  const estadoPermiteGestion =
    (solicitudEstado === 'REGISTRADA' || solicitudEstado === 'EN_EVALUACION') && !etapa3Completada;

  const motivoBloqueoGestion = !puedeGestionar
    ? motivoBloqueo('gestionarSolicitudesCambio')
    : etapa3Completada
      ? 'No se pueden modificar impactos cuando la etapa 3 ya está completada'
      : !estadoPermiteGestion
        ? 'Solo se pueden gestionar impactos en estado Registrada o En evaluación'
        : null;

  const filasFiltradas = useMemo(() => {
    const lista = impactos ?? [];
    return filtrarYOrdenar<DetalleImpacto, ColumnaOrdenable>(lista, {
      busqueda,
      camposBusqueda: [
        (imp) => ETIQUETA_TIPO[imp.tipo],
        (imp) => imp.descripcion,
        (imp) => describirImpacto(imp),
      ],
      columnas: {
        tipo: (imp) => imp.tipo,
        descripcion: (imp) => imp.descripcion,
        aplicado: (imp) => imp.aplicado,
      },
      orden,
    });
  }, [impactos, busqueda, orden, describirImpacto]);

  const handleCambiarOrden = (columna: ColumnaOrdenable) => {
    setOrden((prev) => siguienteOrden(prev, columna));
  };

  return (
    <Card withBorder radius="md" p="md">
      <Stack gap="md">
        <Group justify="space-between" align="center" wrap="wrap">
          <Group gap="xs">
            <TextInput
              placeholder="Buscar en impactos..."
              leftSection={<IconSearch size={16} />}
              value={busqueda}
              onChange={(e) => setBusqueda(e.currentTarget.value)}
              size="sm"
              w={{ base: '100%', sm: 300 }}
            />
          </Group>

          {motivoBloqueoGestion ? (
            <Tooltip label={motivoBloqueoGestion}>
              <span>
                <Button leftSection={<IconPlus size={16} />} variant="filled" size="sm" disabled>
                  Agregar impacto
                </Button>
              </span>
            </Tooltip>
          ) : (
            <Button
              leftSection={<IconPlus size={16} />}
              variant="filled"
              size="sm"
              onClick={() => setModalAbierto(true)}
            >
              Agregar impacto
            </Button>
          )}
        </Group>

        <Table.ScrollContainer minWidth={600}>
          <Table striped highlightOnHover verticalSpacing="xs">
            <Table.Thead>
              <Table.Tr>
                <EncabezadoOrdenable<ColumnaOrdenable>
                  columna="tipo"
                  orden={orden}
                  alOrdenar={handleCambiarOrden}
                >
                  Tipo
                </EncabezadoOrdenable>
                <Table.Th>Detalle del impacto</Table.Th>
                <EncabezadoOrdenable<ColumnaOrdenable>
                  columna="descripcion"
                  orden={orden}
                  alOrdenar={handleCambiarOrden}
                >
                  Descripción / Motivo
                </EncabezadoOrdenable>
                <EncabezadoOrdenable<ColumnaOrdenable>
                  columna="aplicado"
                  orden={orden}
                  alOrdenar={handleCambiarOrden}
                >
                  Aplicado
                </EncabezadoOrdenable>
                <Table.Th style={{ width: 70, textAlign: 'center' }}>Acciones</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {isLoading ? (
                <Table.Tr>
                  <Table.Td colSpan={5} style={{ textAlign: 'center' }}>
                    <Text size="sm" c="dimmed">
                      Cargando impactos...
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : filasFiltradas.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={5} style={{ textAlign: 'center' }}>
                    <Text size="sm" c="dimmed">
                      No se han registrado impactos para esta solicitud.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                filasFiltradas.map((imp) => (
                  <Table.Tr key={imp.id}>
                    <Table.Td>
                      <Badge color={COLOR_TIPO[imp.tipo]} variant="light">
                        {ETIQUETA_TIPO[imp.tipo]}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={500}>
                        {describirImpacto(imp)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c={imp.descripcion ? undefined : 'dimmed'}>
                        {imp.descripcion || '—'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={imp.aplicado ? 'green' : 'gray'} variant="outline">
                        {imp.aplicado ? 'Sí' : 'No'}
                      </Badge>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'center' }}>
                      {motivoBloqueoGestion ? (
                        <Tooltip label={motivoBloqueoGestion}>
                          <span>
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              disabled
                              aria-label="Eliminar impacto"
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </span>
                        </Tooltip>
                      ) : (
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          aria-label="Eliminar impacto"
                          loading={
                            eliminarMutacion.isPending && eliminarMutacion.variables === imp.id
                          }
                          onClick={() => eliminarMutacion.mutate(imp.id)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Stack>

      <ModalCrearImpacto
        solicitudId={solicitudId}
        proyectoId={proyectoId}
        opened={modalAbierto}
        onClose={() => setModalAbierto(false)}
      />
    </Card>
  );
}
