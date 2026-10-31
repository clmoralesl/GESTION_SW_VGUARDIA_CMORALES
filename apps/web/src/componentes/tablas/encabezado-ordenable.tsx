import { Group, Table, Text, UnstyledButton } from '@mantine/core';
import { IconChevronDown, IconChevronUp, IconSelector } from '@tabler/icons-react';
import { atributoAriaSort, type Orden } from './ordenar-filas';

interface EncabezadoOrdenableProps<C extends string> {
  columna: C;
  orden: Orden<C> | null;
  alOrdenar: (columna: C) => void;
  children: React.ReactNode;
}

export function EncabezadoOrdenable<C extends string>({
  columna,
  orden,
  alOrdenar,
  children,
}: EncabezadoOrdenableProps<C>) {
  const estaActiva = orden?.columna === columna;
  const icono = !estaActiva ? (
    <IconSelector size={14} style={{ opacity: 0.5 }} />
  ) : orden.direccion === 'asc' ? (
    <IconChevronUp size={14} />
  ) : (
    <IconChevronDown size={14} />
  );

  return (
    <Table.Th aria-sort={atributoAriaSort(orden, columna)}>
      <UnstyledButton
        onClick={() => alOrdenar(columna)}
        style={{ width: '100%', cursor: 'pointer' }}
      >
        <Group justify="space-between" wrap="nowrap" gap="xs">
          <Text fw={600} size="sm">
            {children}
          </Text>
          {icono}
        </Group>
      </UnstyledButton>
    </Table.Th>
  );
}
