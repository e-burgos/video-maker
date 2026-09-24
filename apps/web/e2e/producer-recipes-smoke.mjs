import { cp, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  MEDIA_ENV_VARS,
  REPO_ROOT,
  assert,
  assertMediaEnvResolvable,
  loadRootEnv,
  log,
  resolvePlaywright,
  spawnLogged,
  waitForHttp,
} from './smoke-helpers.mjs';

const ARTIFACTS_DIR = join(
  REPO_ROOT,
  'sdd/specs/spec-e-burgos-015-studio-producer/fixes/artifacts',
);

const RENDER_API_PORT = 4450;
const WEB_PORT = 4451;
const SLUG = 'producer-recipes-smoke';
const SOURCE_PROJECT = join(REPO_ROOT, 'media/display-ads');

async function seedProject(mediaRoot) {
  const projectRoot = join(mediaRoot, SLUG);
  await mkdir(projectRoot, { recursive: true });
  await cp(join(SOURCE_PROJECT, 'raw'), join(projectRoot, 'raw'), { recursive: true });
  return projectRoot;
}

async function switchTo(page, language) {
  await page.locator(`[data-testid="language-switch"] [data-language="${language}"]`).click();
  await page.waitForFunction((code) => document.documentElement.lang === code, language, {
    timeout: 10000,
  });
}

async function recipeChips(page) {
  return page
    .locator('[data-testid="producer-recipes"] button')
    .evaluateAll((nodes) =>
      nodes.map((node) => ({
        id: node.dataset.recipe,
        label: (node.textContent ?? '').trim(),
        description: node.getAttribute('title') ?? '',
      })),
    );
}

async function composerValue(page) {
  return page.locator('[data-testid="producer-composer"] textarea').inputValue();
}

async function draftFromRecipe(page, id) {
  await page.locator(`[data-testid="producer-recipes"] [data-recipe="${id}"]`).click();
  await page.waitForFunction(
    () =>
      (document.querySelector('[data-testid="producer-composer"] textarea')?.value ?? '').length >
      200,
    null,
    { timeout: 15000 },
  );
  return composerValue(page);
}

