import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  REPO_ROOT,
  VOICE_ENV_VARS,
  assert,
  assertMediaEnvResolvable,
  loadRootEnv,
  log,
  memoryGate,
  resolvePlaywright,
  spawnLogged,
  waitForHttp,
} from './smoke-helpers.mjs';

const ARTIFACTS_DIR = join(
  REPO_ROOT,
  'sdd/specs/spec-e-burgos-016-studio-usability/cycles/cycle-02/artifacts',
);

const RENDER_API_PORT = 4415;
const WEB_PORT = 4416;
const SLUG = 'i18n-smoke';
const GUIDE_SECTIONS = [
  'projects',
  'library',
  'producer',
  'storyboard',
  'voice',
  'preview',
  'presets',
  'flows',
];

async function navTexts(page) {
  return page
    .locator('[data-testid="project-nav"] a')
    .evaluateAll((nodes) => nodes.map((node) => (node.textContent ?? '').trim()));
}

async function switchTo(page, language) {
  await page.locator(`[data-testid="language-switch"] [data-language="${language}"]`).click();
  await page.waitForFunction(
    (code) => document.documentElement.lang === code,
    language,
    { timeout: 10000 },
  );
}

async function activeLanguage(page) {
  return page.evaluate(() => ({
    documentLanguage: document.documentElement.lang,
    stored: window.localStorage.getItem('video-maker.language'),
    pressed: Array.from(document.querySelectorAll('[data-testid="language-switch"] button'))
      .filter((button) => button.getAttribute('aria-pressed') === 'true')
      .map((button) => button.dataset.language),
  }));
}

async function guideSections(page) {
  return page
    .locator('[data-testid="guide-section"]')
    .evaluateAll((nodes) =>
      nodes.map((node) => ({
        id: node.dataset.guideSection,
        heading: (node.querySelector('h2')?.textContent ?? '').trim(),
        characters: (node.textContent ?? '').length,
        tables: node.querySelectorAll('table').length,
      })),
    );
}

