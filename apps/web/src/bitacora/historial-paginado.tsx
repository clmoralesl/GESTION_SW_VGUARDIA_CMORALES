import { useState } from 'react';
import { Group, Pagination, Stack, Text } from '@mantine/core';
import type { RespuestaBitacora } from '@autofix/core';
import { useHistorialSolicitud, useHistorialTarea } from '../api/bitacora';
import { TablaHistorial } from './tabla-historial';

export interface PropsHistorialPaginado {
  respuesta: RespuestaBitacora | undefined;
  cargando: boolean;
  pagina: number;
  alCambiarPagina: (pagina: number) => void;
  ocultarEntidad?: boolean;
  compacta?: boolean;
}

export function HistorialPaginado({
  respuesta,
  cargando,
  pagina,
  alCambiarPagina,
  ocultarEntidad = false,
  compacta = false,
}: PropsHistorialPaginado) {
  const total = respuesta?.total ?? 0;
  const totalPaginas = respuesta?.totalPaginas ?? 0;

  return (
    <Stack gap="sm">
      <TablaHistorial
        registros={respuesta?.registros ?? []}
        cargando={cargando}
        ocultarEntidad={ocultarEntidad}
        compacta={compacta}
      />
      <Group justify="space-between" align="center" wrap="wrap" gap="md">
        <Text size="sm" c="dimmed">
          {total === 0
            ? 'Sin registros'
            : `Página ${pagina} de ${Math.max(1, totalPaginas)} (${total} registros en total)`}
        </Text>
        {totalPaginas > 1 && (
          <Pagination
            value={pagina}
            onChange={alCambiarPagina}
            total={totalPaginas}
            siblings={1}
            boundaries={1}
          />
        )}
      </Group>
    </Stack>
  );
}

export function HistorialTareaPanel({ tareaId }: { tareaId: number }) {
  const [pagina, setPagina] = useState(1);
  const { data, isLoading } = useHistorialTarea(tareaId, { pagina });
  return (
    <HistorialPaginado
      respuesta={data}
      cargando={isLoading}
      pagina={pagina}
      alCambiarPagina={setPagina}
      ocultarEntidad
      compacta
    />
  );
}

export function HistorialSolicitudPanel({ solicitudId }: { solicitudId: number }) {
  const [pagina, setPagina] = useState(1);
  const { data, isLoading } = useHistorialSolicitud(solicitudId, { pagina });
  return (
    <HistorialPaginado
      respuesta={data}
      cargando={isLoading}
      pagina={pagina}
      alCambiarPagina={setPagina}
    />
  );
}
