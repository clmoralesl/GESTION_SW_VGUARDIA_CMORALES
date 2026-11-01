import { useState } from 'react';
import { Alert, Center, Container, Loader, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import type { ConsultaTableroCambio } from '@autofix/core';
import { useProyecto } from '../api/proyectos';
import { useTableroCambio } from '../api/tablero-cambio';
import { useSesion } from '../sesion/proveedor-sesion';
import { BarraFiltros } from '../tablero-cambio/barra-filtros';
import { GraficoEmbudo } from '../tablero-cambio/grafico-embudo';
import { GraficoTiemposAdopcion } from '../tablero-cambio/grafico-tiempos-adopcion';
import { GrillaKpis } from '../tablero-cambio/grilla-kpis';
import { MatrizRiesgo } from '../tablero-cambio/matriz-riesgo';
import { PanelAlertas } from '../tablero-cambio/panel-alertas';
import { TarjetasResumen } from '../tablero-cambio/tarjetas-resumen';

export function PaginaTableroCambio() {
  const { proyectoActivoId } = useSesion();
  const { data: proyecto } = useProyecto(proyectoActivoId ?? 0);
  const [filtros, setFiltros] = useState<ConsultaTableroCambio>({});

  const { data: tablero, isLoading, error } = useTableroCambio(proyectoActivoId, filtros);

  if (!proyectoActivoId) {
    return (
      <Container size="xl" py="lg">
        <Alert icon={<IconAlertCircle size={16} />} title="Proyecto no seleccionado" color="blue">
          Seleccione un proyecto activo en la barra superior para visualizar el tablero de gestión
          del cambio.
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="xl" py="lg">
      <Stack gap="lg">
        <div>
          <Title order={2}>Tablero de gestión del cambio</Title>
          <Text size="sm" c="dimmed">
            {proyecto?.nombre ?? `Proyecto #${proyectoActivoId}`}
            {tablero ? ` · Fecha de corte: ${tablero.corte}` : ''}
          </Text>
        </div>

        <BarraFiltros
          opciones={tablero?.opciones ?? { responsables: [] }}
          filtros={filtros}
          alCambiarFiltros={setFiltros}
        />

        {isLoading && !tablero ? (
          <Center py="xl">
            <Loader size="lg" />
          </Center>
        ) : error || !tablero ? (
          <Alert
            icon={<IconAlertCircle size={16} />}
            title="Error al cargar tablero de cambio"
            color="red"
          >
            No fue posible cargar la información del tablero de gestión del cambio.
          </Alert>
        ) : (
          <>
            <TarjetasResumen resumen={tablero.resumen} />

            <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
              <GraficoEmbudo embudo={tablero.embudo} />
              <MatrizRiesgo matriz={tablero.matrizRiesgo} />
            </SimpleGrid>

            <GraficoTiemposAdopcion tiempos={tablero.tiemposPorEtapa} adopcion={tablero.adopcion} />

            <GrillaKpis kpis={tablero.kpis} />

            <PanelAlertas alertas={tablero.alertas} />
          </>
        )}
      </Stack>
    </Container>
  );
}
