import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { Container, Group, Loader, Modal, Stack, Tabs, Text, Title } from '@mantine/core';
import { type ProfesionalResumen, type RecursoResumen } from '@autofix/core';
import { useProfesionales, useRecursos, useTiposRecurso } from '../api/catalogos';
import { FormularioProfesional } from '../recursos/formulario-profesional';
import { FormularioRecurso } from '../recursos/formulario-recurso';
import { TablaProfesionales } from '../recursos/tabla-profesionales';
import { TablaRecursos } from '../recursos/tabla-recursos';

type EstadoModal<T> =
  { modo: 'crear'; registro?: undefined } | { modo: 'editar'; registro: T } | null;

export function PaginaRecursos() {
  const [parametros, setParametros] = useSearchParams();
  const pestanaActiva = parametros.get('pestana') ?? 'profesionales';

  const [modalProfesional, setModalProfesional] = useState<EstadoModal<ProfesionalResumen>>(null);
  const [modalRecurso, setModalRecurso] = useState<EstadoModal<RecursoResumen>>(null);

  const { data: profesionales = [], isLoading: cargandoProfesionales } = useProfesionales();
  const { data: recursos = [], isLoading: cargandoRecursos } = useRecursos();
  const { data: tiposRecurso = [] } = useTiposRecurso();

  const alCambiarPestana = (nuevaPestana: string | null) => {
    if (!nuevaPestana) return;
    setParametros((prev) => {
      const actualizados = new URLSearchParams(prev);
      actualizados.set('pestana', nuevaPestana);
      return actualizados;
    });
  };

  return (
    <Container size="xl" py="lg">
      <Stack gap="lg">
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={2}>Recursos</Title>
            <Text c="dimmed" size="sm">
              Catálogo de personal propio y recursos del taller automotriz.
            </Text>
          </div>
        </Group>

        <Tabs value={pestanaActiva} onChange={alCambiarPestana}>
          <Tabs.List mb="md">
            <Tabs.Tab value="profesionales">Profesionales</Tabs.Tab>
            <Tabs.Tab value="recursos">Recursos</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="profesionales">
            {cargandoProfesionales ? (
              <Group justify="center" py="xl">
                <Loader size="md" />
              </Group>
            ) : (
              <TablaProfesionales
                profesionales={profesionales}
                alCrear={() => setModalProfesional({ modo: 'crear' })}
                alEditar={(p) => setModalProfesional({ modo: 'editar', registro: p })}
              />
            )}
          </Tabs.Panel>

          <Tabs.Panel value="recursos">
            {cargandoRecursos ? (
              <Group justify="center" py="xl">
                <Loader size="md" />
              </Group>
            ) : (
              <TablaRecursos
                recursos={recursos}
                tiposRecurso={tiposRecurso}
                alCrear={() => setModalRecurso({ modo: 'crear' })}
                alEditar={(r) => setModalRecurso({ modo: 'editar', registro: r })}
              />
            )}
          </Tabs.Panel>
        </Tabs>
      </Stack>

      <Modal
        opened={modalProfesional !== null}
        onClose={() => setModalProfesional(null)}
        title={modalProfesional?.modo === 'crear' ? 'Nuevo profesional' : 'Editar profesional'}
      >
        {modalProfesional && (
          <FormularioProfesional
            key={modalProfesional.registro?.id ?? 'nuevo'}
            modo={modalProfesional.modo}
            profesional={modalProfesional.registro}
            alCerrar={() => setModalProfesional(null)}
          />
        )}
      </Modal>

      <Modal
        opened={modalRecurso !== null}
        onClose={() => setModalRecurso(null)}
        title={modalRecurso?.modo === 'crear' ? 'Nuevo recurso' : 'Editar recurso'}
      >
        {modalRecurso && (
          <FormularioRecurso
            key={modalRecurso.registro?.id ?? 'nuevo'}
            modo={modalRecurso.modo}
            recurso={modalRecurso.registro}
            alCerrar={() => setModalRecurso(null)}
          />
        )}
      </Modal>
    </Container>
  );
}
