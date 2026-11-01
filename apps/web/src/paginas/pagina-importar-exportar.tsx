import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Alert,
  Badge,
  Button,
  Card,
  FileInput,
  Grid,
  Group,
  Modal,
  Paper,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconCheck,
  IconDownload,
  IconFileSpreadsheet,
  IconUpload,
} from '@tabler/icons-react';
import { useProyectos } from '../api/proyectos';
import {
  descargarPlantilla,
  exportarProyecto,
  useConfirmarImportacion,
  useVistaPrevia,
  type ResultadoVistaPrevia,
} from '../api/importaciones';
import { usePermisos } from '../sesion/use-permisos';

export function PaginaImportarExportar() {
  const navigate = useNavigate();
  const { puede } = usePermisos();
  const puedeImportar = puede('importarDatos');

  const { data: proyectos, isLoading: cargandoProyectos } = useProyectos();

  const [proyectoAExportarId, setProyectoAExportarId] = useState<string | null>(null);
  const [descargandoPlantilla, setDescargandoPlantilla] = useState(false);
  const [exportandoProyecto, setExportandoProyecto] = useState(false);

  const [destinoTipo, setDestinoTipo] = useState<'nuevo' | 'existente'>('nuevo');
  const [proyectoDestinoId, setProyectoDestinoId] = useState<string | null>(null);
  const [archivoSeleccionado, setArchivoSeleccionado] = useState<File | null>(null);
  const [vistaPrevia, setVistaPrevia] = useState<ResultadoVistaPrevia | null>(null);
  const [modalReemplazoAbierto, setModalReemplazoAbierto] = useState(false);

  const mutacionVistaPrevia = useVistaPrevia();
  const mutacionConfirmar = useConfirmarImportacion();

  const handleDescargarPlantilla = async () => {
    try {
      setDescargandoPlantilla(true);
      await descargarPlantilla();
      notifications.show({
        color: 'teal',
        title: 'Plantilla descargada',
        message: 'La plantilla plantilla_carga_autofix.xlsx se ha descargado correctamente.',
      });
    } catch (err: unknown) {
      notifications.show({
        color: 'red',
        title: 'Error de descarga',
        message: (err as Error)?.message ?? 'No se pudo descargar la plantilla.',
      });
    } finally {
      setDescargandoPlantilla(false);
    }
  };

  const handleExportarProyecto = async () => {
    if (!proyectoAExportarId) return;
    try {
      setExportandoProyecto(true);
      await exportarProyecto(Number(proyectoAExportarId));
      notifications.show({
        color: 'teal',
        title: 'Proyecto exportado',
        message: 'El proyecto se ha exportado correctamente a formato Excel.',
      });
    } catch (err: unknown) {
      notifications.show({
        color: 'red',
        title: 'Error al exportar',
        message: (err as Error)?.message ?? 'No se pudo exportar el proyecto seleccionado.',
      });
    } finally {
      setExportandoProyecto(false);
    }
  };

  const handleCargarVistaPrevia = async () => {
    if (!archivoSeleccionado) return;
    try {
      const pId =
        destinoTipo === 'existente' && proyectoDestinoId ? Number(proyectoDestinoId) : undefined;
      const resultado = await mutacionVistaPrevia.mutateAsync({
        archivo: archivoSeleccionado,
        proyectoId: pId,
      });
      setVistaPrevia(resultado);
      if (resultado.valido) {
        notifications.show({
          color: 'teal',
          title: 'Vista previa validada',
          message: 'El archivo cumple con la estructura y reglas de validación.',
        });
      } else {
        notifications.show({
          color: 'red',
          title: 'Errores en archivo',
          message: `Se encontraron ${resultado.errores.length} errores de validación.`,
        });
      }
    } catch (err: unknown) {
      notifications.show({
        color: 'red',
        title: 'Error al analizar archivo',
        message: (err as Error)?.message ?? 'Ocurrió un error al procesar el archivo.',
      });
    }
  };

  const ejecutarConfirmacion = async (reemplazar: boolean) => {
    if (!archivoSeleccionado) return;
    try {
      const pId =
        destinoTipo === 'existente' && proyectoDestinoId ? Number(proyectoDestinoId) : undefined;
      const res = await mutacionConfirmar.mutateAsync({
        archivo: archivoSeleccionado,
        proyectoId: pId,
        reemplazar,
      });

      notifications.show({
        color: 'teal',
        title: 'Importación exitosa',
        message: `Proyecto importado. Tareas: ${res.conteos.tareas}, Dependencias: ${res.conteos.dependencias}, Asignaciones: ${res.conteos.asignaciones}.`,
      });

      setModalReemplazoAbierto(false);
      navigate(`/proyectos/${res.proyectoId}`);
    } catch (err: unknown) {
      notifications.show({
        color: 'red',
        title: 'Error de importación',
        message: (err as Error)?.message ?? 'No se pudo completar la importación.',
      });
    }
  };

  const handleConfirmarClic = () => {
    if (!vistaPrevia || !vistaPrevia.valido) return;
    if (vistaPrevia.destino.tieneDatos) {
      setModalReemplazoAbierto(true);
    } else {
      ejecutarConfirmacion(false);
    }
  };

  const opcionesProyectos = (proyectos ?? []).map((p) => ({
    value: String(p.id),
    label: `${p.nombre} (ID: ${p.id})`,
  }));

  return (
    <Stack gap="xl">
      <div>
        <Title order={2}>Importar y Exportar Datos</Title>
        <Text c="dimmed" size="sm">
          Gestión de plantillas de carga inicial y exportación completa de proyectos en formato
          Excel (.xlsx).
        </Text>
      </div>

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card withBorder padding="lg" radius="md">
            <Stack gap="sm">
              <Group justify="space-between">
                <Text fw={600} size="md">
                  Plantilla de Carga Inicial
                </Text>
                <IconFileSpreadsheet size={24} color="#1E3A8A" />
              </Group>
              <Text size="sm" c="dimmed">
                Descargue la plantilla oficial en blanco con 12 hojas preconfiguradas, reglas de
                validación y listas desplegables.
              </Text>
              <Button
                variant="light"
                leftSection={<IconDownload size={18} />}
                onClick={handleDescargarPlantilla}
                loading={descargandoPlantilla}
              >
                Descargar plantilla
              </Button>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card withBorder padding="lg" radius="md">
            <Stack gap="sm">
              <Group justify="space-between">
                <Text fw={600} size="md">
                  Exportar Proyecto Existente
                </Text>
                <IconDownload size={24} color="#0D9488" />
              </Group>
              <Text size="sm" c="dimmed">
                Exporte toda la información de un proyecto a un archivo Excel compatible para
                respaldo o edición masiva.
              </Text>
              <Group align="flex-end" grow>
                <Select
                  placeholder="Seleccione un proyecto"
                  data={opcionesProyectos}
                  value={proyectoAExportarId}
                  onChange={setProyectoAExportarId}
                  disabled={cargandoProyectos}
                  clearable
                />
                <Button
                  variant="outline"
                  leftSection={<IconDownload size={18} />}
                  onClick={handleExportarProyecto}
                  disabled={!proyectoAExportarId}
                  loading={exportandoProyecto}
                >
                  Exportar
                </Button>
              </Group>
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      {!puedeImportar ? (
        <Alert icon={<IconAlertTriangle size={18} />} title="Acceso restringido" color="yellow">
          La carga e importación de datos en el sistema está restringida al rol Jefe de Proyecto
          (JP). Como Comité de Cambios (CC) puede descargar la plantilla oficial y exportar
          proyectos existentes.
        </Alert>
      ) : (
        <Card withBorder padding="lg" radius="md">
          <Stack gap="md">
            <Group justify="space-between">
              <div>
                <Text fw={600} size="lg">
                  Cargar Archivo Excel para Importación
                </Text>
                <Text size="sm" c="dimmed">
                  Seleccione el destino y el archivo Excel (.xlsx) para validar antes de guardar en
                  la base de datos.
                </Text>
              </div>
              <IconUpload size={24} color="#2563EB" />
            </Group>

            <Group align="flex-start" grow>
              <Stack gap="xs">
                <Text size="sm" fw={500}>
                  Destino de la importación
                </Text>
                <SegmentedControl
                  value={destinoTipo}
                  onChange={(val) => {
                    setDestinoTipo(val as 'nuevo' | 'existente');
                    setVistaPrevia(null);
                  }}
                  data={[
                    { label: 'Proyecto nuevo', value: 'nuevo' },
                    { label: 'Proyecto existente', value: 'existente' },
                  ]}
                />
                {destinoTipo === 'existente' && (
                  <Select
                    label="Proyecto a reemplazar"
                    placeholder="Seleccione proyecto destino"
                    data={opcionesProyectos}
                    value={proyectoDestinoId}
                    onChange={(val) => {
                      setProyectoDestinoId(val);
                      setVistaPrevia(null);
                    }}
                    required
                  />
                )}
              </Stack>

              <Stack gap="xs">
                <FileInput
                  label="Archivo Excel (.xlsx)"
                  placeholder="Seleccionar archivo"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  value={archivoSeleccionado}
                  onChange={(file) => {
                    setArchivoSeleccionado(file);
                    setVistaPrevia(null);
                  }}
                  clearable
                  leftSection={<IconFileSpreadsheet size={18} />}
                />
                <Button
                  onClick={handleCargarVistaPrevia}
                  disabled={
                    !archivoSeleccionado || (destinoTipo === 'existente' && !proyectoDestinoId)
                  }
                  loading={mutacionVistaPrevia.isPending}
                  leftSection={<IconUpload size={18} />}
                >
                  Cargar y previsualizar
                </Button>
              </Stack>
            </Group>
          </Stack>
        </Card>
      )}

      {vistaPrevia && (
        <Stack gap="md">
          <Paper withBorder p="md" radius="md">
            <Group justify="space-between" mb="xs">
              <Group gap="sm">
                <Text fw={600} size="md">
                  Resultado de la Validación
                </Text>
                {vistaPrevia.valido ? (
                  <Badge color="green" leftSection={<IconCheck size={14} />}>
                    Válido para importación
                  </Badge>
                ) : (
                  <Badge color="red" leftSection={<IconAlertCircle size={14} />}>
                    Contiene errores
                  </Badge>
                )}
                {vistaPrevia.truncado && <Badge color="orange">Errores truncados a 200</Badge>}
                {vistaPrevia.destino.tieneDatos && (
                  <Badge color="yellow">Proyecto destino contiene datos</Badge>
                )}
              </Group>

              {puedeImportar && (
                <Button
                  color="teal"
                  onClick={handleConfirmarClic}
                  disabled={!vistaPrevia.valido}
                  loading={mutacionConfirmar.isPending}
                >
                  Confirmar importación
                </Button>
              )}
            </Group>

            <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
              <Paper withBorder p="xs">
                <Text size="xs" c="dimmed">
                  Hojas analizadas
                </Text>
                <Text fw={700} size="xl">
                  {vistaPrevia.hojas.length}
                </Text>
              </Paper>
              <Paper withBorder p="xs">
                <Text size="xs" c="dimmed">
                  Total errores
                </Text>
                <Text fw={700} size="xl" c={vistaPrevia.errores.length > 0 ? 'red' : 'teal'}>
                  {vistaPrevia.errores.length}
                </Text>
              </Paper>
              <Paper withBorder p="xs">
                <Text size="xs" c="dimmed">
                  Advertencias
                </Text>
                <Text fw={700} size="xl" c="orange">
                  {vistaPrevia.advertencias.length}
                </Text>
              </Paper>
              <Paper withBorder p="xs">
                <Text size="xs" c="dimmed">
                  Destino
                </Text>
                <Text fw={600} size="sm">
                  {vistaPrevia.destino.proyectoId
                    ? `ID: ${vistaPrevia.destino.proyectoId}`
                    : 'Proyecto nuevo'}
                </Text>
              </Paper>
            </SimpleGrid>
          </Paper>

          {vistaPrevia.advertencias.length > 0 && (
            <Alert
              icon={<IconAlertTriangle size={18} />}
              title="Advertencias detectadas"
              color="yellow"
            >
              <Stack gap="xs">
                {vistaPrevia.advertencias.map((adv, idx) => (
                  <Text size="sm" key={`adv-${idx}`}>
                    <strong>[{adv.celda}]</strong> {adv.mensaje}
                  </Text>
                ))}
              </Stack>
            </Alert>
          )}

          <Tabs defaultValue="resumen">
            <Tabs.List>
              <Tabs.Tab value="resumen">Resumen por Hoja</Tabs.Tab>
              <Tabs.Tab value="errores" color={vistaPrevia.errores.length > 0 ? 'red' : 'gray'}>
                Errores ({vistaPrevia.errores.length})
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="resumen" pt="sm">
              <Table striped highlightOnHover withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Hoja</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Total Filas</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Válidas</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Con Errores</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {vistaPrevia.hojas.map((h) => (
                    <Table.Tr key={h.hoja}>
                      <Table.Td fw={500}>{h.hoja}</Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>{h.filas}</Table.Td>
                      <Table.Td style={{ textAlign: 'right' }} c="teal">
                        {h.validas}
                      </Table.Td>
                      <Table.Td
                        style={{ textAlign: 'right' }}
                        c={h.invalidas > 0 ? 'red' : 'dimmed'}
                      >
                        {h.invalidas}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Tabs.Panel>

            <Tabs.Panel value="errores" pt="sm">
              {vistaPrevia.errores.length === 0 ? (
                <Text size="sm" c="dimmed" p="md">
                  No se detectaron errores en las hojas analizadas.
                </Text>
              ) : (
                <Table striped highlightOnHover withTableBorder>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Celda</Table.Th>
                      <Table.Th>Hoja</Table.Th>
                      <Table.Th>Fila</Table.Th>
                      <Table.Th>Columna</Table.Th>
                      <Table.Th>Descripción del error</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {vistaPrevia.errores.map((err, idx) => (
                      <Table.Tr key={`err-${idx}`}>
                        <Table.Td>
                          <Badge color="red" variant="light">
                            {err.celda}
                          </Badge>
                        </Table.Td>
                        <Table.Td>{err.hoja}</Table.Td>
                        <Table.Td>{err.fila}</Table.Td>
                        <Table.Td>{err.columna}</Table.Td>
                        <Table.Td c="red">{err.mensaje}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}
            </Tabs.Panel>
          </Tabs>
        </Stack>
      )}

      <Modal
        opened={modalReemplazoAbierto}
        onClose={() => setModalReemplazoAbierto(false)}
        title="Confirmar reemplazo de datos del proyecto"
        centered
      >
        <Stack gap="md">
          <Alert color="red" icon={<IconAlertCircle size={18} />}>
            El proyecto destino contiene tareas, dependencias, asignaciones o solicitudes
            registradas. Al confirmar la importación, se eliminarán permanentemente todos los datos
            existentes del proyecto y se reemplazarán por el contenido del archivo.
          </Alert>
          <Text size="sm">
            ¿Está seguro de que desea proceder con el reemplazo completo de los datos del proyecto?
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button
              variant="default"
              onClick={() => setModalReemplazoAbierto(false)}
              disabled={mutacionConfirmar.isPending}
            >
              Cancelar
            </Button>
            <Button
              color="red"
              onClick={() => ejecutarConfirmacion(true)}
              loading={mutacionConfirmar.isPending}
            >
              Reemplazar y continuar
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
