import { useMemo } from 'react';
import {
  Autocomplete,
  Button,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import {
  COSTO_UNITARIO_MAXIMO,
  esquemaActualizarRecurso,
  esquemaCrearRecurso,
  UNIDADES_SUGERIDAS,
  type RecursoResumen,
} from '@autofix/core';
import { useActualizarRecurso, useCrearRecurso, useTiposRecurso } from '../api/catalogos';
import {
  cargarErroresServidor,
  validadorFormulario,
} from '../componentes/formularios/validador-formulario';

interface FormularioRecursoProps {
  modo: 'crear' | 'editar';
  recurso?: RecursoResumen;
  alCerrar: () => void;
}

interface ValoresFormulario {
  nombre: string;
  tipoRecursoId: string | null;
  unidad: string;
  costoUnitario: number | '';
}

export function FormularioRecurso({ modo, recurso, alCerrar }: FormularioRecursoProps) {
  const { data: tiposRecurso = [] } = useTiposRecurso();
  const crearMutacion = useCrearRecurso();
  const actualizarMutacion = useActualizarRecurso();

  const opcionesTipos = useMemo(
    () =>
      tiposRecurso.map((t) => ({
        value: String(t.id),
        label: t.nombre,
      })),
    [tiposRecurso],
  );

  const validador =
    modo === 'crear'
      ? validadorFormulario(esquemaCrearRecurso)
      : validadorFormulario(esquemaActualizarRecurso);

  const form = useForm<ValoresFormulario>({
    initialValues: {
      nombre: recurso?.nombre ?? '',
      tipoRecursoId: recurso?.tipoRecurso?.id ? String(recurso.tipoRecurso.id) : null,
      unidad: recurso?.unidad ?? '',
      costoUnitario: recurso?.costoUnitario ?? '',
    },
    validate: (valores) => {
      const datosValidar = {
        ...valores,
        tipoRecursoId:
          valores.tipoRecursoId === null || valores.tipoRecursoId === ''
            ? undefined
            : Number(valores.tipoRecursoId),
      };
      return validador(datosValidar);
    },
  });

  const alEnviar = async (valores: ValoresFormulario) => {
    try {
      const tipoId = Number(valores.tipoRecursoId);
      const costo =
        valores.costoUnitario === '' ? ('' as unknown as number) : Number(valores.costoUnitario);

      if (modo === 'crear') {
        await crearMutacion.mutateAsync({
          nombre: valores.nombre,
          tipoRecursoId: tipoId,
          unidad: valores.unidad,
          costoUnitario: costo,
        });
      } else if (recurso) {
        await actualizarMutacion.mutateAsync({
          id: recurso.id,
          datos: {
            nombre: valores.nombre,
            tipoRecursoId: tipoId,
            unidad: valores.unidad,
            costoUnitario: costo,
          },
        });
      }
      alCerrar();
    } catch (error) {
      cargarErroresServidor(form, error);
    }
  };

  const sinTipos = tiposRecurso.length === 0;
  const guardando = crearMutacion.isPending || actualizarMutacion.isPending;

  return (
    <form noValidate onSubmit={form.onSubmit(alEnviar)}>
      <Stack gap="md">
        <TextInput
          label="Nombre"
          placeholder="Nombre del recurso"
          required
          {...form.getInputProps('nombre')}
        />

        <Select
          label="Tipo de recurso"
          placeholder={
            sinTipos ? 'No hay tipos de recurso; ejecute el seed' : 'Seleccione el tipo de recurso'
          }
          data={opcionesTipos}
          disabled={sinTipos}
          required
          {...form.getInputProps('tipoRecursoId')}
        />
        {sinTipos && (
          <Text size="xs" c="red">
            No hay tipos de recurso; ejecute el seed
          </Text>
        )}

        <Autocomplete
          label="Unidad"
          placeholder="hora, día, mes, unidad..."
          data={[...UNIDADES_SUGERIDAS]}
          required
          {...form.getInputProps('unidad')}
        />

        <NumberInput
          label="Costo unitario"
          placeholder="Costo en CLP"
          required
          thousandSeparator="."
          decimalSeparator=","
          allowDecimal={false}
          allowNegative={false}
          prefix="$ "
          max={COSTO_UNITARIO_MAXIMO}
          {...form.getInputProps('costoUnitario')}
        />

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={alCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button type="submit" loading={guardando} disabled={sinTipos}>
            {modo === 'crear' ? 'Crear recurso' : 'Guardar cambios'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