async function main() {
  await loadRootEnv(MEDIA_ENV_VARS);
  assertMediaEnvResolvable(MEDIA_ENV_VARS);

  const tempMediaRoot = await mkdtemp(join(tmpdir(), 'producer-recipes-media-'));
  await mkdir(ARTIFACTS_DIR, { recursive: true });
  log('1', `temp media root: ${tempMediaRoot} (outside media/, only raw/ of display-ads is copied)`);
  const projectRoot = await seedProject(tempMediaRoot);
  log('1', `seeded ${projectRoot}`);

  log('2', `starting apps/render-api on ${RENDER_API_PORT} and vite on ${WEB_PORT}`);
  const renderApi = spawnLogged(
    'render-api',
    'node',
    ['-r', './apps/render-api/src/server-register.cjs', 'apps/render-api/src/main.ts'],
    {
      ...process.env,
      RENDER_API_PORT: String(RENDER_API_PORT),
      RENDER_API_MEDIA_ROOT: tempMediaRoot,
      SWC_NODE_PROJECT: 'tsconfig.base.json',
    },
  );
  log('2', `render-api pid: ${renderApi.pid}`);

  const web = spawnLogged('web', 'pnpm', ['exec', 'vite', '--config', 'apps/web/vite.config.ts'], {
    ...process.env,
    WEB_PORT: String(WEB_PORT),
    RENDER_API_URL: `http://127.0.0.1:${RENDER_API_PORT}`,
  });
  log('2', `web pid: ${web.pid}`);

  let browser = null;

  try {
    await waitForHttp(`http://127.0.0.1:${RENDER_API_PORT}/health`, 20000);
    await waitForHttp(`http://localhost:${WEB_PORT}/api/projects`, 20000);

    const { chromium } = await resolvePlaywright();
    browser = await chromium.launch({ channel: 'chrome' });
    const context = await browser.newContext({ viewport: { width: 1280, height: 1400 } });
    const page = await context.newPage();
    page.on('console', (message) => {
      if (message.type() === 'error') {
        log('console-error', message.text());
      }
    });
    page.on('pageerror', (error) => log('pageerror', error.stack ?? error.message));

    log('3', 'opening the workspace of the copied project, in spanish');
    await page.goto(`http://localhost:${WEB_PORT}/projects/${SLUG}`, {
      waitUntil: 'networkidle',
    });
    await page.waitForSelector('[data-testid="producer-welcome"]', { timeout: 20000 });
    await switchTo(page, 'es');

    log('3', 'cheap gate: the build under test carries the recipes row, which no older build has');
    await page.waitForSelector('[data-testid="producer-recipes"]', { timeout: 15000 });

    const inventory = await page
      .locator('[data-testid="producer-inventory"]')
      .evaluate((node) => (node.textContent ?? '').replace(/\s+/g, ' ').trim());
    log('3', `inventory: ${inventory}`);
    assert(inventory.includes('aroll'), 'the copied raw/ of display-ads is the material on screen');

    const spanishChips = await recipeChips(page);
    for (const chip of spanishChips) {
      log('3', `chip ${chip.id}: "${chip.label}" — ${chip.description}`);
    }
    assert(spanishChips.length >= 1, 'the recipes row offers at least one recipe');
    assert(spanishChips[0].id === 'tutorial', 'the first recipe is the tutorial one');
    assert(spanishChips[0].label === 'Tutorial', 'the chip is named Tutorial');
    assert(
      spanishChips[0].description.includes('pantalla grabada'),
      'the chip explains in spanish what the recipe produces',
    );

    const recipesBeforeStarters = await page.evaluate(() => {
      const recipes = document.querySelector('[data-testid="producer-recipes"]');
      const starters = document.querySelector('[data-testid="producer-starters"]');
      return Boolean(
        recipes.compareDocumentPosition(starters) & Node.DOCUMENT_POSITION_FOLLOWING,
      );
    });
    assert(recipesBeforeStarters, 'the recipes row sits above the loose starters');

    log('4', 'tapping Tutorial fills the composer with the whole recipe, in spanish');
    const spanishDraft = await draftFromRecipe(page, 'tutorial');
    log('4', `composer (es): ${spanishDraft}`);
    for (const phrase of [
      'Receta Tutorial',
      'YouTube',
      'voz generada (Daniela, español rioplatense)',
      'sincronizada con lo que pasa en pantalla',
      'subtítulos clásicos abajo',
      'música libre suave de fondo con crédito',
      'logo transparente abajo a la derecha al 50 %',
      'placa de inicio y otra de cierre de 2 segundos con fondo blanco',
      '[pegá acá tu tabla de escenas, o decime que mire el video y te la proponga]',
    ]) {
      assert(spanishDraft.includes(phrase), `the spanish prompt states: ${phrase}`);
    }
    for (const id of ['youtube-16x9', 'educational', 'subtle-lower', 'captionStyle']) {
      assert(!spanishDraft.includes(id), `the prompt never exposes the id ${id}`);
    }
    assert(
      (await page.locator('[data-testid="producer-message-list"]').count()) === 0,
      'the recipe lands in the composer to be edited, it is not sent',
    );
    await page.screenshot({ path: join(ARTIFACTS_DIR, 'producer-recipes-01-tutorial-es.png') });

    log('5', 'switching to english changes the chip and the prompt it drafts');
    await switchTo(page, 'en');
    const englishChips = await recipeChips(page);
    log('5', `chip in english: "${englishChips[0].label}" — ${englishChips[0].description}`);
    assert(
      englishChips[0].description.includes('screen recording') &&
        englishChips[0].description !== spanishChips[0].description,
      'the chip description is translated, not the spanish one twice',
    );

    await page.locator('[data-testid="producer-composer"] textarea').fill('');
    const englishDraft = await draftFromRecipe(page, 'tutorial');
    log('5', `composer (en): ${englishDraft}`);
    for (const phrase of [
      'Tutorial recipe',
      'for YouTube',
      'generated voice (Daniela, Rioplatense Spanish)',
      'classic subtitles at the bottom',
      '[paste your table of scenes here, or tell me to watch the video and propose it to you]',
    ]) {
      assert(englishDraft.includes(phrase), `the english prompt states: ${phrase}`);
    }
    assert(englishDraft !== spanishDraft, 'the prompt follows the language of the ui');
    await page.screenshot({ path: join(ARTIFACTS_DIR, 'producer-recipes-02-tutorial-en.png') });

    log('done', 'producer recipes smoke passed');
  } finally {
    if (browser !== null) {
      await browser.close();
    }
    for (const child of [web, renderApi]) {
      if (child.pid !== undefined) {
        log('cleanup', `killing pid ${child.pid}`);
        child.kill('SIGTERM');
      }
    }
    await rm(tempMediaRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
