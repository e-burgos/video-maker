import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { NAV_PAGES } from '../src/site-config.mjs';
import { pageLayout } from '../src/render.mjs';
import { renderPage as renderHome } from '../src/content/home.mjs';
import { renderPage as renderInstallation } from '../src/content/installation.mjs';
import { renderPage as renderFirstRun } from '../src/content/first-run.mjs';
import { renderPage as renderConnectAi } from '../src/content/connect-ai.mjs';
import { renderPage as renderUsingStudio } from '../src/content/using-studio.mjs';
import { renderPage as renderFaq } from '../src/content/faq.mjs';
import { renderPage as renderLicenses } from '../src/content/licenses.mjs';

const DOCS_SITE_ROOT = resolve(import.meta.dirname, '..');
const REPO_ROOT = resolve(DOCS_SITE_ROOT, '..', '..');
const DIST_DIR = join(REPO_ROOT, 'dist', 'apps', 'docs-site');
const THIRD_PARTY_NOTICES_PATH = join(REPO_ROOT, 'apps', 'desktop', 'vendor', 'THIRD_PARTY_NOTICES.md');

const PAGE_RENDERERS = {
  '': renderHome,
  instalacion: renderInstallation,
  'primer-arranque': renderFirstRun,
  'conectar-ia': renderConnectAi,
  'usar-el-estudio': renderUsingStudio,
  'preguntas-frecuentes': renderFaq,
  licencias: renderLicenses,
};

function log(message) {
  process.stdout.write(`[docs-site build] ${message}\n`);
}

function outputPathForSlug(slug) {
  return slug === '' ? join(DIST_DIR, 'index.html') : join(DIST_DIR, slug, 'index.html');
}

function depthForSlug(slug) {
  return slug === '' ? 0 : 1;
}

function renderAllPages() {
  const noticesMarkdown = readFileSync(THIRD_PARTY_NOTICES_PATH, 'utf8');

  for (const page of NAV_PAGES) {
    const renderer = PAGE_RENDERERS[page.slug];
    if (renderer === undefined) {
      throw new Error(`no content module registered for slug "${page.slug}"`);
    }

    const depth = depthForSlug(page.slug);
    const { title, description, bodyHtml } =
      page.slug === 'licencias' ? renderer(depth, noticesMarkdown) : renderer(depth);

    const html = pageLayout({ depth, activeSlug: page.slug, title, description, bodyHtml });
    const outputPath = outputPathForSlug(page.slug);
    mkdirSync(join(outputPath, '..'), { recursive: true });
    writeFileSync(outputPath, html);
    log(`wrote ${outputPath.slice(REPO_ROOT.length + 1)}`);
  }
}

function copyStaticAssets() {
  const assetsDir = join(DIST_DIR, 'assets');
  mkdirSync(assetsDir, { recursive: true });
  cpSync(join(DOCS_SITE_ROOT, 'src', 'styles.css'), join(assetsDir, 'style.css'));
  cpSync(join(DOCS_SITE_ROOT, 'public', 'screenshots'), join(assetsDir, 'screenshots'), { recursive: true });
  log('copied assets/style.css and assets/screenshots/');
}

function main() {
  rmSync(DIST_DIR, { recursive: true, force: true });
  mkdirSync(DIST_DIR, { recursive: true });
  copyStaticAssets();
  renderAllPages();
  log(`done — ${NAV_PAGES.length} pages in ${DIST_DIR.slice(REPO_ROOT.length + 1)}`);
}

main();
