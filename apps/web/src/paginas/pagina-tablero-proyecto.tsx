import { useState } from 'react';
import {
  Alert,
  Center,
  Container,
  Grid,
  Loader,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import type { ConsultaTablero } from '@autofix/core';
import { useProyecto } from '../api/proyectos';
import { useTablero } from '../api/tablero';
import { useSesion } from '../sesion/proveedor-sesion';
import { BarraFiltros } from '../tablero/barra-filtros';
import { GraficoCargaProfesionales } from '../tablero/grafico-carga-profesionales';
import { GraficoCostoEtapa } from '../tablero/grafico-costo-etapa';
import { GraficoCurvaS } from '../tablero/grafico-curva-s';
import { LineaTiempoHitos } from '../tablero/linea-tiempo-hitos';
import { PanelAlertas } from '../tablero/panel-alertas';
import { TablaAtrasadas } from '../tablero/tabla-atrasadas';
import { TarjetasResumen } from '../tablero/tarjetas-resumen';

export function PaginaTableroProyecto() {
  const { proyectoActivoId } = useSesion();
  const { data: proyecto } = useProyecto(proyectoActivoId ?? 0);
  const [filtros, setFiltros] = useState<ConsultaTablero>({});

  const { data: tablero, isLoading, error } = useTablero(proyectoActivoId, filtros);

  if (!proyectoActivoId) {
    return (
      <Container size="xl" py="lg">
        <Alert icon={<IconAlertCircle size={16} />} title="Proyecto no seleccionado" color="blue">
          Seleccione un proyecto activo en la barra superior para visualizar el tablero de comando.
        </Alert>
      </Container>
    );
  }

  if (isLoading) {
    return (
      <Container size="xl" py="xl">
        <Center py="xl">
          <Loader size="lg" />
        </Center>
      </Container>
    );
  }

  if (error || !tablero) {
    return (
      <Container size="xl" py="lg">
        <Alert icon={<IconAlertCircle size={16} />} title="Error al cargar tablero" color="red">
          No fue posible cargar la información del tablero del proyecto.
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="xl" py="lg">
      <Stack gap="lg">
        <div>
          <Title order={2}>Tablero de comando</Title>
          <Text size="sm" c="dimmed">
            {proyecto?.nombre ?? `Proyecto #${proyectoActivoId}`} · Indicadores y seguimiento
            integral
          </Text>
        </div>

        <BarraFiltros opciones={tablero.opciones} filtros={filtros} alCambiarFiltros={setFiltros} />

        <TarjetasResumen tarjetas={tablero.tarjetas} />

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          <GraficoCurvaS curvaS={tablero.curvaS} />
          <GraficoCostoEtapa costos={tablero.costoPorEtapa} />
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          <GraficoCargaProfesionales carga={tablero.carga} />
          <LineaTiempoHitos
            hitos={tablero.hitos}
            filtroProfesionalActivo={filtros.profesionalId !== undefined}
          />
        </SimpleGrid>

        <Grid gutter="md">
          <Grid.Col span={{ base: 12, md: 6 }}>
            <TablaAtrasadas atrasadas={tablero.atrasadas} />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <PanelAlertas alertas={tablero.alertas} />
          </Grid.Col>
        </Grid>
      </Stack>
    </Container>
  );
}
