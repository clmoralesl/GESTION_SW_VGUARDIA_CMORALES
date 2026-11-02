import { expect, test } from '@playwright/test';
import { fijarSesion, reiniciarBase, verificarFechaCorte } from './apoyo';

test.describe.configure({ mode: 'serial' });

test.describe('Demostración del caso de prueba mínimo', () => {
  test.beforeEach(async () => {
    await reiniciarBase();
    await verificarFechaCorte();
  });

  test('escenario 1: ampliación de duración en subactividad crítica desplaza dependencias', async ({
    page,
  }) => {
    await fijarSesion(page, 'JP');

    await page.goto('/gantt');
    await expect(page.getByRole('heading', { name: 'Carta Gantt' })).toBeVisible({
      timeout: 30_000,
    });

    const barra121Inicial = page.getByTestId('barra-tarea-1.2.1');
    await expect(barra121Inicial).toBeVisible({ timeout: 30_000 });
    await expect(barra121Inicial).toHaveAttribute(
      'aria-label',
      '1.2.1 Modelo de datos de vehículos y órdenes, del 09-11-2026 al 13-11-2026, avance 0%, crítica',
    );

    const barra211Inicial = page.getByTestId('barra-tarea-2.1.1');
    await expect(barra211Inicial).toBeVisible({ timeout: 30_000 });
    await expect(barra211Inicial).toHaveAttribute(
      'aria-label',
      '2.1.1 Registro de vehículos y clientes, del 16-11-2026 al 23-11-2026, avance 0%, crítica',
    );

    const barrasIniciales = page.locator(
      '[data-testid^="barra-tarea-"], [data-testid^="barra-resumen-"]',
    );
    await expect(barrasIniciales).toHaveCount(36);

    await page.goto('/tablero-proyecto');
    await expect(page.getByRole('heading', { name: 'Tablero de comando' })).toBeVisible({
      timeout: 30_000,
    });
    const tarjetaSpiInicial = page.getByTestId('tarjeta-spi');
    await expect(tarjetaSpiInicial.getByTestId('valor-tarjeta')).toHaveText('0.2906');
    const tarjetaCostoInicial = page.getByTestId('tarjeta-costo');
    await expect(tarjetaCostoInicial.getByTestId('valor-tarjeta')).toContainText('$275.000');

    const respCostosInicial = await page.request.get('http://localhost:3000/proyectos/1/costos', {
      headers: { 'X-Rol': 'JP' },
    });
    const datosCostosInicial = await respCostosInicial.json();
    expect(datosCostosInicial.costoPlan).toBe(1071700);

    await page.goto('/tareas');
    await expect(page.getByRole('heading', { name: /Tareas:/ })).toBeVisible();

    const fila121 = page.locator('tr').filter({ hasText: '1.2.1' });
    await expect(fila121).toBeVisible();
    await fila121.getByRole('button', { name: 'Editar' }).click();

    const inputDuracion = page.getByLabel('Duración (días hábiles)');
    await expect(inputDuracion).toBeVisible();
    await inputDuracion.fill('7');

    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByRole('dialog', { name: /Editar tarea/ })).not.toBeVisible();

    await page.goto('/gantt');
    await expect(page.getByRole('heading', { name: 'Carta Gantt' })).toBeVisible();

    const barra121Actualizada = page.getByTestId('barra-tarea-1.2.1');
    await expect(barra121Actualizada).toBeVisible({ timeout: 30_000 });
    await expect(barra121Actualizada).toHaveAttribute(
      'aria-label',
      '1.2.1 Modelo de datos de vehículos y órdenes, del 09-11-2026 al 17-11-2026, avance 0%, crítica',
    );

    const barra211Actualizada = page.getByTestId('barra-tarea-2.1.1');
    await expect(barra211Actualizada).toBeVisible({ timeout: 30_000 });
    await expect(barra211Actualizada).toHaveAttribute(
      'aria-label',
      '2.1.1 Registro de vehículos y clientes, del 18-11-2026 al 25-11-2026, avance 0%, crítica',
    );

    await page.goto('/tablero-proyecto');
    await expect(page.getByRole('heading', { name: 'Tablero de comando' })).toBeVisible({
      timeout: 30_000,
    });

    const tarjetaAvance = page.getByTestId('tarjeta-avance');
    await expect(tarjetaAvance.getByTestId('valor-tarjeta')).toHaveText('7.12%');

    const tarjetaSpi = page.getByTestId('tarjeta-spi');
    await expect(tarjetaSpi.getByTestId('valor-tarjeta')).toHaveText('0.2852');

    const tarjetaCosto = page.getByTestId('tarjeta-costo');
    await expect(tarjetaCosto.getByTestId('valor-tarjeta')).toContainText('$275.000');

    const respCostosActualizado = await page.request.get(
      'http://localhost:3000/proyectos/1/costos',
      {
        headers: { 'X-Rol': 'JP' },
      },
    );
    const datosCostosActualizado = await respCostosActualizado.json();
    expect(datosCostosActualizado.costoPlan).toBe(1170700);
  });

  test('escenario 2: ajuste de asignación elimina alerta de sobreasignación', async ({ page }) => {
    await fijarSesion(page, 'JP');

    await page.goto('/tablero-proyecto');
    await expect(page.getByRole('heading', { name: 'Tablero de comando' })).toBeVisible({
      timeout: 30_000,
    });

    await expect(
      page.getByText(/Sobreasignación de Valentina Muñoz entre el 12-11-2026 y el 13-11-2026/),
    ).toBeVisible();

    const tarjetaCpiInicial = page.getByTestId('tarjeta-cpi');
    await expect(tarjetaCpiInicial.getByTestId('valor-tarjeta')).toHaveText('0.8');

    const tarjetaCostoInicial = page.getByTestId('tarjeta-costo');
    await expect(tarjetaCostoInicial.getByTestId('valor-tarjeta')).toContainText('$275.000');

    const respCostos2Ini = await page.request.get('http://localhost:3000/proyectos/1/costos', {
      headers: { 'X-Rol': 'JP' },
    });
    expect((await respCostos2Ini.json()).costoPlan).toBe(1071700);

    await page.goto('/recursos?pestana=carga');
    await expect(page.getByRole('heading', { name: 'Recursos' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole('heading', { name: 'Distribución semanal de carga' })).toBeVisible({
      timeout: 30_000,
    });

    const panelCargaInicial = page
      .getByRole('tabpanel')
      .filter({ hasText: 'Distribución semanal de carga' });
    const filaValentinaInicial = panelCargaInicial
      .locator('tr')
      .filter({ hasText: 'Valentina Muñoz' });
    await expect(filaValentinaInicial).toBeVisible();
    await expect(filaValentinaInicial).toContainText('84%');

    await page.goto('/tareas');
    await expect(page.getByRole('heading', { name: /Tareas:/ })).toBeVisible();

    const fila121 = page.locator('tr').filter({ hasText: '1.2.1' });
    await expect(fila121).toBeVisible();
    await fila121.getByRole('button', { name: 'Detalle' }).click();

    const botonEditarAsignacion = page.getByRole('button', {
      name: 'Editar asignación de Valentina Muñoz',
    });
    await expect(botonEditarAsignacion).toBeVisible();
    await botonEditarAsignacion.click();

    const inputDedicacion = page.getByLabel('Dedicación (%)');
    await expect(inputDedicacion).toBeVisible();
    await inputDedicacion.fill('40');

    const inputHorasReales = page.getByLabel('Horas reales');
    await expect(inputHorasReales).toBeVisible();
    await inputHorasReales.fill('15');

    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByRole('dialog', { name: 'Editar asignación' })).not.toBeVisible();

    await page.goto('/recursos?pestana=carga');
    await expect(page.getByRole('heading', { name: 'Distribución semanal de carga' })).toBeVisible({
      timeout: 30_000,
    });

    const panelCargaFinal = page
      .getByRole('tabpanel')
      .filter({ hasText: 'Distribución semanal de carga' });
    const filaValentinaFinal = panelCargaFinal.locator('tr').filter({ hasText: 'Valentina Muñoz' });
    await expect(filaValentinaFinal).toContainText('64%');

    await page.goto('/tablero-proyecto');
    await expect(page.getByRole('heading', { name: 'Tablero de comando' })).toBeVisible({
      timeout: 30_000,
    });

    await expect(
      page.getByText(/Sobreasignación de Valentina Muñoz entre el 12-11-2026 y el 13-11-2026/),
    ).not.toBeVisible();

    const tarjetaCpiFinal = page.getByTestId('tarjeta-cpi');
    await expect(tarjetaCpiFinal.getByTestId('valor-tarjeta')).toHaveText('0.5714');

    const tarjetaCostoFinal = page.getByTestId('tarjeta-costo');
    await expect(tarjetaCostoFinal.getByTestId('valor-tarjeta')).toContainText('$385.000');

    const respCostos2Fin = await page.request.get('http://localhost:3000/proyectos/1/costos', {
      headers: { 'X-Rol': 'JP' },
    });
    expect((await respCostos2Fin.json()).costoPlan).toBe(989200);
  });

  test('escenario 3: aprobación de solicitud SC-002 por CC genera nueva versión de línea base', async ({
    page,
  }) => {
    await fijarSesion(page, 'JP');

    await page.goto('/tablero-proyecto');
    await expect(page.getByRole('heading', { name: 'Tablero de comando' })).toBeVisible({
      timeout: 30_000,
    });
    const tarjetaSpi3Ini = page.getByTestId('tarjeta-spi');
    await expect(tarjetaSpi3Ini.getByTestId('valor-tarjeta')).toHaveText('0.2906');
    const tarjetaCpi3Ini = page.getByTestId('tarjeta-cpi');
    await expect(tarjetaCpi3Ini.getByTestId('valor-tarjeta')).toHaveText('0.8');
    const tarjetaCosto3Ini = page.getByTestId('tarjeta-costo');
    await expect(tarjetaCosto3Ini.getByTestId('valor-tarjeta')).toContainText('$275.000');
    await expect(tarjetaCosto3Ini).toContainText('$45.000.000');

    const respCostos3Ini = await page.request.get('http://localhost:3000/proyectos/1/costos', {
      headers: { 'X-Rol': 'JP' },
    });
    expect((await respCostos3Ini.json()).costoPlan).toBe(1071700);

    await page.goto('/tablero-cambio');
    await expect(page.getByRole('heading', { name: 'Tablero de gestión del cambio' })).toBeVisible({
      timeout: 30_000,
    });

    await expect(
      page.getByTestId('tarjeta-total').locator('.mantine-Text-root').filter({ hasText: /^5$/ }),
    ).toBeVisible();
    await expect(
      page.getByTestId('tarjeta-abierta').locator('.mantine-Text-root').filter({ hasText: /^3$/ }),
    ).toBeVisible();
    await expect(
      page.getByTestId('tarjeta-aprobada').locator('.mantine-Text-root').filter({ hasText: /^2$/ }),
    ).toBeVisible();
    await expect(
      page
        .getByTestId('tarjeta-rechazada')
        .locator('.mantine-Text-root')
        .filter({ hasText: /^1$/ }),
    ).toBeVisible();

    await page.goto('/cambios/2');
    await expect(page.getByText('SC-002')).toBeVisible({ timeout: 30_000 });

    const tabImpactos = page.getByRole('tab', { name: /Impactos y Aprobación/ });
    await expect(tabImpactos).toBeVisible();
    await tabImpactos.click();

    const botonAprobarJP = page.getByRole('button', { name: 'Aprobar cambio' });
    await expect(botonAprobarJP).toBeVisible();
    await expect(botonAprobarJP).toBeDisabled();

    await page.getByText('CC', { exact: true }).click();
    await expect(page.getByRole('radio', { name: 'CC' })).toBeChecked();

    const botonAprobarCC = page.getByRole('button', { name: 'Aprobar cambio' });
    await expect(botonAprobarCC).toBeEnabled();
    await botonAprobarCC.click();

    const botonConfirmar = page.getByRole('button', { name: 'Confirmar aprobación' });
    await expect(botonConfirmar).toBeVisible();
    await botonConfirmar.click();

    await expect(
      page.getByRole('dialog', { name: 'Confirmar aprobación de cambio' }),
    ).not.toBeVisible();
    await expect(page.getByText('APROBADA', { exact: true })).toBeVisible({ timeout: 30_000 });

    const respVigente = await page.request.get(
      'http://localhost:3000/proyectos/1/lineas-base/vigente',
      {
        headers: { 'X-Rol': 'JP' },
      },
    );
    const datosVigente = await respVigente.json();
    expect(datosVigente.lineaBase.version).toBe(2);
    expect(datosVigente.lineaBase.fechaFinProyecto).toBe('2027-01-15');

    await page.goto('/tablero-proyecto');
    await expect(page.getByRole('heading', { name: 'Tablero de comando' })).toBeVisible({
      timeout: 30_000,
    });
    const tarjetaSpi3Fin = page.getByTestId('tarjeta-spi');
    await expect(tarjetaSpi3Fin.getByTestId('valor-tarjeta')).toHaveText('0.2492');
    const tarjetaCpi3Fin = page.getByTestId('tarjeta-cpi');
    await expect(tarjetaCpi3Fin.getByTestId('valor-tarjeta')).toHaveText('0.8');
    const tarjetaCosto3Fin = page.getByTestId('tarjeta-costo');
    await expect(tarjetaCosto3Fin.getByTestId('valor-tarjeta')).toContainText('$275.000');
    await expect(tarjetaCosto3Fin).toContainText('$48.000.000');

    const respCostos3Fin = await page.request.get('http://localhost:3000/proyectos/1/costos', {
      headers: { 'X-Rol': 'JP' },
    });
    expect((await respCostos3Fin.json()).costoPlan).toBe(1373800);

    await page.goto('/gantt');
    await expect(page.getByRole('heading', { name: 'Carta Gantt' })).toBeVisible({
      timeout: 30_000,
    });

    const switchLineaBase = page.getByLabel('Línea base');
    await expect(switchLineaBase).toBeVisible({ timeout: 30_000 });
    await switchLineaBase.click({ force: true });

    const selectVersion = page.getByRole('textbox', { name: 'Versión de línea base' });
    await expect(selectVersion).toBeVisible();
    await selectVersion.click();
    await page.getByRole('option', { name: /v2/ }).click();
    await expect(selectVersion).toHaveValue(/v2/);

    const barraLineaBase211 = page.getByTestId('linea-base-2.1.1');
    await expect(barraLineaBase211).toBeVisible({ timeout: 30_000 });
    await expect(barraLineaBase211).toHaveAttribute(
      'aria-label',
      'Línea base 2.1.1: del 19-11-2026 al 26-11-2026',
    );

    await page.goto('/tablero-cambio');
    await expect(page.getByRole('heading', { name: 'Tablero de gestión del cambio' })).toBeVisible({
      timeout: 30_000,
    });

    await expect(
      page.getByTestId('tarjeta-total').locator('.mantine-Text-root').filter({ hasText: /^5$/ }),
    ).toBeVisible();
    await expect(
      page.getByTestId('tarjeta-abierta').locator('.mantine-Text-root').filter({ hasText: /^3$/ }),
    ).toBeVisible();
    await expect(
      page.getByTestId('tarjeta-aprobada').locator('.mantine-Text-root').filter({ hasText: /^3$/ }),
    ).toBeVisible();
    await expect(
      page
        .getByTestId('tarjeta-rechazada')
        .locator('.mantine-Text-root')
        .filter({ hasText: /^1$/ }),
    ).toBeVisible();
  });
});
