import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  REPO_ROOT,
  VOICE_ENV_VARS,
  assert,
  loadRootEnv,
  log,
  resolvePlaywright,
  spawnLogged,
  waitForHttp,
} from '../../../../../../apps/web/e2e/smoke-helpers.mjs';

const MEDIA_ROOT = process.env.CAPTURE_MEDIA_ROOT;
const ART = join(
  REPO_ROOT,
  'sdd/specs/spec-e-burgos-015-studio-producer/cycles/cycle-02/artifacts',
);
const PORT = 4396;
const WEB = 4211;
const SLUG = 'demo-01';

await loadRootEnv(VOICE_ENV_VARS);

const api = spawnLogged(
  'render-api',
  'node',
  ['-r', './apps/render-api/src/server-register.cjs', 'apps/render-api/src/main.ts'],
  { ...process.env, RENDER_API_PORT: String(PORT), RENDER_API_MEDIA_ROOT: MEDIA_ROOT, SWC_NODE_PROJECT: 'tsconfig.base.json' },
);
const web = spawnLogged('web', 'pnpm', ['exec', 'vite', '--config', 'apps/web/vite.config.ts'], {
  ...process.env,
  WEB_PORT: String(WEB),
  RENDER_API_URL: `http://127.0.0.1:${PORT}`,
});

let browser;
try {
  await waitForHttp(`http://127.0.0.1:${PORT}/health`, 20000);
  await waitForHttp(`http://localhost:${WEB}/api/projects`, 30000);

  const { chromium } = await resolvePlaywright();
  browser = await chromium.launch({ channel: 'chrome' });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 1400 } })).newPage();

  await page.goto(`http://localhost:${WEB}/projects/${SLUG}/producer`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="producer-message-list"]');
  const tables = await page.locator('[data-testid="producer-message-list"] table').count();
  const pres = await page.locator('[data-testid="producer-message-list"] pre').count();
  const rules = await page.locator('[data-testid="producer-message-list"] hr').count();
  log('markdown', `on the real conversation: ${tables} tables, ${pres} code blocks, ${rules} rules`);
  assert(tables > 0, 'the answer of the producer renders its markdown table as a real table');
  await page.screenshot({ path: join(ART, 'producer-smoke-11-rich-markdown.png'), fullPage: true });
} finally {
  if (browser !== undefined) await browser.close();
  api.kill('SIGTERM');
  web.kill('SIGTERM');
}
