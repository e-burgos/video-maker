import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { pageLayout } from '../src/render.mjs';
import { allPageContexts } from '../src/routes.mjs';
import {
  CLIENT_SCRIPT_FILES,
  buildRobotsTxt,
  buildSitemapXml,
  publishedClientScriptName,
  rewriteClientImports,
} from '../src/site-files.mjs';
import { renderPage as renderHome } from '../src/content/home.mjs';
import { renderPage as renderHowItWorks } from '../src/content/how-it-works.mjs';
import { renderPage as renderTechnology } from '../src/content/technology.mjs';
import { renderPage as renderOpenSource } from '../src/content/open-source.mjs';
import { renderPage as renderInstallation } from '../src/content/installation.mjs';
import { renderPage as renderFirstRun } from '../src/content/first-run.mjs';
import { renderPage as renderConnectAi } from '../src/content/connect-ai.mjs';
import { renderPage as renderUsingStudio } from '../src/content/using-studio.mjs';
import { renderPage as renderFaq } from '../src/content/faq.mjs';
import { renderPage as renderLicenses } from '../src/content/licenses.mjs';
import { renderPage as renderPrivacy } from '../src/content/privacy.mjs';

const DOCS_SITE_ROOT = resolve(import.meta.dirname, '..');
const REPO_ROOT = resolve(DOCS_SITE_ROOT, '..', '..');
const DIST_DIR = join(REPO_ROOT, 'dist', 'apps', 'docs-site');
const THIRD_PARTY_NOTICES_PATH = join(REPO_ROOT, 'apps', 'desktop', 'vendor', 'THIRD_PARTY_NOTICES.md');

export const PAGE_RENDERERS = {
  home: renderHome,
  'how-it-works': renderHowItWorks,
  technology: renderTechnology,
  'open-source': renderOpenSource,
  installation: renderInstallation,
  'first-run': renderFirstRun,
  'connect-ai': renderConnectAi,
  'using-studio': renderUsingStudio,
  faq: renderFaq,
  licenses: renderLicenses,
  privacy: renderPrivacy,
};

function log(message) {
  process.stdout.write(`[docs-site build] ${message}\n`);
}

export function renderSitePage(ctx, noticesMarkdown) {
  const renderer = PAGE_RENDERERS[ctx.pageId];
  if (renderer === undefined) {
    throw new Error(`no content module registered for page "${ctx.pageId}"`);
  }
  const { title, description, bodyHtml } = renderer(ctx, noticesMarkdown);
  return pageLayout({ ctx, title, description, bodyHtml });
}

function renderAllPages(noticesMarkdown) {
  const contexts = allPageContexts();
  for (const ctx of contexts) {
    const outputPath = join(DIST_DIR, ctx.path, 'index.html');
    mkdirSync(join(outputPath, '..'), { recursive: true });
    writeFileSync(outputPath, renderSitePage(ctx, noticesMarkdown));
    log(`wrote ${outputPath.slice(REPO_ROOT.length + 1)}`);
  }
  return contexts.length;
}

function copyClientScripts(jsDir) {
  mkdirSync(jsDir, { recursive: true });
  for (const fileName of CLIENT_SCRIPT_FILES) {
    const source = readFileSync(join(DOCS_SITE_ROOT, 'src', 'client', fileName), 'utf8');
    writeFileSync(join(jsDir, publishedClientScriptName(fileName)), rewriteClientImports(source));
  }
}

function copyStaticAssets() {
  const assetsDir = join(DIST_DIR, 'assets');
  mkdirSync(assetsDir, { recursive: true });
  cpSync(join(DOCS_SITE_ROOT, 'src', 'styles.css'), join(assetsDir, 'style.css'));
  cpSync(join(DOCS_SITE_ROOT, 'public', 'screenshots'), join(assetsDir, 'screenshots'), { recursive: true });
  cpSync(join(DOCS_SITE_ROOT, 'public', 'fonts'), join(assetsDir, 'fonts'), { recursive: true });
  cpSync(join(DOCS_SITE_ROOT, 'public', 'favicon.svg'), join(DIST_DIR, 'favicon.svg'));
  copyClientScripts(join(assetsDir, 'js'));
  writeFileSync(join(DIST_DIR, 'sitemap.xml'), buildSitemapXml());
  writeFileSync(join(DIST_DIR, 'robots.txt'), buildRobotsTxt());
  log('copied styles, screenshots, fonts, favicon and scripts; wrote sitemap.xml and robots.txt');
}

function main() {
  rmSync(DIST_DIR, { recursive: true, force: true });
  mkdirSync(DIST_DIR, { recursive: true });
  copyStaticAssets();
  const pageCount = renderAllPages(readFileSync(THIRD_PARTY_NOTICES_PATH, 'utf8'));
  if (!existsSync(join(DIST_DIR, 'index.html')) || !existsSync(join(DIST_DIR, 'en', 'index.html'))) {
    throw new Error('home pages missing from the build');
  }
  log(`done — ${pageCount} pages in ${DIST_DIR.slice(REPO_ROOT.length + 1)}`);
}

const isDirectRun = process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(import.meta.filename);
if (isDirectRun) {
  main();
}
