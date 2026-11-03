import { Anchor, Badge, Popover, Stack, Table, Text, Tooltip } from '@mantine/core';
import { Link } from 'react-router';
import {
  formatearFechaHora,
  resumirValorBitacora,
  type RegistroBitacora,
  type TipoOrigenBitacora,
} from '@autofix/core';

export interface PropsTablaHistorial {
  registros: readonly RegistroBitacora[];
  cargando?: boolean;
  ocultarEntidad?: boolean;
  compacta?: boolean;
}

const COLOR_ORIGEN: Record<TipoOrigenBitacora, string> = {
  APROBACION: 'teal',
  RECHAZO: 'red',
  IMPORTACION: 'cyan',
  RECALCULO: 'violet',
  MANUAL: 'gray',
};

const COLOR_ACCION: Record<string, string> = {
  CREAR: 'green',
  ACTUALIZAR: 'blue',
  ELIMINAR: 'red',
  RECALCULAR: 'gray',
  APROBAR: 'teal',
  RECHAZAR: 'red',
  IMPORTAR: 'cyan',
  CERRAR: 'orange',
};

function CeldaValor({ valor }: { valor: unknown }) {
  const resumen = resumirValorBitacora(valor);
  if (!resumen.esObjeto) {
    return <Text size="sm">{resumen.texto}</Text>;
  }
  return (
    <Popover position="bottom" withArrow shadow="md">
      <Popover.Target>
        <Badge
          variant="light"
          style={{ cursor: 'pointer' }}
          role="button"
          aria-label={`Ver detalle de ${resumen.texto}`}
        >
          {resumen.texto}
        </Badge>
      </Popover.Target>
      <Popover.Dropdown maw={360}>
        <Stack gap={4} style={{ maxHeight: 240, overflowY: 'auto', minWidth: 180 }}>
          {resumen.detalles &&
            Object.entries(resumen.detalles).map(([clave, val]) => (
              <Text key={clave} size="xs" style={{ overflowWrap: 'anywhere' }}>
                <Text span size="xs" fw={700}>
                  {clave}:
                </Text>{' '}
                {val}
              </Text>
            ))}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

function CeldaOrigen({
  origen,
  compacta,
}: {
  origen: RegistroBitacora['origen'];
  compacta: boolean;
}) {
  const color = COLOR_ORIGEN[origen.tipo] ?? 'gray';
  const badge = (
    <Badge color={color} variant="filled" size={compacta ? 'xs' : 'md'}>
      {origen.etiqueta}
    </Badge>
  );

  const contenido = origen.solicitudCambioId ? (
    <Anchor
      component={Link}
      to={`/cambios/${origen.solicitudCambioId}`}
      underline="hover"
      style={{ display: 'inline-block' }}
    >
      {badge}
    </Anchor>
  ) : (
    badge
  );

  if (origen.detalle) {
    return (
      <Tooltip label={origen.detalle} withArrow position="top">
        <span style={{ display: 'inline-block' }}>{contenido}</span>
      </Tooltip>
    );
  }

  return contenido;
}

export function TablaHistorial({
  registros,
  cargando = false,
  ocultarEntidad = false,
  compacta = false,
}: PropsTablaHistorial) {
  const columnasVisibles = ocultarEntidad ? 7 : 8;
  const ancho = (pixeles: number) => (compacta ? undefined : { width: pixeles });

  return (
    <Table.ScrollContainer minWidth={compacta ? 520 : 800}>
      <Table
        withTableBorder
        withColumnBorders
        striped
        highlightOnHover
        fz={compacta ? 'xs' : undefined}
      >
        <Table.Thead>
          <Table.Tr>
            <Table.Th style={ancho(150)}>Fecha y hora</Table.Th>
            <Table.Th style={ancho(90)}>Rol</Table.Th>
            {!ocultarEntidad && <Table.Th style={ancho(140)}>Entidad</Table.Th>}
            <Table.Th style={ancho(110)}>Acción</Table.Th>
            <Table.Th style={ancho(130)}>Campo</Table.Th>
            <Table.Th>Valor anterior</Table.Th>
            <Table.Th>Valor nuevo</Table.Th>
            <Table.Th style={ancho(180)}>Origen</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {cargando ? (
            <Table.Tr>
              <Table.Td colSpan={columnasVisibles} ta="center" py="xl">
                <Text c="dimmed">Cargando bitácora...</Text>
              </Table.Td>
            </Table.Tr>
          ) : registros.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={columnasVisibles} ta="center" py="xl">
                <Text c="dimmed">No hay registros en la bitácora.</Text>
              </Table.Td>
            </Table.Tr>
          ) : (
            registros.map((r) => (
              <Table.Tr key={r.id}>
                <Table.Td>
                  <Text size="sm">{formatearFechaHora(r.fecha)}</Text>
                </Table.Td>
                <Table.Td>
                  <Badge
                    variant="outline"
                    color={r.rol === 'JP' ? 'blue' : r.rol === 'CC' ? 'grape' : 'gray'}
                  >
                    {r.rol ?? 'Sistema'}
                  </Badge>
                </Table.Td>
                {!ocultarEntidad && (
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {r.entidad}
                      {r.entidadId ? ` #${r.entidadId}` : ''}
                    </Text>
                  </Table.Td>
                )}
                <Table.Td>
                  <Badge
                    color={COLOR_ACCION[r.accion] ?? 'gray'}
                    variant="light"
                    size={compacta ? 'xs' : 'md'}
                  >
                    {r.accion}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{r.campo ?? '—'}</Text>
                </Table.Td>
                <Table.Td>
                  <CeldaValor valor={r.valorAnterior} />
                </Table.Td>
                <Table.Td>
                  <CeldaValor valor={r.valorNuevo} />
                </Table.Td>
                <Table.Td>
                  <CeldaOrigen origen={r.origen} compacta={compacta} />
                </Table.Td>
              </Table.Tr>
            ))
          )}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
