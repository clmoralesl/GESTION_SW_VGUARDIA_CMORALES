import { Button, Group, Menu, SegmentedControl, Switch, Tooltip } from '@mantine/core';
import {
  IconCalendarEvent,
  IconDownload,
  IconFileTypePdf,
  IconFileTypePng,
} from '@tabler/icons-react';
import type { NivelZoom } from './escala';

interface BarraHerramientasGanttProps {
  zoom: NivelZoom;
  alCambiarZoom: (zoom: NivelZoom) => void;
  alIrAHoy: () => void;
  puedeIrAHoy: boolean;
  rutaCriticaActiva: boolean;
  alCambiarRutaCritica: (activa: boolean) => void;
  lineaBaseActiva: boolean;
  alCambiarLineaBase: (activa: boolean) => void;
  tieneLineaBase: boolean;
  alExportarPng: () => void;
  alExportarPdf: () => void;
  exportando: boolean;
}

export function BarraHerramientasGantt({
  zoom,
  alCambiarZoom,
  alIrAHoy,
  puedeIrAHoy,
  rutaCriticaActiva,
  alCambiarRutaCritica,
  lineaBaseActiva,
  alCambiarLineaBase,
  tieneLineaBase,
  alExportarPng,
  alExportarPdf,
  exportando,
}: BarraHerramientasGanttProps) {
  return (
    <Group justify="space-between" mb="md" wrap="wrap">
      <Group gap="sm">
        <SegmentedControl
          value={zoom}
          onChange={(v) => alCambiarZoom(v as NivelZoom)}
          data={[
            { label: 'Día', value: 'DIA' },
            { label: 'Semana', value: 'SEMANA' },
            { label: 'Mes', value: 'MES' },
          ]}
          size="sm"
        />
        <Button
          variant="light"
          size="sm"
          leftSection={<IconCalendarEvent size={16} />}
          onClick={alIrAHoy}
          disabled={!puedeIrAHoy}
        >
          Ir a hoy
        </Button>
      </Group>

      <Group gap="md">
        <Switch
          label="Ruta crítica"
          checked={rutaCriticaActiva}
          onChange={(e) => alCambiarRutaCritica(e.currentTarget.checked)}
          size="sm"
        />

        <Tooltip
          label={
            tieneLineaBase
              ? 'Muestra la línea base vigente'
              : 'El proyecto no tiene línea base registrada'
          }
          disabled={tieneLineaBase}
        >
          <span>
            <Switch
              label="Línea base"
              checked={lineaBaseActiva && tieneLineaBase}
              onChange={(e) => alCambiarLineaBase(e.currentTarget.checked)}
              disabled={!tieneLineaBase}
              size="sm"
            />
          </span>
        </Tooltip>

        <Menu shadow="md" width={180}>
          <Menu.Target>
            <Button
              variant="default"
              size="sm"
              leftSection={<IconDownload size={16} />}
              loading={exportando}
            >
              Exportar
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item leftSection={<IconFileTypePng size={16} />} onClick={alExportarPng}>
              Exportar PNG
            </Menu.Item>
            <Menu.Item leftSection={<IconFileTypePdf size={16} />} onClick={alExportarPdf}>
              Exportar PDF
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>
    </Group>
  );
}
