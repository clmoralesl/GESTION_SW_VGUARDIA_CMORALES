import { RolUsuario } from '@prisma/client';
import type { Rol } from '@autofix/core';

export const ROL_BD = {
  JP: RolUsuario.JEFE_PROYECTO,
  CC: RolUsuario.COMITE_CAMBIOS,
} as const satisfies Record<Rol, RolUsuario>;

export const ROL_DESDE_BD = {
  [RolUsuario.JEFE_PROYECTO]: 'JP',
  [RolUsuario.COMITE_CAMBIOS]: 'CC',
} as const satisfies Record<RolUsuario, Rol>;
