import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

import { startStaticServer } from './serve-dist.mjs';

const DOCS_SITE_ROOT = resolve(import.meta.dirname, '..');
const DIST_DIR = join(DOCS_SITE_ROOT, '..', '..', 'dist', 'apps', 'docs-site');

const checks = [];

function record(name, passed, detail = '') {
  checks.push({ name, passed });
  process.stdout.write(`[smoke-interactions] ${passed ? 'PASS' : 'FAIL'} ${name}${detail === '' ? '' : ` — ${detail}`}\n`);
}

async function checkWithoutJavaScript(browser, baseUrl) {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/como-funciona/`);
  const visibleSteps = await page.locator('[data-step]:visible').count();
  record('sin JS: los 9 pasos de los dos caminos se ven', visibleSteps === 9, `${visibleSteps} visibles`);
  record('sin JS: el tablist queda oculto', !(await page.locator('[role="tablist"]').isVisible()));
  await page.goto(`${baseUrl}/en/`);
  record('sin JS: la home en inglés carga con lang="en"', (await page.getAttribute('html', 'lang')) === 'en');
  await context.close();
}

async function checkTabsAndStepper(browser, baseUrl) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${baseUrl}/como-funciona/`);
  record('con JS: se ve un solo paso del camino activo', (await page.locator('[data-step]:visible').count()) === 1);
  await page.locator('#camino-motion [data-stepper-next]').click();
  const status = await page.locator('#camino-motion [data-stepper-status]').textContent();
  record('stepper: "Siguiente" avanza al paso 2', status === 'Paso 2 de 4', status ?? '');
  await page.locator('#camino-material-tab').click();
  record('tabs: el segundo camino reemplaza al primero', (await page.locator('#camino-material').isVisible()) && !(await page.locator('#camino-motion').isVisible()));
  await page.locator('#camino-material-tab').press('ArrowLeft');
  record('tabs: flecha izquierda vuelve al primer camino', await page.locator('#camino-motion').isVisible());
  await context.close();
}

async function checkThemeAndLocale(browser, baseUrl) {
  const context = await browser.newContext({ colorScheme: 'light' });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/tecnologia/`);
  await page.locator('[data-theme-toggle]').click();
  await page.reload();
  record('tema: la elección oscura se recuerda al recargar', (await page.getAttribute('html', 'data-theme')) === 'dark');
  await page.locator('.site-header [data-locale-switch="en"]').click();
  await page.waitForURL('**/en/technology/');
  record('idioma: el selector lleva a la misma página en inglés', page.url().endsWith('/en/technology/'));
  await page.goto(`${baseUrl}/instalacion/`);
  await page.waitForURL('**/en/installation/');
  record('idioma: la preferencia elegida redirige una página en español', page.url().endsWith('/en/installation/'));
  await context.close();
}

async function checkMobileMenu(browser, baseUrl) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/en/`);
  record('móvil: la navegación arranca cerrada', !(await page.locator('#site-nav').isVisible()));
  await page.locator('[data-menu-toggle]').click();
  record('móvil: el botón de menú la abre', await page.locator('#site-nav').isVisible());
  await page.keyboard.press('Escape');
  record('móvil: Escape la cierra', !(await page.locator('#site-nav').isVisible()));
  await context.close();
}

async function main() {
  const { chromium } = createRequire(import.meta.url)('playwright');
  const { url, close } = await startStaticServer(DIST_DIR);
  const browser = await chromium.launch();
  try {
    await checkWithoutJavaScript(browser, url);
    await checkTabsAndStepper(browser, url);
    await checkThemeAndLocale(browser, url);
    await checkMobileMenu(browser, url);
  } finally {
    await browser.close();
    await close();
  }
  if (checks.some((check) => !check.passed)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(`smoke-interactions failed: ${error.message}\n`);
  process.exit(1);
});
