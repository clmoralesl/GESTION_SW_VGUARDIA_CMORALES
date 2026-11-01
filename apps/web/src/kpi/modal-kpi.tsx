import { useEffect, useState } from 'react';
import {
  Button,
  Grid,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Switch,
  TextInput,
  Textarea,
} from '@mantine/core';
import {
  esquemaActualizarKpi,
  esquemaCrearKpi,
  type AmbitoKpi,
  type DireccionKpi,
  type KpiDetalleRespuesta,
  type UnidadKpi,
} from '@autofix/core';
import { useActualizarKpi, useCrearKpi } from '../api/kpi';
import { EditorFormula } from './editor-formula';

interface ModalKpiProps {
  abierto: boolean;
  alCerrar: () => void;
  kpiParaEditar?: KpiDetalleRespuesta | null;
  proyectoId?: number | null;
  ambitoInicial?: AmbitoKpi;
}

const OPCIONES_AMBITO = [
  { value: 'PROYECTO', label: 'Proyecto' },
  { value: 'CAMBIO', label: 'Gestión del cambio' },
];

const OPCIONES_UNIDAD: Array<{ value: UnidadKpi; label: string }> = [
  { value: 'PORCENTAJE', label: 'Porcentaje (%)' },
  { value: 'INDICE', label: 'Índice' },
  { value: 'CLP', label: 'Pesos chilenos (CLP)' },
  { value: 'DIAS', label: 'Días hábiles' },
  { value: 'NUMERO', label: 'Número' },
];

const OPCIONES_DIRECCION: Array<{ value: DireccionKpi; label: string }> = [
  { value: 'MAYOR_MEJOR', label: 'Mayor es mejor (≥ verde)' },
  { value: 'MENOR_MEJOR', label: 'Menor es mejor (≤ verde)' },
];

