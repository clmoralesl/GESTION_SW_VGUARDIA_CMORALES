import { RolUsuario } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { ROL_BD, ROL_DESDE_BD } from './rol-bd';

describe('ROL_BD', () => {
  it('tiene correspondencia biyectiva con RolUsuario de Prisma', () => {
    const valoresMapeados = Object.values(ROL_BD).sort();
    const valoresPrisma = Object.values(RolUsuario).sort();
    expect(valoresMapeados).toEqual(valoresPrisma);
  });

  it('ROL_DESDE_BD invierte correctamente los valores de Prisma', () => {
    expect(ROL_DESDE_BD[RolUsuario.JEFE_PROYECTO]).toBe('JP');
    expect(ROL_DESDE_BD[RolUsuario.COMITE_CAMBIOS]).toBe('CC');
  });
});
