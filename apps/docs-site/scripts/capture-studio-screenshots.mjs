import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { parseArgs } from 'node:util';

const DOCS_SITE_ROOT = resolve(import.meta.dirname, '..');
const REPO_ROOT = resolve(DOCS_SITE_ROOT, '..', '..');
const DEFAULT_OUT_DIR = join(DOCS_SITE_ROOT, 'public', 'screenshots');
const DEFAULT_STUDIO_URL = 'http://localhost:4298';
const VIEWPORT = { width: 1440, height: 900 };

const FOOTAGE_SLUG = 'display-ads-asignar-campana';
const MATERIAL_SLUG = 'optica-siochana';
const PROPOSAL_SLUG = 'display-ads-analiticas';
const MOTION_SLUG = 'display-ads-easy-pro';
const MOTION_CHAT_SLUG = 'display-ads-easy-pro';

const PROPOSED_UPLOAD = {
  id: 'nuevo-clip',
  fileName: 'nuevo-clip.mp4',
  path: 'raw/aroll/analiticas.mp4',
  proposedRole: 'broll',
  proposalReason: 'no-audio',
  probe: { kind: 'video', durationMs: 94433, width: 1920, height: 1080, hasAudio: false },
  status: 'pending',
};

function log(message) {
  process.stdout.write(`[capture-studio-screenshots] ${message}\n`);
}

function loadChromium() {
  const require = createRequire(import.meta.url);
  const playwrightEntry = resolve(
    REPO_ROOT,
    'node_modules/.pnpm/playwright-core@1.62.0/node_modules/playwright-core',
  );
  return require(playwrightEntry).chromium;
}

function captureOptions() {
  const { values } = parseArgs({
    options: {
      out: { type: 'string', default: DEFAULT_OUT_DIR },
      url: { type: 'string', default: process.env.STUDIO_URL ?? DEFAULT_STUDIO_URL },
      theme: { type: 'string', default: 'light' },
      only: { type: 'string', default: '' },
    },
  });
  return {
    outDir: resolve(values.out),
    studioUrl: values.url,
    theme: values.theme,
    only: values.only.split(',').map((name) => name.trim()).filter((name) => name !== ''),
  };
}

async function settle(page, milliseconds = 1400) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(milliseconds);
}

async function scrollShellContent(page, selector) {
  await page.evaluate((targetSelector) => {
    const target = document.querySelector(targetSelector);
    target?.scrollIntoView({ block: 'start' });
  }, selector);
  await page.waitForTimeout(600);
}

async function openProducerMaterialTab(page) {
  await page.getByRole('tab', { name: 'Material' }).click();
  await page.waitForTimeout(900);
}

async function mockPendingUpload(page) {
  await page.route(`**/api/projects/${PROPOSAL_SLUG}/inbox`, (route) =>
    route.fulfill({ json: { assets: [PROPOSED_UPLOAD] } }),
  );
}

async function openCreateVideoForm(page) {
  await page.getByRole('button', { name: 'Nuevo video' }).first().click();
  await page.waitForTimeout(900);
}

async function mockOpenRouterEngineChosen(page) {
  await page.route('**/api/settings/producer', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.abort();
      return;
    }
    const response = await route.fetch();
    const settings = await response.json();
    await route.fulfill({
      response,
      json: { ...settings, engine: 'openrouter', effectiveEngine: 'openrouter' },
    });
  });
}

async function showVideoFrameAt(page, seconds) {
  await page.evaluate(async (targetSeconds) => {
    const video = document.querySelector('video');
    if (video === null) return;
    await new Promise((done) => {
      video.addEventListener('seeked', done, { once: true });
      video.currentTime = targetSeconds;
      setTimeout(done, 4000);
    });
  }, seconds);
  await page.waitForTimeout(500);
}

const SCREENS = [
  { name: 'home-projects', path: '/' },
  { name: 'create-mode', path: '/', prepare: openCreateVideoForm },
  {
    name: 'workspace-preview',
    path: `/projects/${FOOTAGE_SLUG}`,
    prepare: (page) => showVideoFrameAt(page, 12),
  },
  {
    name: 'material-tab',
    path: `/projects/${MATERIAL_SLUG}`,
    prepare: async (page) => {
      await openProducerMaterialTab(page);
      await showVideoFrameAt(page, 6);
    },
  },
  {
    name: 'proposal-card',
    path: `/projects/${PROPOSAL_SLUG}`,
    routes: mockPendingUpload,
    prepare: (page) => showVideoFrameAt(page, 20),
  },
  { name: 'settings-openrouter', path: '/settings?tab=producer', routes: mockOpenRouterEngineChosen },
  { name: 'motion-brief', path: `/projects/${MOTION_SLUG}/motion` },
  {
    name: 'motion-video',
    path: `/projects/${MOTION_SLUG}/motion`,
    prepare: async (page) => {
      await showVideoFrameAt(page, 5);
      await scrollShellContent(page, 'video');
    },
  },
  { name: 'motion-adjust-chat', path: `/projects/${MOTION_CHAT_SLUG}` },
];

async function captureScreen(browser, options, screen) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    colorScheme: options.theme,
    locale: 'es-AR',
    reducedMotion: 'reduce',
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await screen.routes?.(page);
  await page.goto(`${options.studioUrl}${screen.path}`, { waitUntil: 'networkidle' });
  await settle(page);
  await screen.prepare?.(page);
  const fileName = `${screen.name}.png`;
  await page.screenshot({ path: join(options.outDir, fileName) });
  await context.close();
  log(`wrote ${fileName}`);
}

async function main() {
  const options = captureOptions();
  await mkdir(options.outDir, { recursive: true });
  const browser = await loadChromium().launch();
  try {
    for (const screen of SCREENS) {
      if (options.only.length === 0 || options.only.includes(screen.name)) {
        await captureScreen(browser, options, screen);
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  process.stderr.write(`\ncapture-studio-screenshots failed: ${error.message}\n`);
  process.exit(1);
});
