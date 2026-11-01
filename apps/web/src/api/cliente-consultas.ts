import { notifications } from '@mantine/notifications';
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { ErrorSolicitud } from './cliente-api';

declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: {
      silenciarError?: boolean;
    };
    mutationMeta: {
      silenciarError?: boolean;
    };
  }
}

export function mostrarError(error: unknown): void {
  if (error instanceof ErrorSolicitud) {
    notifications.show({
      id: error.cuerpo.codigo,
      color: 'red',
      title: error.cuerpo.error,
      message: error.cuerpo.mensaje,
    });
    return;
  }
  notifications.show({
    id: 'ERROR_DESCONOCIDO',
    color: 'red',
    title: 'Error',
    message: error instanceof Error ? error.message : 'Ocurrió un error inesperado.',
  });
}

export const clienteConsultas = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (!query.meta?.silenciarError) {
        mostrarError(error);
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (!mutation.meta?.silenciarError) {
        mostrarError(error);
      }
    },
    onSuccess: () => {
      void clienteConsultas.invalidateQueries({ queryKey: ['tablero'] });
    },
  }),
  defaultOptions: {
    queries: {
      retry: (failureCount: number, error: unknown) => {
        if (error instanceof ErrorSolicitud && error.estado >= 400 && error.estado < 500) {
          return false;
        }
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});
