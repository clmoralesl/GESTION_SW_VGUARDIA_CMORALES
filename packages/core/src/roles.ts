import { z } from './validacion';

export const ROLES = ['JP', 'CC'] as const;
export type Rol = (typeof ROLES)[number];
export const esquemaRol = z.enum(ROLES);

export const NOMBRES_ROL: Record<Rol, string> = {
  JP: 'Jefe de Proyecto',
  CC: 'Comité de Cambios',
};

export const PERMISOS = {
  editarPlanificacion: ['JP'],
  gestionarRecursos: ['JP'],
  importarDatos: ['JP'],
  gestionarSolicitudesCambio: ['JP'],
  adjuntarEvidencias: ['JP', 'CC'],
  avanzarEtapasCambio: ['CC'],
  decidirSolicitudesCambio: ['CC'],
} as const satisfies Record<string, readonly Rol[]>;

export type Permiso = keyof typeof PERMISOS;

export function tienePermiso(rol: Rol, permiso: Permiso): boolean {
  return (PERMISOS[permiso] as readonly Rol[]).includes(rol);
}

function nombresRoles(roles: readonly Rol[]): string {
  return roles.map((rol) => NOMBRES_ROL[rol]).join(' o ');
}

export function textoRestriccion(roles: readonly Rol[]): string {
  return `Solo ${nombresRoles(roles)}`;
}

export function mensajeRolNoPermitido(roles: readonly Rol[]): string {
  return `Acción permitida solo para ${nombresRoles(roles)}.`;
}
