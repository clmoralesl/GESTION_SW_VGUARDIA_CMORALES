import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import {
  Alert,
  Container,
  Group,
  Paper,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconAlertCircle } from '@tabler/icons-react';
import {
  ACCIONES_BITACORA,
  ENTIDADES_BITACORA,
  NOMBRES_ROL,
  ROLES,
  type AccionBitacora,
  type EntidadBitacora,
  type Rol,
} from '@autofix/core';
import { useBitacora } from '../api/bitacora';
import { HistorialPaginado } from '../bitacora/historial-paginado';
import { useSesion } from '../sesion/proveedor-sesion';

function formatearFechaIso(fecha: Date | string | null): string | undefined {
  if (!fecha) return undefined;
  if (typeof fecha === 'string') {
    return /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : undefined;
  }
  if (Number.isNaN(fecha.getTime())) return undefined;
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

function parsearFechaLocal(cadena: string | null): Date | null {
  if (!cadena || !/^\d{4}-\d{2}-\d{2}$/.test(cadena)) return null;
  const partes = cadena.split('-');
  const anio = Number(partes[0]);
  const mes = Number(partes[1]);
  const dia = Number(partes[2]);
  if (!Number.isFinite(anio) || !Number.isFinite(mes) || !Number.isFinite(dia)) return null;
  const d = new Date(anio, mes - 1, dia);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function PaginaBitacora() {
  const { proyectoActivoId } = useSesion();
  const [searchParams, setSearchParams] = useSearchParams();

  const alcance = searchParams.get('alcance') === 'todos' ? 'todos' : 'activo';
  const entidad = (searchParams.get('entidad') as EntidadBitacora) || undefined;
  const rol = (searchParams.get('rol') as Rol) || undefined;
  const accion = (searchParams.get('accion') as AccionBitacora) || undefined;
  const desde = searchParams.get('desde') || undefined;
  const hasta = searchParams.get('hasta') || undefined;
  const pagina = Math.max(1, Number(searchParams.get('pagina')) || 1);

  const proyectoId = alcance === 'activo' && proyectoActivoId ? proyectoActivoId : undefined;

  const consulta = useMemo(
    () => ({
      proyectoId,
      entidad,
      rol,
      accion,
      desde,
      hasta,
      pagina,
      tamanoPagina: 25,
    }),
    [proyectoId, entidad, rol, accion, desde, hasta, pagina],
  );

  const { data, isLoading, isError, error } = useBitacora(consulta);

  const actualizarFiltro = (claves: Record<string, string | undefined>) => {
    setSearchParams(
      (prev) => {
        const nuevo = new URLSearchParams(prev);
        Object.entries(claves).forEach(([k, v]) => {
          if (v === undefined || v === '') {
            nuevo.delete(k);
          } else {
            nuevo.set(k, v);
          }
        });
        nuevo.set('pagina', '1');
        return nuevo;
      },
      { replace: true },
    );
  };

  const cambiarPagina = (nuevaPagina: number) => {
    setSearchParams(
      (prev) => {
        const nuevo = new URLSearchParams(prev);
        nuevo.set('pagina', String(nuevaPagina));
        return nuevo;
      },
      { replace: true },
    );
  };

  const valorRangoFechas: [Date | null, Date | null] = [
    parsearFechaLocal(desde ?? null),
    parsearFechaLocal(hasta ?? null),
  ];

  return (
    <Container size="xl" py="lg">
      <Stack gap="lg">
        <Group justify="space-between" align="flex-start" wrap="wrap" gap="md">
          <div>
            <Title order={2}>Bitácora de cambios</Title>
            <Text c="dimmed" size="sm">
              Trazabilidad completa e inmutable de operaciones, aprobaciones y recálculos
            </Text>
          </div>

          <SegmentedControl
            value={alcance}
            onChange={(val) => actualizarFiltro({ alcance: val === 'todos' ? 'todos' : undefined })}
            data={[
              { label: 'Proyecto activo', value: 'activo' },
              { label: 'Todos los proyectos', value: 'todos' },
            ]}
          />
        </Group>

        {alcance === 'activo' && !proyectoActivoId && (
          <Alert icon={<IconAlertCircle size={16} />} color="blue" title="Sin proyecto activo">
            No hay un proyecto activo seleccionado. Mostrando registros globales o seleccione un
            proyecto en la cabecera.
          </Alert>
        )}

        <Paper withBorder p="md" radius="sm">
          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
            <Select
              label="Entidad"
              placeholder="Todas las entidades"
              clearable
              value={entidad ?? null}
              data={ENTIDADES_BITACORA.map((e) => ({ value: e, label: e }))}
              onChange={(val) => actualizarFiltro({ entidad: val ?? undefined })}
            />

            <Select
              label="Rol"
              placeholder="Todos los roles"
              clearable
              value={rol ?? null}
              data={ROLES.map((r) => ({ value: r, label: `${NOMBRES_ROL[r]} (${r})` }))}
              onChange={(val) => actualizarFiltro({ rol: val ?? undefined })}
            />

            <Select
              label="Acción"
              placeholder="Todas las acciones"
              clearable
              value={accion ?? null}
              data={ACCIONES_BITACORA.map((a) => ({ value: a, label: a }))}
              onChange={(val) => actualizarFiltro({ accion: val ?? undefined })}
            />

            <DatePickerInput
              type="range"
              label="Rango de fechas"
              placeholder="Desde — Hasta"
              clearable
              value={valorRangoFechas}
              onChange={([d1, d2]) => {
                actualizarFiltro({
                  desde: formatearFechaIso(d1),
                  hasta: formatearFechaIso(d2),
                });
              }}
            />
          </SimpleGrid>
        </Paper>

        {isError && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" title="Error al cargar bitácora">
            {error instanceof Error
              ? error.message
              : 'No se pudo cargar la información de la bitácora.'}
          </Alert>
        )}

        <HistorialPaginado
          respuesta={data}
          cargando={isLoading}
          pagina={pagina}
          alCambiarPagina={cambiarPagina}
        />
      </Stack>
    </Container>
  );
}
