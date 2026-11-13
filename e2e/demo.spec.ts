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

    const barra133Inicial = page.getByTestId('barra-tarea-1.3.3');
    await expect(barra133Inicial).toBeVisible({ timeout: 30_000 });
    await expect(barra133Inicial).toHaveAttribute(
      'aria-label',
      '1.3.3 Diseñar y validar prototipos UX/UI, del 19-11-2026 al 17-12-2026, avance 0%, crítica',
    );

    const barra211Inicial = page.getByTestId('barra-tarea-2.1.1');
    await expect(barra211Inicial).toBeVisible({ timeout: 30_000 });
    await expect(barra211Inicial).toHaveAttribute(
      'aria-label',
      '2.1.1 Construir agenda centralizada y asignación por carga y especialidad, del 18-12-2026 al 25-01-2027, avance 0%, crítica',
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
    await expect(tarjetaSpiInicial.getByTestId('valor-tarjeta')).toHaveText('0.8756');
    const tarjetaCostoInicial = page.getByTestId('tarjeta-costo');
    await expect(tarjetaCostoInicial.getByTestId('valor-tarjeta')).toContainText('$6.520.200');

    const respCostosInicial = await page.request.get('http://localhost:3000/proyectos/1/costos', {
      headers: { 'X-Rol': 'JP' },
    });
    const datosCostosInicial = await respCostosInicial.json();
    expect(datosCostosInicial.costoPlan).toBe(102058680);

    await page.goto('/tareas');
    await expect(page.getByRole('heading', { name: /Tareas:/ })).toBeVisible();

    const fila133 = page.locator('tr').filter({ hasText: '1.3.3' });
    await expect(fila133).toBeVisible();
    await fila133.getByRole('button', { name: 'Editar' }).click();

    const inputDuracion = page.getByLabel('Duración (días hábiles)');
    await expect(inputDuracion).toBeVisible();
    await inputDuracion.fill('23');

    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByRole('dialog', { name: /Editar tarea/ })).not.toBeVisible();

    await page.goto('/gantt');
    await expect(page.getByRole('heading', { name: 'Carta Gantt' })).toBeVisible();

    const barra133Actualizada = page.getByTestId('barra-tarea-1.3.3');
    await expect(barra133Actualizada).toBeVisible({ timeout: 30_000 });
    await expect(barra133Actualizada).toHaveAttribute(
      'aria-label',
      '1.3.3 Diseñar y validar prototipos UX/UI, del 19-11-2026 al 22-12-2026, avance 0%, crítica',
    );

    const barra211Actualizada = page.getByTestId('barra-tarea-2.1.1');
    await expect(barra211Actualizada).toBeVisible({ timeout: 30_000 });
    await expect(barra211Actualizada).toHaveAttribute(
      'aria-label',
      '2.1.1 Construir agenda centralizada y asignación por carga y especialidad, del 23-12-2026 al 28-01-2027, avance 0%, crítica',
    );

    await page.goto('/tablero-proyecto');
    await expect(page.getByRole('heading', { name: 'Tablero de comando' })).toBeVisible({
      timeout: 30_000,
    });

    const tarjetaAvance = page.getByTestId('tarjeta-avance');
    await expect(tarjetaAvance.getByTestId('valor-tarjeta')).toHaveText('9.82%');

    const tarjetaSpi = page.getByTestId('tarjeta-spi');
    await expect(tarjetaSpi.getByTestId('valor-tarjeta')).toHaveText('0.8756');

    const tarjetaCosto = page.getByTestId('tarjeta-costo');
    await expect(tarjetaCosto.getByTestId('valor-tarjeta')).toContainText('$6.520.200');

    const respCostosActualizado = await page.request.get(
      'http://localhost:3000/proyectos/1/costos',
      {
        headers: { 'X-Rol': 'JP' },
      },
    );
    const datosCostosActualizado = await respCostosActualizado.json();
    expect(datosCostosActualizado.costoPlan).toBe(102416280);
  });

  test('escenario 2: aumento de dedicación genera alerta de sobreasignación y mayor costo', async ({
    page,
  }) => {
    await fijarSesion(page, 'JP');

    await page.goto('/tablero-proyecto');
    await expect(page.getByRole('heading', { name: 'Tablero de comando' })).toBeVisible({
      timeout: 30_000,
    });

    await expect(page.getByText(/Sobreasignación de Valeska Guardia/)).not.toBeVisible();

    const tarjetaCpiInicial = page.getByTestId('tarjeta-cpi');
    await expect(tarjetaCpiInicial.getByTestId('valor-tarjeta')).toHaveText('0.9521');

    const respCostos2Ini = await page.request.get('http://localhost:3000/proyectos/1/costos', {
      headers: { 'X-Rol': 'JP' },
    });
    expect((await respCostos2Ini.json()).costoPlan).toBe(102058680);

    await page.goto('/tareas');
    await expect(page.getByRole('heading', { name: /Tareas:/ })).toBeVisible();

    const fila212 = page.locator('tr').filter({ hasText: '2.1.2' });
    await expect(fila212).toBeVisible();
    await fila212.getByRole('button', { name: 'Detalle' }).click();

    const botonEditarAsignacion = page.getByRole('button', {
      name: 'Editar asignación de Valeska Guardia',
    });
    await expect(botonEditarAsignacion).toBeVisible();
    await botonEditarAsignacion.click();

    const inputDedicacion = page.getByLabel('Dedicación (%)');
    await expect(inputDedicacion).toBeVisible();
    await inputDedicacion.fill('80');

    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByRole('dialog', { name: 'Editar asignación' })).not.toBeVisible();

    await page.goto('/tablero-proyecto');
    await expect(page.getByRole('heading', { name: 'Tablero de comando' })).toBeVisible({
      timeout: 30_000,
    });

    await expect(
      page.getByText(/Sobreasignación de Valeska Guardia entre el 18-12-2026 y el 25-01-2027/),
    ).toBeVisible({ timeout: 30_000 });

    const respCostos2Fin = await page.request.get('http://localhost:3000/proyectos/1/costos', {
      headers: { 'X-Rol': 'JP' },
    });
    expect((await respCostos2Fin.json()).costoPlan).toBe(103298680);
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
    await expect(tarjetaSpi3Ini.getByTestId('valor-tarjeta')).toHaveText('0.8756');
    const tarjetaCpi3Ini = page.getByTestId('tarjeta-cpi');
    await expect(tarjetaCpi3Ini.getByTestId('valor-tarjeta')).toHaveText('0.9521');
    const tarjetaCosto3Ini = page.getByTestId('tarjeta-costo');
    await expect(tarjetaCosto3Ini.getByTestId('valor-tarjeta')).toContainText('$6.520.200');
    await expect(tarjetaCosto3Ini).toContainText('$123.408.680');

    const respCostos3Ini = await page.request.get('http://localhost:3000/proyectos/1/costos', {
      headers: { 'X-Rol': 'JP' },
    });
    expect((await respCostos3Ini.json()).costoPlan).toBe(102058680);

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
    expect(datosVigente.lineaBase.fechaFinProyecto).toBe('2027-06-02');

    await page.goto('/tablero-proyecto');
    await expect(page.getByRole('heading', { name: 'Tablero de comando' })).toBeVisible({
      timeout: 30_000,
    });
    const tarjetaSpi3Fin = page.getByTestId('tarjeta-spi');
    await expect(tarjetaSpi3Fin.getByTestId('valor-tarjeta')).toHaveText('0.8756');
    const tarjetaCpi3Fin = page.getByTestId('tarjeta-cpi');
    await expect(tarjetaCpi3Fin.getByTestId('valor-tarjeta')).toHaveText('0.9521');
    const tarjetaCosto3Fin = page.getByTestId('tarjeta-costo');
    await expect(tarjetaCosto3Fin.getByTestId('valor-tarjeta')).toContainText('$6.520.200');
    await expect(tarjetaCosto3Fin).toContainText('$125.408.680');

    const respCostos3Fin = await page.request.get('http://localhost:3000/proyectos/1/costos', {
      headers: { 'X-Rol': 'JP' },
    });
    expect((await respCostos3Fin.json()).costoPlan).toBe(103367120);

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
      'Línea base 2.1.1: del 18-12-2026 al 25-01-2027',
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

    await page.goto('/bitacora');
    await expect(page.getByRole('heading', { name: 'Bitácora de cambios' })).toBeVisible({
      timeout: 30_000,
    });
    const enlaceSc002 = page.getByRole('link', { name: /Aprobación SC-002/i }).first();
    await expect(enlaceSc002).toBeVisible({ timeout: 30_000 });
    await enlaceSc002.click();
    await expect(page).toHaveURL(/\/solicitudes-cambio\/2|\/cambios\/2/);
    await expect(page.getByText('SC-002', { exact: true })).toBeVisible({ timeout: 30_000 });
  });
});
