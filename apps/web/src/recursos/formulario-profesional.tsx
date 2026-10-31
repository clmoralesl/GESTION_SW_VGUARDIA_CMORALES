import { Button, Group, NumberInput, Stack, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import {
  esquemaActualizarProfesional,
  esquemaCrearProfesional,
  HORAS_DIARIAS_MAXIMAS,
  HORAS_DIARIAS_POR_DEFECTO,
  TARIFA_HORA_MAXIMA,
  type ProfesionalResumen,
} from '@autofix/core';
import { useActualizarProfesional, useCrearProfesional } from '../api/catalogos';
import {
  cargarErroresServidor,
  validadorFormulario,
} from '../componentes/formularios/validador-formulario';

interface FormularioProfesionalProps {
  modo: 'crear' | 'editar';
  profesional?: ProfesionalResumen;
  alCerrar: () => void;
}

interface ValoresFormulario {
  nombre: string;
  cargo: string;
  tarifaHora: number | '';
  horasDiarias: number | '';
}

export function FormularioProfesional({ modo, profesional, alCerrar }: FormularioProfesionalProps) {
  const crearMutacion = useCrearProfesional();
  const actualizarMutacion = useActualizarProfesional();

  const validador =
    modo === 'crear'
      ? validadorFormulario(esquemaCrearProfesional)
      : validadorFormulario(esquemaActualizarProfesional);

  const form = useForm<ValoresFormulario>({
    initialValues: {
      nombre: profesional?.nombre ?? '',
      cargo: profesional?.cargo ?? '',
      tarifaHora: profesional?.tarifaHora ?? '',
      horasDiarias: profesional?.horasDiarias ?? HORAS_DIARIAS_POR_DEFECTO,
    },
    validate: (valores) => validador(valores),
  });

  const alEnviar = async (valores: ValoresFormulario) => {
    try {
      if (modo === 'crear') {
        await crearMutacion.mutateAsync({
          nombre: valores.nombre,
          cargo: valores.cargo,
          tarifaHora:
            valores.tarifaHora === '' ? ('' as unknown as number) : Number(valores.tarifaHora),
          horasDiarias:
            valores.horasDiarias === '' ? ('' as unknown as number) : Number(valores.horasDiarias),
        });
      } else if (profesional) {
        await actualizarMutacion.mutateAsync({
          id: profesional.id,
          datos: {
            nombre: valores.nombre,
            cargo: valores.cargo,
            tarifaHora:
              valores.tarifaHora === '' ? ('' as unknown as number) : Number(valores.tarifaHora),
            horasDiarias:
              valores.horasDiarias === ''
                ? ('' as unknown as number)
                : Number(valores.horasDiarias),
          },
        });
      }
      alCerrar();
    } catch (error) {
      cargarErroresServidor(form, error);
    }
  };

  const guardando = crearMutacion.isPending || actualizarMutacion.isPending;

  return (
    <form noValidate onSubmit={form.onSubmit(alEnviar)}>
      <Stack gap="md">
        <TextInput
          label="Nombre"
          placeholder="Nombre del profesional"
          required
          {...form.getInputProps('nombre')}
        />

        <TextInput
          label="Cargo"
          placeholder="Rol o cargo en el taller"
          required
          {...form.getInputProps('cargo')}
        />

        <NumberInput
          label="Tarifa por hora"
          placeholder="Tarifa en CLP"
          required
          thousandSeparator="."
          decimalSeparator=","
          allowDecimal={false}
          allowNegative={false}
          prefix="$ "
          max={TARIFA_HORA_MAXIMA}
          {...form.getInputProps('tarifaHora')}
        />

        <NumberInput
          label="Horas por día"
          placeholder="Capacidad diaria"
          required
          decimalScale={2}
          decimalSeparator=","
          step={0.5}
          min={0}
          max={HORAS_DIARIAS_MAXIMAS}
          {...form.getInputProps('horasDiarias')}
        />

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={alCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button type="submit" loading={guardando}>
            {modo === 'crear' ? 'Crear profesional' : 'Guardar cambios'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