export function ModalKpi({
  abierto,
  alCerrar,
  kpiParaEditar,
  proyectoId,
  ambitoInicial,
}: ModalKpiProps) {
  const esEdicion = Boolean(kpiParaEditar);

  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [ambito, setAmbito] = useState<AmbitoKpi>(ambitoInicial ?? 'PROYECTO');
  const [formula, setFormula] = useState('');
  const [unidad, setUnidad] = useState<UnidadKpi>('INDICE');
  const [meta, setMeta] = useState<number | string>('');
  const [direccion, setDireccion] = useState<DireccionKpi>('MAYOR_MEJOR');
  const [verde, setVerde] = useState<number | string>('');
  const [amarillo, setAmarillo] = useState<number | string>('');
  const [activo, setActivo] = useState(true);

  const [errores, setErrores] = useState<Record<string, string>>({});

  const crearMutacion = useCrearKpi();
  const actualizarMutacion = useActualizarKpi();
  const guardando = crearMutacion.isPending || actualizarMutacion.isPending;

  useEffect(() => {
    if (kpiParaEditar) {
      setCodigo(kpiParaEditar.codigo);
      setNombre(kpiParaEditar.nombre);
      setDescripcion(kpiParaEditar.descripcion ?? '');
      setAmbito(kpiParaEditar.ambito);
      setFormula(kpiParaEditar.formula);
      setUnidad(kpiParaEditar.unidad);
      setMeta(kpiParaEditar.meta !== null ? kpiParaEditar.meta : '');
      setDireccion(kpiParaEditar.direccion);
      setVerde(
        kpiParaEditar.umbrales?.verde !== null && kpiParaEditar.umbrales?.verde !== undefined
          ? kpiParaEditar.umbrales.verde
          : '',
      );
      setAmarillo(
        kpiParaEditar.umbrales?.amarillo !== null && kpiParaEditar.umbrales?.amarillo !== undefined
          ? kpiParaEditar.umbrales.amarillo
          : '',
      );
      setActivo(kpiParaEditar.activo);
    } else {
      setCodigo('');
      setNombre('');
      setDescripcion('');
      setAmbito(ambitoInicial ?? 'PROYECTO');
      setFormula('');
      setUnidad('INDICE');
      setMeta('');
      setDireccion('MAYOR_MEJOR');
      setVerde('');
      setAmarillo('');
      setActivo(true);
    }
    setErrores({});
  }, [kpiParaEditar, abierto, ambitoInicial]);

  const alGuardar = async () => {
    setErrores({});

    const metaNum = meta !== '' ? Number(meta) : null;
    const verdeNum = verde !== '' ? Number(verde) : null;
    const amarilloNum = amarillo !== '' ? Number(amarillo) : null;

    if (esEdicion && kpiParaEditar) {
      const cuerpo = {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        ambito,
        formula: formula.trim(),
        unidad,
        meta: metaNum,
        direccion,
        activo,
        umbrales: {
          verde: verdeNum,
          amarillo: amarilloNum,
        },
      };

      const resultadoValidacion = esquemaActualizarKpi.safeParse(cuerpo);
      if (!resultadoValidacion.success) {
        const fallas: Record<string, string> = {};
        for (const issue of resultadoValidacion.error.issues) {
          const campo = issue.path[0]?.toString() ?? 'general';
          fallas[campo] = issue.message;
        }
        setErrores(fallas);
        return;
      }

      await actualizarMutacion.mutateAsync({
        id: kpiParaEditar.id,
        datos: resultadoValidacion.data,
      });
      alCerrar();
    } else {
      const cuerpo = {
        codigo: codigo.trim().toUpperCase(),
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        ambito,
        formula: formula.trim(),
        unidad,
        meta: metaNum,
        direccion,
        activo,
        umbrales: {
          verde: verdeNum,
          amarillo: amarilloNum,
        },
      };

      const resultadoValidacion = esquemaCrearKpi.safeParse(cuerpo);
      if (!resultadoValidacion.success) {
        const fallas: Record<string, string> = {};
        for (const issue of resultadoValidacion.error.issues) {
          const campo = issue.path[0]?.toString() ?? 'general';
          fallas[campo] = issue.message;
        }
        setErrores(fallas);
        return;
      }

      await crearMutacion.mutateAsync(resultadoValidacion.data);
      alCerrar();
    }
  };

  return (
    <Modal
      opened={abierto}
      onClose={alCerrar}
      title={esEdicion ? `Editar KPI: ${codigo}` : 'Nuevo KPI'}
      size="lg"
    >
      <Stack gap="md">
        <Grid>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <TextInput
              label="Código"
              placeholder="Ej: SPI"
              value={codigo}
              onChange={(e) => setCodigo(e.currentTarget.value.toUpperCase())}
              disabled={esEdicion || guardando}
              error={errores.codigo}
              required
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 8 }}>
            <TextInput
              label="Nombre del indicador"
              placeholder="Ej: Índice de desempeño del cronograma"
              value={nombre}
              onChange={(e) => setNombre(e.currentTarget.value)}
              disabled={guardando}
              error={errores.nombre}
              required
            />
          </Grid.Col>
        </Grid>

        <Textarea
          label="Descripción"
          placeholder="Propósito u objetivo de este indicador"
          value={descripcion}
          onChange={(e) => setDescripcion(e.currentTarget.value)}
          disabled={guardando}
          error={errores.descripcion}
          minRows={2}
        />

        <Grid>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Select
              label="Ámbito"
              data={OPCIONES_AMBITO}
              value={ambito}
              onChange={(v) => v && setAmbito(v as AmbitoKpi)}
              disabled={guardando}
              error={errores.ambito}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Select
              label="Unidad de medida"
              data={OPCIONES_UNIDAD}
              value={unidad}
              onChange={(v) => v && setUnidad(v as UnidadKpi)}
              disabled={guardando}
              error={errores.unidad}
            />
          </Grid.Col>
        </Grid>

        <EditorFormula
          valor={formula}
          alCambiar={setFormula}
          unidad={unidad}
          proyectoId={proyectoId}
          ambito={ambito}
          error={errores.formula}
          disabled={guardando}
        />

        <Grid>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Select
              label="Dirección de mejora"
              data={OPCIONES_DIRECCION}
              value={direccion}
              onChange={(v) => v && setDireccion(v as DireccionKpi)}
              disabled={guardando}
              error={errores.direccion}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <NumberInput
              label="Meta (objetivo)"
              placeholder="Opcional"
              value={meta}
              onChange={setMeta}
              disabled={guardando}
              error={errores.meta}
              decimalScale={4}
            />
          </Grid.Col>
        </Grid>

        <Grid>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <NumberInput
              label="Umbral Verde"
              description={
                direccion === 'MAYOR_MEJOR' ? 'Verde si valor ≥ umbral' : 'Verde si valor ≤ umbral'
              }
              placeholder="Opcional"
              value={verde}
              onChange={setVerde}
              disabled={guardando}
              error={errores.umbrales}
              decimalScale={4}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <NumberInput
              label="Umbral Amarillo"
              description={
                direccion === 'MAYOR_MEJOR'
                  ? 'Amarillo si valor ≥ umbral'
                  : 'Amarillo si valor ≤ umbral'
              }
              placeholder="Opcional"
              value={amarillo}
              onChange={setAmarillo}
              disabled={guardando}
              error={errores.umbrales}
              decimalScale={4}
            />
          </Grid.Col>
        </Grid>

        {esEdicion ? (
          <Switch
            label="KPI activo"
            description="Los KPI inactivos no se recalculan ni muestran alertas nuevas."
            checked={activo}
            onChange={(e) => setActivo(e.currentTarget.checked)}
            disabled={guardando}
          />
        ) : null}

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={alCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={alGuardar} loading={guardando}>
            {esEdicion ? 'Guardar cambios' : 'Crear KPI'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
