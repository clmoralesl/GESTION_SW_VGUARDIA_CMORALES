import { expect, test, type Page } from '@playwright/test';
import { fijarSesion } from './apoyo';

async function pixelesDibujados(page: Page): Promise<number> {
  return page.evaluate(() => {
    const lienzo = document.querySelector<HTMLCanvasElement>('[role="dialog"] canvas');
    if (!lienzo || lienzo.width === 0 || lienzo.height === 0) return 0;
    const datos = lienzo.getContext('2d')?.getImageData(0, 0, lienzo.width, lienzo.height).data;
    let pintados = 0;
    for (let i = 3; datos && i < datos.length; i += 4) if (datos[i]! > 0) pintados++;
    return pintados;
  });
}

test('el historial grafico de un KPI se dibuja tambien al reabrirlo', async ({ page }) => {
  await fijarSesion(page, 'JP');
  await page.goto('/kpi');

  const fila = page.getByRole('row').filter({ hasText: 'SPI' }).first();
  const boton = fila.getByRole('button', { name: 'Ver historial del KPI' });
  await expect(boton).toBeVisible({ timeout: 30_000 });

  for (const apertura of [1, 2]) {
    await boton.click();
    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toBeVisible();
    await expect(dialogo.getByText('Valor medido')).toBeVisible();
    await expect
      .poll(() => pixelesDibujados(page), {
        message: `grafico dibujado en la apertura ${apertura}`,
        timeout: 10_000,
      })
      .toBeGreaterThan(1000);
    await page.keyboard.press('Escape');
    await expect(dialogo).toBeHidden();
  }
});
