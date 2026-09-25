import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { readdir } from 'node:fs/promises';

import { NAV_PAGES } from '../src/site-config.mjs';
import { startStaticServer } from './serve-dist.mjs';

const DOCS_SITE_ROOT = resolve(import.meta.dirname, '..');
const REPO_ROOT = resolve(DOCS_SITE_ROOT, '..', '..');
const DIST_DIR = join(REPO_ROOT, 'dist', 'apps', 'docs-site');
const ARTIFACTS_DIR = join(
  REPO_ROOT,
  'sdd/specs/spec-e-burgos-017-desktop-app/cycles/cycle-06/artifacts',
);

const VIEWPORTS = [
  { width: 1440, height: 900, tag: '1440x900' },
  { width: 390, height: 844, tag: '390x844' },
];

function log(message) {
  process.stdout.write(`[capture-screenshots] ${message}\n`);
}

function slugForFileName(slug) {
  return slug === '' ? 'inicio' : slug;
}

async function candidatePlaywrightModules() {
  const modules = [];
  try {
    modules.push(await import('playwright'));
  } catch {
    modules.push();
  }

  const npxRoot = join(homedir(), '.npm', '_npx');
  let entries = [];
  try {
    entries = await readdir(npxRoot);
  } catch {
    entries = [];
  }

  for (const entry of entries) {
    const candidate = join(npxRoot, entry, 'node_modules', 'playwright', 'index.mjs');
    try {
      modules.push(await import(candidate));
    } catch {
      modules.push();
    }
  }

  return modules.filter((candidateModule) => candidateModule !== undefined);
}

async function launchChromiumFromAnyInstalledPlaywright() {
  const candidates = await candidatePlaywrightModules();
  if (candidates.length === 0) {
    throw new Error('playwright not found. Run `npx playwright install` once on this machine.');
  }

  let lastError;
  for (const candidate of candidates) {
    try {
      return await candidate.chromium.launch();
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(`no cached playwright install has its chromium browser downloaded: ${lastError?.message}`);
}

async function main() {
  const { url, close } = await startStaticServer(DIST_DIR);
  log(`serving ${DIST_DIR} at ${url}`);

  const browser = await launchChromiumFromAnyInstalledPlaywright();
  try {
    for (const page of NAV_PAGES) {
      const pagePath = page.slug === '' ? '/' : `/${page.slug}/`;
      for (const viewport of VIEWPORTS) {
        const browserPage = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
        await browserPage.goto(`${url}${pagePath}`, { waitUntil: 'networkidle' });
        const fileName = `site-${slugForFileName(page.slug)}-${viewport.tag}.png`;
        const outputPath = join(ARTIFACTS_DIR, fileName);
        await browserPage.screenshot({ path: outputPath, fullPage: true });
        log(`wrote ${fileName}`);
        await browserPage.close();
      }
    }
  } finally {
    await browser.close();
    await close();
  }
}

main().catch((error) => {
  process.stderr.write(`\ncapture-screenshots failed: ${error.message}\n`);
  process.exit(1);
});
