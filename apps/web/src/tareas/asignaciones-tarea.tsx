import { useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  Modal,
  NumberInput,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconAlertCircle, IconEdit, IconPlus, IconTrash } from '@tabler/icons-react';
import {
  calcularHorasPlan,
  formatearMonto,
  type AsignacionResumen,
  type EstadoProyecto,
  type TareaArbol,
} from '@autofix/core';
import {
  useActualizarAsignacion,
  useAsignaciones,
  useCrearAsignacion,
  useEliminarAsignacion,
} from '../api/asignaciones';
import { useProfesionales, useRecursos } from '../api/catalogos';
import { AccionProtegida, BotonProtegido } from '../componentes/boton-protegido';
import { usePermisos } from '../sesion/use-permisos';

interface AsignacionesTareaProps {
  tarea: TareaArbol;
  proyectoId: number;
  estadoProyecto?: EstadoProyecto;
}

export function AsignacionesTarea({ tarea, proyectoId, estadoProyecto }: AsignacionesTareaProps) {
  const { puede } = usePermisos();
  const edicionHabilitada = puede('editarPlanificacion', estadoProyecto);

  const { data: asignaciones = [] } = useAsignaciones(tarea.id);
  const { data: profesionales = [] } = useProfesionales();
  const { data: recursos = [] } = useRecursos();

  const crearMutacion = useCrearAsignacion(tarea.id, proyectoId);
  const actualizarMutacion = useActualizarAsignacion(tarea.id, proyectoId);
  const eliminarMutacion = useEliminarAsignacion(tarea.id, proyectoId);

  const [modalCrearAbierto, setModalCrearAbierto] = useState(false);
  const [asignacionAEditar, setAsignacionAEditar] = useState<AsignacionResumen | null>(null);

  const profesionalesActivos = useMemo(
    () => profesionales.filter((p) => p.activo),
    [profesionales],
  );

  const recursosActivos = useMemo(() => recursos.filter((r) => r.activo), [recursos]);

  const [tipoDestino, setTipoDestino] = useState<'profesional' | 'recurso'>('profesional');
  const [profesionalId, setProfesionalId] = useState<string | null>(null);
  const [recursoId, setRecursoId] = useState<string | null>(null);
  const [dedicacion, setDedicacion] = useState<number | string>(100);
  const [horasPlan, setHorasPlan] = useState<number | string | ''>('');
  const [horasReales, setHorasReales] = useState<number | string | ''>('');
  const [cantidadPlan, setCantidadPlan] = useState<number | string>(1);
  const [cantidadReal, setCantidadReal] = useState<number | string | ''>('');
  const [errorForm, setErrorForm] = useState<string | null>(null);

  const [dedicacionEdit, setDedicacionEdit] = useState<number | string>(100);
  const [horasPlanEdit, setHorasPlanEdit] = useState<number | string | ''>('');
  const [horasRealesEdit, setHorasRealesEdit] = useState<number | string | ''>('');
  const [cantidadPlanEdit, setCantidadPlanEdit] = useState<number | string>(1);
  const [cantidadRealEdit, setCantidadRealEdit] = useState<number | string | ''>('');
  const [actualizarTarifa, setActualizarTarifa] = useState(false);

  const profesionalSeleccionado = useMemo(() => {
    if (!profesionalId) return null;
    return profesionalesActivos.find((p) => String(p.id) === profesionalId) ?? null;
  }, [profesionalId, profesionalesActivos]);

  const horasSugeridas = useMemo(() => {
    if (!profesionalSeleccionado) return 0;
    const ded = typeof dedicacion === 'number' ? dedicacion : Number(dedicacion) || 0;
    return calcularHorasPlan(tarea.duracionDias, profesionalSeleccionado.horasDiarias, ded);
  }, [profesionalSeleccionado, dedicacion, tarea.duracionDias]);

  const abrirCrear = () => {
    setTipoDestino('profesional');
    setProfesionalId(profesionalesActivos[0] ? String(profesionalesActivos[0].id) : null);
    setRecursoId(recursosActivos[0] ? String(recursosActivos[0].id) : null);
    setDedicacion(100);
    setHorasPlan('');
    setHorasReales('');
    setCantidadPlan(1);
    setCantidadReal('');
    setErrorForm(null);
    setModalCrearAbierto(true);
  };

  const abrirEditar = (asig: AsignacionResumen) => {
    setAsignacionAEditar(asig);
    setDedicacionEdit(asig.dedicacion ?? 100);
    setHorasPlanEdit(asig.horasPlanManual && asig.horasPlan !== null ? asig.horasPlan : '');
    setHorasRealesEdit(asig.horasReales !== null ? asig.horasReales : '');
    setCantidadPlanEdit(asig.cantidadPlan !== null ? asig.cantidadPlan : 1);
    setCantidadRealEdit(asig.cantidadReal !== null ? asig.cantidadReal : '');
    setActualizarTarifa(false);
    setErrorForm(null);
  };

  const guardarCreacion = async () => {
    setErrorForm(null);
    try {
      if (tipoDestino === 'profesional') {
        if (!profesionalId) {
          setErrorForm('Seleccione un profesional.');
          return;
        }
        await crearMutacion.mutateAsync({
          profesionalId: Number(profesionalId),
          dedicacion: Number(dedicacion),
          horasPlan: horasPlan === '' ? null : Number(horasPlan),
          horasReales: horasReales === '' ? null : Number(horasReales),
        });
      } else {
        if (!recursoId) {
          setErrorForm('Seleccione un recurso.');
          return;
        }
        await crearMutacion.mutateAsync({
          recursoId: Number(recursoId),
          cantidadPlan: Number(cantidadPlan),
          cantidadReal: cantidadReal === '' ? null : Number(cantidadReal),
        });
      }
      setModalCrearAbierto(false);
    } catch (err: unknown) {
      const mensaje =
        err && typeof err === 'object' && 'mensaje' in err
          ? String((err as { mensaje: unknown }).mensaje)
          : 'Error al registrar la asignación.';
      setErrorForm(mensaje);
    }
  };

  const guardarEdicion = async () => {
    if (!asignacionAEditar) return;
    setErrorForm(null);
    try {
      if (asignacionAEditar.profesionalId !== null) {
        await actualizarMutacion.mutateAsync({
          asignacionId: asignacionAEditar.id,
          datos: {
            dedicacion: Number(dedicacionEdit),
            horasPlan: horasPlanEdit === '' ? null : Number(horasPlanEdit),
            horasReales: horasRealesEdit === '' ? null : Number(horasRealesEdit),
            actualizarTarifa,
          },
        });
      } else {
        await actualizarMutacion.mutateAsync({
          asignacionId: asignacionAEditar.id,
          datos: {
            cantidadPlan: Number(cantidadPlanEdit),
            cantidadReal: cantidadRealEdit === '' ? null : Number(cantidadRealEdit),
            actualizarTarifa,
          },
        });
      }
      setAsignacionAEditar(null);
    } catch (err: unknown) {
      const mensaje =
        err && typeof err === 'object' && 'mensaje' in err
          ? String((err as { mensaje: unknown }).mensaje)
          : 'Error al actualizar la asignación.';
      setErrorForm(mensaje);
    }
  };

  const confirmarEliminar = (asig: AsignacionResumen) => {
    const nombre = asig.profesional?.nombre ?? asig.recurso?.nombre ?? 'la asignación';
    modals.openConfirmModal({
      title: 'Confirmar eliminación',
      children: <Text size="sm">¿Desea eliminar la asignación de {nombre} de esta tarea?</Text>,
      labels: { confirm: 'Eliminar', cancel: 'Cancelar' },
      confirmProps: { color: 'red' },
      onConfirm: () => eliminarMutacion.mutate(asig.id),
    });
  };

  return (
    <Card withBorder radius="md" p="md">
      <Group justify="space-between" mb="xs">
        <Title order={5}>Asignaciones</Title>
        <BotonProtegido
          permiso="editarPlanificacion"
          estadoProyecto={estadoProyecto}
          size="xs"
          leftSection={<IconPlus size={14} />}
          onClick={abrirCrear}
        >
          Agregar asignación
        </BotonProtegido>
      </Group>

      {asignaciones.length === 0 ? (
        <Text size="sm" c="dimmed">
          Sin profesionales ni recursos asignados a esta tarea.
        </Text>
      ) : (
        <Table.ScrollContainer minWidth={600}>
          <Table verticalSpacing="xs" striped withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Tipo</Table.Th>
                <Table.Th>Nombre</Table.Th>
                <Table.Th>Dedicación / Cantidad</Table.Th>
                <Table.Th>Horas / Cantidad Plan</Table.Th>
                <Table.Th>Horas / Cantidad Real</Table.Th>
                <Table.Th>Tarifa Aplicada</Table.Th>
                <Table.Th>Costo Plan</Table.Th>
                {edicionHabilitada && <Table.Th style={{ width: 80 }}>Acciones</Table.Th>}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {asignaciones.map((a) => {
                const esProf = a.profesionalId !== null;
                const nombre = esProf
                  ? (a.profesional?.nombre ?? `Profesional #${a.profesionalId}`)
                  : (a.recurso?.nombre ?? `Recurso #${a.recursoId}`);
                const tarifa = esProf
                  ? `${formatearMonto(a.tarifaAplicada ?? 0)} / h`
                  : `${formatearMonto(a.costoUnitarioAplicado ?? 0)} / ${a.recurso?.unidad ?? 'u'}`;

                return (
                  <Table.Tr key={a.id}>
                    <Table.Td>
                      <Badge color={esProf ? 'blue' : 'teal'} size="sm" variant="light">
                        {esProf ? 'Profesional' : 'Recurso'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={500}>
                        {nombre}
                      </Text>
                      {esProf && a.profesional?.cargo && (
                        <Text size="xs" c="dimmed">
                          {a.profesional.cargo}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {esProf
                          ? `${a.dedicacion} %`
                          : `${a.cantidadPlan ?? 0} ${a.recurso?.unidad ?? ''}`}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {esProf ? `${a.horasPlan ?? 0} h` : `${a.cantidadPlan ?? 0}`}
                      </Text>
                      {esProf && a.horasPlanManual && (
                        <Badge size="xs" color="gray" variant="outline">
                          manual
                        </Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {esProf
                          ? a.horasReales !== null
                            ? `${a.horasReales} h`
                            : '—'
                          : a.cantidadReal !== null
                            ? `${a.cantidadReal}`
                            : '—'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{tarifa}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={600}>
                        {formatearMonto(a.costoPlan)}
                      </Text>
                    </Table.Td>
                    {edicionHabilitada && (
                      <Table.Td>
                        <Group gap={4} wrap="nowrap">
                          <AccionProtegida
                            size="sm"
                            variant="subtle"
                            color="blue"
                            permiso="editarPlanificacion"
                            estadoProyecto={estadoProyecto}
                            tooltip={`Editar asignación de ${nombre}`}
                            onClick={() => abrirEditar(a)}
                          >
                            <IconEdit size={16} />
                          </AccionProtegida>

                          <AccionProtegida
                            size="sm"
                            variant="subtle"
                            color="red"
                            permiso="editarPlanificacion"
                            estadoProyecto={estadoProyecto}
                            tooltip={`Eliminar asignación de ${nombre}`}
                            onClick={() => confirmarEliminar(a)}
                          >
                            <IconTrash size={16} />
                          </AccionProtegida>
                        </Group>
                      </Table.Td>
                    )}
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}

      <Modal
        opened={modalCrearAbierto}
        onClose={() => setModalCrearAbierto(false)}
        title="Agregar asignación a la tarea"
      >
        <Stack gap="md">
          <SegmentedControl
            value={tipoDestino}
            onChange={(v) => {
              setTipoDestino(v as 'profesional' | 'recurso');
              setErrorForm(null);
            }}
            data={[
              { label: 'Profesional', value: 'profesional' },
              { label: 'Recurso', value: 'recurso' },
            ]}
          />

          {errorForm && (
            <Alert color="red" icon={<IconAlertCircle size={16} />}>
              {errorForm}
            </Alert>
          )}

          {tipoDestino === 'profesional' ? (
            <>
              <Select
                label="Profesional"
                placeholder="Seleccione profesional"
                data={profesionalesActivos.map((p) => ({
                  value: String(p.id),
                  label: `${p.nombre} (${p.cargo} · ${formatearMonto(p.tarifaHora)}/h)`,
                }))}
                value={profesionalId}
                onChange={setProfesionalId}
                required
              />

              <NumberInput
                label="Dedicación (%)"
                min={1}
                max={100}
                value={dedicacion}
                onChange={setDedicacion}
                required
              />

              <NumberInput
                label="Horas planificadas"
                placeholder={`Sugeridas: ${horasSugeridas} h`}
                value={horasPlan}
                onChange={setHorasPlan}
                min={0}
                description="Opcional. Si se deja vacío se calcula automáticamente según duración y horas por día."
              />

              <NumberInput
                label="Horas reales"
                placeholder="0"
                value={horasReales}
                onChange={setHorasReales}
                min={0}
              />
            </>
          ) : (
            <>
              <Select
                label="Recurso"
                placeholder="Seleccione recurso"
                data={recursosActivos.map((r) => ({
                  value: String(r.id),
                  label: `${r.nombre} (${r.tipoRecurso.nombre} · ${formatearMonto(r.costoUnitario)}/${r.unidad})`,
                }))}
                value={recursoId}
                onChange={setRecursoId}
                required
              />

              <NumberInput
                label="Cantidad planificada"
                min={0}
                value={cantidadPlan}
                onChange={setCantidadPlan}
                required
              />

              <NumberInput
                label="Cantidad real"
                placeholder="0"
                value={cantidadReal}
                onChange={setCantidadReal}
                min={0}
              />
            </>
          )}

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setModalCrearAbierto(false)}>
              Cancelar
            </Button>
            <Button onClick={guardarCreacion} loading={crearMutacion.isPending}>
              Guardar asignación
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={asignacionAEditar !== null}
        onClose={() => setAsignacionAEditar(null)}
        title="Editar asignación"
      >
        {asignacionAEditar && (
          <Stack gap="md">
            {errorForm && (
              <Alert color="red" icon={<IconAlertCircle size={16} />}>
                {errorForm}
              </Alert>
            )}

            {asignacionAEditar.profesionalId !== null ? (
              <>
                <Text size="sm" fw={500}>
                  Profesional: {asignacionAEditar.profesional?.nombre}
                </Text>

                <NumberInput
                  label="Dedicación (%)"
                  min={1}
                  max={100}
                  value={dedicacionEdit}
                  onChange={setDedicacionEdit}
                  required
                />

                <NumberInput
                  label="Horas planificadas"
                  placeholder="Automáticas según duración"
                  value={horasPlanEdit}
                  onChange={setHorasPlanEdit}
                  min={0}
                  description="Vaciar para volver al cálculo automático."
                />

                <NumberInput
                  label="Horas reales"
                  value={horasRealesEdit}
                  onChange={setHorasRealesEdit}
                  min={0}
                />

                <Checkbox
                  label="Actualizar tarifa a vigente del catálogo"
                  description={`Tarifa aplicada actual: ${formatearMonto(asignacionAEditar.tarifaAplicada ?? 0)} / h`}
                  checked={actualizarTarifa}
                  onChange={(e) => setActualizarTarifa(e.currentTarget.checked)}
                />
              </>
            ) : (
              <>
                <Text size="sm" fw={500}>
                  Recurso: {asignacionAEditar.recurso?.nombre}
                </Text>

                <NumberInput
                  label="Cantidad planificada"
                  min={0}
                  value={cantidadPlanEdit}
                  onChange={setCantidadPlanEdit}
                  required
                />

                <NumberInput
                  label="Cantidad real"
                  value={cantidadRealEdit}
                  onChange={setCantidadRealEdit}
                  min={0}
                />

                <Checkbox
                  label="Actualizar costo unitario a vigente del catálogo"
                  description={`Costo aplicado actual: ${formatearMonto(asignacionAEditar.costoUnitarioAplicado ?? 0)}`}
                  checked={actualizarTarifa}
                  onChange={(e) => setActualizarTarifa(e.currentTarget.checked)}
                />
              </>
            )}

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={() => setAsignacionAEditar(null)}>
                Cancelar
              </Button>
              <Button onClick={guardarEdicion} loading={actualizarMutacion.isPending}>
                Guardar cambios
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Card>
  );
}
