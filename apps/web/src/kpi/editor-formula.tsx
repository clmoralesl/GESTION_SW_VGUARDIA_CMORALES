import { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Card,
  Group,
  Loader,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  ThemeIcon,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconAlertCircle, IconCheck, IconCode } from '@tabler/icons-react';
import { VARIABLES_KPI, type AmbitoKpi, type UnidadKpi } from '@autofix/core';
import { useValidarFormula } from '../api/kpi';
import { formatearValorKpi } from './formato-kpi';

interface EditorFormulaProps {
  valor: string;
  alCambiar: (formula: string) => void;
  unidad?: UnidadKpi;
  proyectoId?: number | null;
  ambito?: AmbitoKpi;
  error?: string;
  disabled?: boolean;
}

export function EditorFormula({
  valor,
  alCambiar,
  unidad = 'INDICE',
  proyectoId,
  ambito,
  error,
  disabled,
}: EditorFormulaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [posicionCursor, setPosicionCursor] = useState<number>(valor.length);
  const [mostrarCatalogo, setMostrarCatalogo] = useState(false);

  const [formulaDiferida] = useDebouncedValue(valor, 400);
  const { data: resultadoValidacion, isLoading: validando } = useValidarFormula(
    formulaDiferida,
    proyectoId,
    null,
    ambito,
  );

  const variablesDelAmbito = useMemo(() => {
    return VARIABLES_KPI.filter((v) => (ambito ? v.ambito === ambito : true));
  }, [ambito]);

  const palabraBajoCursor = useMemo(() => {
    const textoPrevio = valor.slice(0, posicionCursor);
    const coincidencia = /[a-zA-Z0-9_]+$/.exec(textoPrevio);
    return coincidencia ? coincidencia[0] : '';
  }, [valor, posicionCursor]);

  const sugerencias = useMemo(() => {
    if (!palabraBajoCursor) return [];
    const busqueda = palabraBajoCursor.toUpperCase();
    return variablesDelAmbito.filter((v) => v.codigo.includes(busqueda));
  }, [palabraBajoCursor, variablesDelAmbito]);

  const insertarVariable = (codigo: string) => {
    const inicio = posicionCursor - palabraBajoCursor.length;
    const fin = posicionCursor;
    const nuevoTexto = valor.slice(0, inicio) + codigo + ' ' + valor.slice(fin);
    alCambiar(nuevoTexto);

    const nuevaPosicion = inicio + codigo.length + 1;
    setPosicionCursor(nuevaPosicion);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(nuevaPosicion, nuevaPosicion);
      }
    }, 0);
  };

  const alActualizarCursor = () => {
    if (textareaRef.current) {
      setPosicionCursor(textareaRef.current.selectionStart);
    }
  };

  return (
    <Stack gap="xs">
      <Textarea
        ref={textareaRef}
        label="Fórmula matemática"
        description="Utilice operadores aritméticos (+, -, *, /), comparadores (> , <, ==), condicional (? :) y funciones (min, max, abs, round)."
        placeholder="Ej: EV / PV"
        value={valor}
        onChange={(e) => {
          alCambiar(e.currentTarget.value);
          setPosicionCursor(e.currentTarget.selectionStart);
        }}
        onKeyUp={alActualizarCursor}
        onClick={alActualizarCursor}
        onFocus={() => setMostrarCatalogo(true)}
        error={error}
        disabled={disabled}
        minRows={3}
        autosize
      />

      {sugerencias.length > 0 ? (
        <Paper p="xs" withBorder radius="sm">
          <Text size="xs" fw={600} c="dimmed" mb={4}>
            Sugerencias (haga clic para insertar):
          </Text>
          <Group gap={6}>
            {sugerencias.map((s) => (
              <Badge
                key={s.codigo}
                variant="outline"
                color="blue"
                style={{ cursor: 'pointer' }}
                onClick={() => insertarVariable(s.codigo)}
              >
                {s.codigo}: {s.nombre}
              </Badge>
            ))}
          </Group>
        </Paper>
      ) : null}

      <Card withBorder p="xs" radius="sm">
        <Group justify="space-between" mb={4}>
          <Group gap={6}>
            <ThemeIcon size="xs" variant="transparent" color="gray">
              <IconCode size={14} />
            </ThemeIcon>
            <Text size="xs" fw={600}>
              Vista previa de la fórmula
            </Text>
          </Group>
          {validando ? <Loader size={12} /> : null}
        </Group>

        {valor.trim() === '' ? (
          <Text size="xs" c="dimmed">
            Escriba una fórmula para comprobar su sintaxis y valor evaluado.
          </Text>
        ) : resultadoValidacion?.valida ? (
          <Stack gap={4}>
            <Alert color="green" icon={<IconCheck size={16} />} p="xs" title="Fórmula válida">
              <Group gap="md">
                <Text size="xs">
                  <strong>Valor proyectado:</strong>{' '}
                  {resultadoValidacion.valor !== null
                    ? formatearValorKpi(resultadoValidacion.valor, unidad)
                    : 'N/D'}
                </Text>
                {resultadoValidacion.variables.length > 0 ? (
                  <Text size="xs" c="dimmed">
                    Variables detectadas: {resultadoValidacion.variables.join(', ')}
                  </Text>
                ) : null}
              </Group>
            </Alert>
          </Stack>
        ) : resultadoValidacion && !resultadoValidacion.valida ? (
          <Alert
            color="red"
            icon={<IconAlertCircle size={16} />}
            p="xs"
            title="Fórmula con errores"
          >
            <Stack gap={2}>
              {resultadoValidacion.errores.map((err, i) => (
                <Text key={i} size="xs">
                  • {err.mensaje}
                </Text>
              ))}
            </Stack>
          </Alert>
        ) : null}
      </Card>

      <Box>
        <Group justify="space-between" mb={4}>
          <Text
            size="xs"
            c="blue"
            style={{ cursor: 'pointer' }}
            onClick={() => setMostrarCatalogo((v) => !v)}
          >
            {mostrarCatalogo
              ? 'Ocultar catálogo de variables'
              : 'Ver catálogo de variables disponibles'}
          </Text>
        </Group>
        {mostrarCatalogo ? (
          <ScrollArea.Autosize mah={180}>
            <Stack gap={4}>
              {variablesDelAmbito.map((v) => (
                <Paper
                  key={v.codigo}
                  p={6}
                  withBorder
                  style={{ cursor: 'pointer' }}
                  onClick={() => insertarVariable(v.codigo)}
                >
                  <Group justify="space-between">
                    <Group gap="xs">
                      <Badge size="xs" variant="filled">
                        {v.codigo}
                      </Badge>
                      <Text size="xs" fw={600}>
                        {v.nombre}
                      </Text>
                    </Group>
                    <Badge size="xs" variant="light" color="gray">
                      {v.unidad}
                    </Badge>
                  </Group>
                  <Text size="xs" c="dimmed" mt={2}>
                    {v.descripcion}
                  </Text>
                </Paper>
              ))}
            </Stack>
          </ScrollArea.Autosize>
        ) : null}
      </Box>
    </Stack>
  );
}
