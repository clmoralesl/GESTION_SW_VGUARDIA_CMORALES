import { useMemo, useState } from 'react';
import { Button, Grid, Group, Modal, NumberInput, Select, Stack, TextInput } from '@mantine/core';
import type { EntradaCrearImpacto, TipoImpacto } from '@autofix/core';
import { useCrearImpactoCambio } from '../api/cambios';
import { useProfesionales, useRecursos } from '../api/catalogos';
import { useArbolTareas } from '../api/tareas';

interface ModalCrearImpactoProps {
  solicitudId: number;
  proyectoId: number;
  opened: boolean;
  onClose: () => void;
}

export function ModalCrearImpacto({
  solicitudId,
  proyectoId,
  opened,
  onClose,
}: ModalCrearImpactoProps) {
  const [tipo, setTipo] = useState<TipoImpacto>('DURACION');
  const [descripcion, setDescripcion] = useState('');

  const [duracionTareaId, setDuracionTareaId] = useState<string | null>(null);
  const [duracionDias, setDuracionDias] = useState<number | string>(1);

  const [operacionAsignacion, setOperacionAsignacion] = useState<
    'agregar' | 'modificar' | 'quitar'
  >('agregar');
  const [elementoAsignacion, setElementoAsignacion] = useState<'PROFESIONAL' | 'RECURSO'>(
    'PROFESIONAL',
  );
  const [asignacionTareaId, setAsignacionTareaId] = useState<string | null>(null);
  const [profesionalId, setProfesionalId] = useState<string | null>(null);
  const [recursoId, setRecursoId] = useState<string | null>(null);
  const [dedicacion, setDedicacion] = useState<number | string>(100);
  const [horasPlan, setHorasPlan] = useState<number | string>('');
  const [tarifaAplicada, setTarifaAplicada] = useState<number | string>('');
  const [cantidadPlan, setCantidadPlan] = useState<number | string>(1);
  const [costoUnitarioAplicado, setCostoUnitarioAplicado] = useState<number | string>('');

  const [claveNuevaTarea, setClaveNuevaTarea] = useState('N1');
  const [nombreNuevaTarea, setNombreNuevaTarea] = useState('');
  const [duracionNuevaTarea, setDuracionNuevaTarea] = useState<number | string>(1);
  const [padreIdNuevaTarea, setPadreIdNuevaTarea] = useState<string | null>(null);

  const [presupuesto, setPresupuesto] = useState<number | string>(0);

  const { data: arbol } = useArbolTareas(proyectoId);
  const { data: profesionales } = useProfesionales();
  const { data: recursos } = useRecursos();

  const crearMutacion = useCrearImpactoCambio(solicitudId);

  const tareasHoja = useMemo(() => {
    if (!arbol || !Array.isArray(arbol.tareas)) return [];
    const padres = new Set(
      arbol.tareas.map((t) => t.padreId).filter((id): id is number => id !== null),
    );
    return arbol.tareas.filter((t) => !padres.has(t.id));
  }, [arbol]);

  const tareasPosiblesPadres = useMemo(() => {
    if (!arbol || !Array.isArray(arbol.tareas)) return [];
    return arbol.tareas.filter((t) => t.nivel !== 'SUBACTIVIDAD');
  }, [arbol]);

  const opcionesTareasHoja = useMemo(
    () =>
      tareasHoja.map((t) => ({
        value: String(t.id),
        label: `${t.codigo} · ${t.nombre}`,
      })),
    [tareasHoja],
  );

  const opcionesPosiblesPadres = useMemo(
    () =>
      tareasPosiblesPadres.map((t) => ({
        value: String(t.id),
        label: `${t.codigo} · ${t.nombre} (${t.nivel})`,
      })),
    [tareasPosiblesPadres],
  );

  const opcionesProfesionales = useMemo(
    () =>
      (Array.isArray(profesionales) ? profesionales : [])
        .filter((p) => p.activo)
        .map((p) => ({
          value: String(p.id),
          label: `${p.nombre} (${p.cargo})`,
        })),
    [profesionales],
  );

  const opcionesRecursos = useMemo(
    () =>
      (Array.isArray(recursos) ? recursos : [])
        .filter((r) => r.activo)
        .map((r) => ({
          value: String(r.id),
          label: `${r.nombre} (${r.tipoRecurso})`,
        })),
    [recursos],
  );

  const reiniciarFormulario = () => {
    setTipo('DURACION');
    setDescripcion('');
    setDuracionTareaId(null);
    setDuracionDias(1);
    setOperacionAsignacion('agregar');
    setElementoAsignacion('PROFESIONAL');
    setAsignacionTareaId(null);
    setProfesionalId(null);
    setRecursoId(null);
    setDedicacion(100);
    setHorasPlan('');
    setTarifaAplicada('');
    setCantidadPlan(1);
    setCostoUnitarioAplicado('');
    setClaveNuevaTarea('N1');
    setNombreNuevaTarea('');
    setDuracionNuevaTarea(1);
    setPadreIdNuevaTarea(null);
    setPresupuesto(0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let payload: EntradaCrearImpacto;

    const desc = descripcion.trim() || undefined;

    if (tipo === 'DURACION') {
      if (!duracionTareaId) return;
      payload = {
        tipo: 'DURACION',
        descripcion: desc,
        tareaId: Number(duracionTareaId),
        duracionDias: Number(duracionDias),
      };
    } else if (tipo === 'PRESUPUESTO') {
      payload = {
        tipo: 'PRESUPUESTO',
        descripcion: desc,
        presupuesto: Number(presupuesto),
      };
    } else if (tipo === 'NUEVA_TAREA') {
      if (!claveNuevaTarea.trim() || !nombreNuevaTarea.trim()) return;
      payload = {
        tipo: 'NUEVA_TAREA',
        descripcion: desc,
        clave: claveNuevaTarea.trim(),
        nombre: nombreNuevaTarea.trim(),
        duracionDias: Number(duracionNuevaTarea),
        padreId: padreIdNuevaTarea ? Number(padreIdNuevaTarea) : undefined,
        predecesoras: [],
      };
    } else {
      if (!asignacionTareaId) return;
      const tareaId = Number(asignacionTareaId);

      if (elementoAsignacion === 'PROFESIONAL') {
        if (!profesionalId) return;
        const profId = Number(profesionalId);
        if (operacionAsignacion === 'agregar') {
          payload = {
            tipo: 'ASIGNACION',
            descripcion: desc,
            operacion: 'agregar',
            elemento: 'PROFESIONAL',
            tareaId,
            profesionalId: profId,
            dedicacion: Number(dedicacion),
            horasPlan: horasPlan !== '' ? Number(horasPlan) : undefined,
            tarifaAplicada: tarifaAplicada !== '' ? Number(tarifaAplicada) : undefined,
          };
        } else if (operacionAsignacion === 'modificar') {
          payload = {
            tipo: 'ASIGNACION',
            descripcion: desc,
            operacion: 'modificar',
            elemento: 'PROFESIONAL',
            tareaId,
            profesionalId: profId,
            dedicacion: dedicacion !== '' ? Number(dedicacion) : undefined,
            horasPlan: horasPlan !== '' ? Number(horasPlan) : undefined,
            tarifaAplicada: tarifaAplicada !== '' ? Number(tarifaAplicada) : undefined,
          };
        } else {
          payload = {
            tipo: 'ASIGNACION',
            descripcion: desc,
            operacion: 'quitar',
            elemento: 'PROFESIONAL',
            tareaId,
            profesionalId: profId,
          };
        }
      } else {
        if (!recursoId) return;
        const recId = Number(recursoId);
        if (operacionAsignacion === 'agregar') {
          payload = {
            tipo: 'ASIGNACION',
            descripcion: desc,
            operacion: 'agregar',
            elemento: 'RECURSO',
            tareaId,
            recursoId: recId,
            cantidadPlan: Number(cantidadPlan),
            costoUnitarioAplicado:
              costoUnitarioAplicado !== '' ? Number(costoUnitarioAplicado) : undefined,
          };
        } else if (operacionAsignacion === 'modificar') {
          payload = {
            tipo: 'ASIGNACION',
            descripcion: desc,
            operacion: 'modificar',
            elemento: 'RECURSO',
            tareaId,
            recursoId: recId,
            cantidadPlan: cantidadPlan !== '' ? Number(cantidadPlan) : undefined,
            costoUnitarioAplicado:
              costoUnitarioAplicado !== '' ? Number(costoUnitarioAplicado) : undefined,
          };
        } else {
          payload = {
            tipo: 'ASIGNACION',
            descripcion: desc,
            operacion: 'quitar',
            elemento: 'RECURSO',
            tareaId,
            recursoId: recId,
          };
        }
      }
    }

    crearMutacion.mutate(payload, {
      onSuccess: () => {
        reiniciarFormulario();
        onClose();
      },
    });
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Agregar impacto a la solicitud" size="lg">
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <Select
            label="Tipo de impacto"
            value={tipo}
            onChange={(val) => setTipo((val as TipoImpacto) ?? 'DURACION')}
            data={[
              { value: 'DURACION', label: 'Modificación de duración de tarea' },
              { value: 'ASIGNACION', label: 'Asignación de profesional o recurso' },
              { value: 'NUEVA_TAREA', label: 'Incorporación de nueva tarea' },
              { value: 'PRESUPUESTO', label: 'Ajuste de presupuesto del proyecto' },
            ]}
            required
          />

          <TextInput
            label="Descripción o justificación del impacto (opcional)"
            placeholder="Ej: Aumento de 3 días para pruebas adicionales"
            value={descripcion}
            onChange={(e) => setDescripcion(e.currentTarget.value)}
          />

          {tipo === 'DURACION' && (
            <Grid gutter="sm">
              <Grid.Col span={{ base: 12, sm: 8 }}>
                <Select
                  label="Tarea a modificar"
                  placeholder="Seleccione la tarea hoja"
                  data={opcionesTareasHoja}
                  value={duracionTareaId}
                  onChange={setDuracionTareaId}
                  searchable
                  required
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 4 }}>
                <NumberInput
                  label="Nueva duración (días)"
                  min={1}
                  max={3650}
                  value={duracionDias}
                  onChange={setDuracionDias}
                  required
                />
              </Grid.Col>
            </Grid>
          )}

          {tipo === 'PRESUPUESTO' && (
            <NumberInput
              label="Nuevo presupuesto del proyecto"
              prefix="$"
              thousandSeparator="."
              decimalSeparator=","
              min={0}
              value={presupuesto}
              onChange={setPresupuesto}
              required
            />
          )}

          {tipo === 'NUEVA_TAREA' && (
            <Stack gap="sm">
              <Grid gutter="sm">
                <Grid.Col span={{ base: 12, sm: 4 }}>
                  <TextInput
                    label="Clave (N1 - N99)"
                    placeholder="N1"
                    value={claveNuevaTarea}
                    onChange={(e) => setClaveNuevaTarea(e.currentTarget.value)}
                    required
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 8 }}>
                  <TextInput
                    label="Nombre de la nueva tarea"
                    placeholder="Ej: Análisis de requerimientos adicionales"
                    value={nombreNuevaTarea}
                    onChange={(e) => setNombreNuevaTarea(e.currentTarget.value)}
                    required
                  />
                </Grid.Col>
              </Grid>
              <Grid gutter="sm">
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <NumberInput
                    label="Duración (días hábiles)"
                    min={1}
                    max={3650}
                    value={duracionNuevaTarea}
                    onChange={setDuracionNuevaTarea}
                    required
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Select
                    label="Tarea padre (opcional)"
                    placeholder="Raíz del proyecto"
                    data={opcionesPosiblesPadres}
                    value={padreIdNuevaTarea}
                    onChange={setPadreIdNuevaTarea}
                    clearable
                    searchable
                  />
                </Grid.Col>
              </Grid>
            </Stack>
          )}

          {tipo === 'ASIGNACION' && (
            <Stack gap="sm">
              <Grid gutter="sm">
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Select
                    label="Operación"
                    value={operacionAsignacion}
                    onChange={(v) =>
                      setOperacionAsignacion((v as 'agregar' | 'modificar' | 'quitar') ?? 'agregar')
                    }
                    data={[
                      { value: 'agregar', label: 'Agregar asignación' },
                      { value: 'modificar', label: 'Modificar asignación' },
                      { value: 'quitar', label: 'Quitar asignación' },
                    ]}
                    required
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Select
                    label="Elemento"
                    value={elementoAsignacion}
                    onChange={(v) =>
                      setElementoAsignacion((v as 'PROFESIONAL' | 'RECURSO') ?? 'PROFESIONAL')
                    }
                    data={[
                      { value: 'PROFESIONAL', label: 'Profesional' },
                      { value: 'RECURSO', label: 'Recurso material' },
                    ]}
                    required
                  />
                </Grid.Col>
              </Grid>

              <Select
                label="Tarea hoja"
                placeholder="Seleccione la tarea"
                data={opcionesTareasHoja}
                value={asignacionTareaId}
                onChange={setAsignacionTareaId}
                searchable
                required
              />

              {elementoAsignacion === 'PROFESIONAL' ? (
                <>
                  <Select
                    label="Profesional"
                    placeholder="Seleccione el profesional"
                    data={opcionesProfesionales}
                    value={profesionalId}
                    onChange={setProfesionalId}
                    searchable
                    required
                  />
                  {operacionAsignacion !== 'quitar' && (
                    <Grid gutter="sm">
                      <Grid.Col span={{ base: 12, sm: 4 }}>
                        <NumberInput
                          label="Dedicación (%)"
                          min={1}
                          max={100}
                          value={dedicacion}
                          onChange={setDedicacion}
                        />
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, sm: 4 }}>
                        <NumberInput
                          label="Horas plan (opcional)"
                          min={0}
                          value={horasPlan}
                          onChange={setHorasPlan}
                        />
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, sm: 4 }}>
                        <NumberInput
                          label="Tarifa hora (opcional)"
                          prefix="$"
                          thousandSeparator="."
                          min={0}
                          value={tarifaAplicada}
                          onChange={setTarifaAplicada}
                        />
                      </Grid.Col>
                    </Grid>
                  )}
                </>
              ) : (
                <>
                  <Select
                    label="Recurso material"
                    placeholder="Seleccione el recurso"
                    data={opcionesRecursos}
                    value={recursoId}
                    onChange={setRecursoId}
                    searchable
                    required
                  />
                  {operacionAsignacion !== 'quitar' && (
                    <Grid gutter="sm">
                      <Grid.Col span={{ base: 12, sm: 6 }}>
                        <NumberInput
                          label="Cantidad plan"
                          min={0.01}
                          step={1}
                          value={cantidadPlan}
                          onChange={setCantidadPlan}
                          required
                        />
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, sm: 6 }}>
                        <NumberInput
                          label="Costo unitario (opcional)"
                          prefix="$"
                          thousandSeparator="."
                          min={0}
                          value={costoUnitarioAplicado}
                          onChange={setCostoUnitarioAplicado}
                        />
                      </Grid.Col>
                    </Grid>
                  )}
                </>
              )}
            </Stack>
          )}

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={crearMutacion.isPending}>
              Guardar impacto
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
