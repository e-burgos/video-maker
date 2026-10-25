import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { mkdir, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';

import { LOCALES, PAGES } from '../src/site-config.mjs';
import { pagePath } from '../src/routes.mjs';
import { startStaticServer } from './serve-dist.mjs';

const DOCS_SITE_ROOT = resolve(import.meta.dirname, '..');
const REPO_ROOT = resolve(DOCS_SITE_ROOT, '..', '..');
const DIST_DIR = join(REPO_ROOT, 'dist', 'apps', 'docs-site');
const DEFAULT_ARTIFACTS_DIR = join(
  REPO_ROOT,
  'sdd/specs/spec-e-burgos-024-docs-site-redesign/cycles/cycle-01/artifacts',
);

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};

function log(message) {
  process.stdout.write(`[capture-screenshots] ${message}\n`);
}

function listOption(rawValue, allowed) {
  const values = rawValue.split(',').map((value) => value.trim()).filter((value) => value !== '');
  for (const value of values) {
    if (!allowed.includes(value)) {
      throw new Error(`unknown value "${value}", expected one of ${allowed.join(', ')}`);
    }
  }
  return values;
}

function captureOptions() {
  const { values } = parseArgs({
    options: {
      out: { type: 'string', default: DEFAULT_ARTIFACTS_DIR },
      pages: { type: 'string', default: 'home' },
      locales: { type: 'string', default: LOCALES.join(',') },
      themes: { type: 'string', default: 'light,dark' },
      viewports: { type: 'string', default: Object.keys(VIEWPORTS).join(',') },
      'full-page': { type: 'boolean', default: false },
    },
  });
  return {
    outDir: resolve(values.out),
    pageIds: listOption(values.pages, PAGES.map((page) => page.id)),
    locales: listOption(values.locales, LOCALES),
    themes: listOption(values.themes, ['light', 'dark']),
    viewports: listOption(values.viewports, Object.keys(VIEWPORTS)),
    fullPage: values['full-page'],
  };
}

async function candidatePlaywrightModules() {
  const modules = [];
  try {
    modules.push(await import('playwright'));
  } catch {
    modules.push();
  }
  try {
    modules.push(createRequire(import.meta.url)('playwright'));
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

async function captureOne(browser, baseUrl, options, target) {
  const viewport = VIEWPORTS[target.viewport];
  const context = await browser.newContext({ viewport, colorScheme: target.theme, reducedMotion: 'reduce', deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/${pagePath(target.locale, target.pageId)}`, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    const pause = (milliseconds) => new Promise((done) => setTimeout(done, milliseconds));
    for (let offset = 0; offset < document.documentElement.scrollHeight; offset += window.innerHeight / 2) {
      window.scrollTo(0, offset);
      await pause(60);
    }
    window.scrollTo(0, 0);
    for (const element of document.querySelectorAll('.reveal')) {
      element.classList.add('is-visible');
    }
    await Promise.all(Array.from(document.images, (image) => Promise.race([image.decode().catch(() => null), pause(3000)])));
  });
  await page.waitForTimeout(900);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  const overflowingElements = overflow > 0
    ? await page.evaluate(() =>
        Array.from(document.querySelectorAll('body *'))
          .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1)
          .slice(0, 5)
          .map((element) => `${element.tagName.toLowerCase()}.${element.className}`),
      )
    : [];
  const fileName = `site-${target.pageId}-${target.locale}-${target.theme}-${target.viewport}.png`;
  await page.screenshot({ path: join(options.outDir, fileName), fullPage: options.fullPage });
  await context.close();
  log(`wrote ${fileName} (horizontal overflow: ${overflow}px${overflowingElements.length > 0 ? ` in ${overflowingElements.join(', ')}` : ''})`);
  return { fileName, overflow };
}

async function main() {
  const options = captureOptions();
  await mkdir(options.outDir, { recursive: true });
  const { url, close } = await startStaticServer(DIST_DIR);
  log(`serving ${DIST_DIR} at ${url}`);

  const browser = await launchChromiumFromAnyInstalledPlaywright();
  const results = [];
  try {
    for (const pageId of options.pageIds) {
      for (const locale of options.locales) {
        for (const theme of options.themes) {
          for (const viewport of options.viewports) {
            results.push(await captureOne(browser, url, options, { pageId, locale, theme, viewport }));
          }
        }
      }
    }
  } finally {
    await browser.close();
    await close();
  }
  if (results.some((result) => result.overflow > 0)) {
    process.exitCode = 1;
    log('horizontal overflow detected');
  }
}

main().catch((error) => {
  process.stderr.write(`\ncapture-screenshots failed: ${error.message}\n`);
  process.exit(1);
});
