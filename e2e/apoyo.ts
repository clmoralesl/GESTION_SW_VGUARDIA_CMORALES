import { execSync } from 'node:child_process';
import type { Page } from '@playwright/test';

export const URL_BASE_API = 'http://localhost:3000';
export const URL_BASE_WEB = 'http://localhost:5173';

export async function reiniciarBase(): Promise<void> {
  execSync('docker compose exec -T api pnpm --filter @autofix/api db:reset', {
    stdio: 'ignore',
  });
  execSync('docker compose exec -T api touch /app/apps/api/dist/main.js', {
    stdio: 'ignore',
  });
  await new Promise((resolve) => setTimeout(resolve, 2500));
  const maxIntentos = 40;
  for (let i = 0; i < maxIntentos; i++) {
    try {
      const resp = await fetch(`${URL_BASE_API}/salud`);
      if (resp.ok) {
        return;
      }
    } catch (_error) {
      void _error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('API no respondio en /salud tras db:reset');
}

export async function fijarSesion(page: Page, rol: 'JP' | 'CC'): Promise<void> {
  await page.addInitScript(
    ({ rolDefinido }) => {
      if (!localStorage.getItem('autofix:rol')) {
        localStorage.setItem('autofix:rol', rolDefinido);
      }
      if (!localStorage.getItem('autofix:proyecto-activo')) {
        localStorage.setItem('autofix:proyecto-activo', '1');
      }
    },
    { rolDefinido: rol },
  );
}

export async function verificarFechaCorte(): Promise<string> {
  const resp = await fetch(`${URL_BASE_API}/proyectos/1/tablero`, {
    headers: { 'X-Rol': 'JP' },
  });
  if (!resp.ok) {
    throw new Error(`Error al leer tablero: ${resp.status}`);
  }
  const data = (await resp.json()) as { fechaCorte: string };
  if (data.fechaCorte !== '2026-11-16') {
    throw new Error(`Fecha de corte inesperada: ${data.fechaCorte} (esperada: 2026-11-16)`);
  }
  return data.fechaCorte;
}