async function main() {
  await memoryGate();
  await loadRootEnv(VOICE_ENV_VARS);
  assertMediaEnvResolvable(VOICE_ENV_VARS);

  const tempMediaRoot = await mkdtemp(join(tmpdir(), 'i18n-smoke-media-'));
  const previewCache = await mkdtemp(join(tmpdir(), 'i18n-smoke-cache-'));
  await mkdir(ARTIFACTS_DIR, { recursive: true });
  log('1', `temp media root: ${tempMediaRoot} — preview cache: ${previewCache} (both outside media/)`);

  log('2', `starting apps/render-api on ${RENDER_API_PORT} and vite on ${WEB_PORT}`);
  const renderApi = spawnLogged(
    'render-api',
    'node',
    ['-r', './apps/render-api/src/server-register.cjs', 'apps/render-api/src/main.ts'],
    {
      ...process.env,
      RENDER_API_PORT: String(RENDER_API_PORT),
      RENDER_API_MEDIA_ROOT: tempMediaRoot,
      PIPER_PREVIEW_CACHE_DIR: previewCache,
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

    const created = await fetch(`http://127.0.0.1:${RENDER_API_PORT}/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug: SLUG }),
    });
    assert(created.status === 201, `POST /projects created ${SLUG} (got ${created.status})`);

    await waitForHttp(`http://localhost:${WEB_PORT}/api/projects`, 20000);

    const { chromium } = await resolvePlaywright();
    browser = await chromium.launch({ channel: 'chrome' });
    const context = await browser.newContext({ viewport: { width: 1280, height: 1800 } });
    const page = await context.newPage();
    page.on('console', (message) => {
      if (message.type() === 'error') {
        log('console-error', message.text());
      }
    });
    page.on('pageerror', (error) => log('pageerror', error.stack ?? error.message));
    page.on('response', (response) => {
      if (response.status() >= 400) {
        log('http', `${response.status()} ${response.url()}`);
      }
    });

    log('3', 'cheap gate: the header of the build under test carries the language switch');
    await page.goto(`http://localhost:${WEB_PORT}/projects/${SLUG}/library`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="language-switch"]', { timeout: 15000 });
    const englishNav = await navTexts(page);
    log('3', `nav in english: ${englishNav.join(' · ')}`);
    assert(
      englishNav.join(',') === 'library,storyboard,voice,preview',
      'the studio opens in english, with the four advanced-editing sections of the project',
    );

    log('4', 'switching the header to spanish');
    await switchTo(page, 'es');
    const spanishNav = await navTexts(page);
    log('4', `nav in spanish: ${spanishNav.join(' · ')}`);
    assert(
      spanishNav.join(',') === 'biblioteca,storyboard,voz,vista previa',
      'the whole nav changed language at once, with no reload',
    );

    const roles = await page.locator('[data-testid="asset-role-choice"]').evaluateAll((nodes) =>
      nodes.map((node) => ({
        role: node.dataset.role,
        text: (node.textContent ?? '').replace(/\s+/g, ' ').trim(),
      })),
    );
    for (const role of roles) {
      log('4', `role card: ${role.role} → ${role.text}`);
    }
    assert(
      roles.length === 6 && roles.every((role) => role.text.length > 60),
      'the six upload roles are still explained after the switch',
    );
    assert(
      roles[0].text.includes('Las tomas en las que hablás') && roles[0].text.includes('obligatorio'),
      'the A-roll role reads in spanish, including its required badge',
    );
    assert(
      roles.every((role) => role.text.includes(`raw/${role.role}/`)),
      'the technical directory of every role is shown untranslated next to its spanish copy',
    );
    const hint = await page.locator('[data-testid="asset-role-hint"]').textContent();
    log('4', `role hint: ${hint}`);
    assert(hint.includes('al menos tres veces'), 'the B-roll matching rule reads in spanish');
    await page.screenshot({ path: join(ARTIFACTS_DIR, 'i18n-smoke-01-library-es.png') });

    log('5', 'reloading to prove the choice survives the session');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.documentElement.lang === 'es', null, {
      timeout: 15000,
    });
    const persisted = await activeLanguage(page);
    log('5', `after reload: ${JSON.stringify(persisted)}`);
    assert(persisted.stored === 'es', 'the language is persisted in local storage');
    assert(persisted.documentLanguage === 'es', 'the document reopens stamped as spanish');
    assert(
      persisted.pressed.length === 1 && persisted.pressed[0] === 'es',
      'exactly one language reads as pressed in the switch, and it is spanish',
    );
    const reloadedNav = await navTexts(page);
    assert(
      reloadedNav.join(',') === 'biblioteca,storyboard,voz,vista previa',
      'the nav comes back in spanish after the reload',
    );

    log('6', 'the producer welcome and its starter chips read in spanish');
    await page.getByRole('link', { name: 'productor', exact: true }).click();
    await page.waitForSelector('[data-testid="producer-welcome"]', { timeout: 20000 });
    const welcome = await page
      .locator('[data-testid="producer-welcome"]')
      .evaluate((node) => (node.textContent ?? '').replace(/\s+/g, ' ').trim());
    log('6', `producer welcome: ${welcome.slice(0, 200)}`);
    const starters = await page
      .locator('[data-testid="producer-starters"] button')
      .evaluateAll((nodes) => nodes.map((node) => (node.textContent ?? '').trim()));
    log('6', `starter chips: ${starters.join(' | ')}`);
    assert(
      welcome.includes('Contale al productor qué querés hacer'),
      'the producer welcome is written in spanish',
    );
    assert(
      starters.some((starter) => starter.startsWith('Contame qué video querés')),
      'the starter chips, which become a message to the agent, are in spanish too',
    );
    await page.screenshot({ path: join(ARTIFACTS_DIR, 'i18n-smoke-02-producer-es.png') });

    log('7', 'the voice cards read in spanish against the installed Piper voices');
    await page.getByRole('link', { name: 'voz', exact: true }).click();
    await page.waitForSelector('[data-testid="voice-card"]', { timeout: 30000 });
    const cards = await page.locator('[data-testid="voice-card"]').evaluateAll((nodes) =>
      nodes.map((node) => ({
        id: node.dataset.voiceId,
        text: (node.textContent ?? '').replace(/\s+/g, ' ').trim(),
        previewLabel: node.querySelector('button')?.getAttribute('aria-label'),
      })),
    );
    for (const card of cards) {
      log('7', `voice card: ${card.id} → ${card.text}`);
    }
    assert(cards.length >= 3, `the three installed voices are listed (${cards.length})`);
    assert(
      cards.some((card) => card.text.includes('calidad')),
      'the quality of a voice reads in spanish',
    );
    assert(
      cards.every((card) => (card.previewLabel ?? '').startsWith('Escuchar ')),
      'the preview button is named in spanish for a screen reader',
    );
    assert(
      cards.every((card) => card.text.includes(card.id.split('-')[0].replace('_', '-'))),
      'the technical language tag of every voice is shown untranslated next to its spanish quality',
    );
    assert(
      cards.every((card) => card.text.includes('Neural voice trained on the')),
      'the label and the description that GET /voices publishes stay as the service wrote them: they are catalog data, not ui copy',
    );
    const voiceHeading = await page
      .locator('[data-testid="voice-trigger"] h2')
      .textContent();
    assert(voiceHeading.trim() === 'locución', `the voice section is titled in spanish (${voiceHeading})`);
    await page.screenshot({ path: join(ARTIFACTS_DIR, 'i18n-smoke-03-voice-es.png') });

    log('8', 'the guide explains every section, in spanish');
    await page.getByTestId('guide-nav').click();
    await page.waitForSelector('[data-testid="guide-section"]', { timeout: 20000 });
    const spanishGuide = await guideSections(page);
    for (const section of spanishGuide) {
      log('8', `section ${section.id}: "${section.heading}" (${section.characters} chars, ${section.tables} table(s))`);
    }
    assert(
      spanishGuide.map((section) => section.id).join(',') === GUIDE_SECTIONS.join(','),
      'the guide covers every section of the studio, in the order of the flow',
    );
    assert(
      spanishGuide.every((section) => section.characters > 300),
      'every guide section is written, not stubbed',
    );
    assert(
      spanishGuide.find((section) => section.id === 'presets').tables === 1,
      'the guide carries the table of output presets',
    );
    assert(
      spanishGuide.find((section) => section.id === 'library').heading.includes('Biblioteca'),
      'the guide is rendered in spanish',
    );
    await page.screenshot({ path: join(ARTIFACTS_DIR, 'i18n-smoke-04-guide-es.png') });

    log('9', 'the same guide in english');
    await switchTo(page, 'en');
    await page.waitForFunction(
      () =>
        (document.querySelector('[data-guide-section="library"] h2')?.textContent ?? '').includes(
          'Library',
        ),
      null,
      { timeout: 20000 },
    );
    const englishGuide = await guideSections(page);
    for (const section of englishGuide) {
      log('9', `section ${section.id}: "${section.heading}" (${section.characters} chars)`);
    }
    assert(
      englishGuide.map((section) => section.id).join(',') === GUIDE_SECTIONS.join(','),
      'the english guide has the very same sections',
    );
    assert(
      englishGuide.every(
        (section, index) => section.heading !== spanishGuide[index].heading,
      ),
      'every section is actually translated, not the same text twice',
    );
    const englishSwitch = await activeLanguage(page);
    log('9', `after switching back: ${JSON.stringify(englishSwitch)}`);
    assert(englishSwitch.stored === 'en', 'switching back to english is persisted too');
    await page.screenshot({ path: join(ARTIFACTS_DIR, 'i18n-smoke-05-guide-en.png') });

    log('done', 'i18n smoke passed');
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
    await rm(previewCache, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
