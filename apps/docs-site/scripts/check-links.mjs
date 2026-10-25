import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { DOWNLOAD_URL, LOCALES, LOCALE_PATH_PREFIX, SITE_URL, STABLE_DMG_FILE_NAME } from '../src/site-config.mjs';

const DOCS_SITE_ROOT = resolve(import.meta.dirname, '..');
const REPO_ROOT = resolve(DOCS_SITE_ROOT, '..', '..');
const DIST_DIR = join(REPO_ROOT, 'dist', 'apps', 'docs-site');

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const EXPECTED_DOWNLOAD_URL_PATTERN = new RegExp(`^${escapeRegExp(SITE_URL)}/descargas/[^/]+$`);

function log(message) {
  process.stdout.write(`[check-links] ${message}\n`);
}

function listHtmlFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const entryPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listHtmlFiles(entryPath));
    } else if (entry.name.endsWith('.html')) {
      files.push(entryPath);
    }
  }
  return files;
}

export function extractReferences(html) {
  const references = [];
  const attributePattern = /(?:href|src)="([^"]+)"/g;
  let match = attributePattern.exec(html);
  while (match !== null) {
    references.push(match[1]);
    match = attributePattern.exec(html);
  }
  return references;
}

export function classifyReference(reference) {
  if (/^https?:\/\//.test(reference)) {
    return 'external';
  }
  if (/^(mailto|data|tel):/.test(reference)) {
    return 'non-navigable';
  }
  if (reference.startsWith('#')) {
    return 'fragment';
  }
  return 'internal';
}

function resolveInternalReference(reference, htmlFileDir) {
  const withoutFragment = reference.split('#')[0];
  const resolved = resolve(htmlFileDir, withoutFragment);
  if (existsSync(resolved) && statSync(resolved).isDirectory()) {
    return join(resolved, 'index.html');
  }
  return resolved;
}

export function extractAlternates(html) {
  const alternates = [];
  const linkPattern = /<link rel="alternate" hreflang="([^"]+)" href="([^"]+)" \/>/g;
  let match = linkPattern.exec(html);
  while (match !== null) {
    alternates.push({ hreflang: match[1], href: match[2] });
    match = linkPattern.exec(html);
  }
  return alternates;
}

export function extractHtmlLang(html) {
  const match = /<html lang="([^"]+)"/.exec(html);
  return match === null ? null : match[1];
}

export function sitePathForAbsoluteUrl(url) {
  if (!url.startsWith(`${SITE_URL}/`)) {
    return null;
  }
  return url.slice(SITE_URL.length + 1);
}

export function localeForSitePath(sitePath) {
  const prefixed = LOCALES.find((locale) => LOCALE_PATH_PREFIX[locale] !== '' && sitePath.startsWith(LOCALE_PATH_PREFIX[locale]));
  return prefixed ?? LOCALES.find((locale) => LOCALE_PATH_PREFIX[locale] === '');
}

function htmlFileForSitePath(distDir, sitePath) {
  return join(distDir, sitePath, 'index.html');
}

export function checkLocaleAlternates(distDir, htmlFiles) {
  const problems = [];
  for (const htmlFile of htmlFiles) {
    const html = readFileSync(htmlFile, 'utf8');
    const ownSitePath = dirname(htmlFile).slice(distDir.length + 1);
    const ownPath = ownSitePath === '' ? '' : `${ownSitePath}/`;
    const expectedLang = localeForSitePath(ownPath);
    if (extractHtmlLang(html) !== expectedLang) {
      problems.push(`${ownPath || '/'}: <html lang> is ${extractHtmlLang(html)}, expected ${expectedLang}`);
    }
    const alternates = extractAlternates(html);
    for (const locale of [...LOCALES, 'x-default']) {
      const alternate = alternates.find((candidate) => candidate.hreflang === locale);
      if (alternate === undefined) {
        problems.push(`${ownPath || '/'}: missing hreflang="${locale}"`);
        continue;
      }
      const targetPath = sitePathForAbsoluteUrl(alternate.href);
      if (targetPath === null || !existsSync(htmlFileForSitePath(distDir, targetPath))) {
        problems.push(`${ownPath || '/'}: hreflang="${locale}" points to a page that was not built (${alternate.href})`);
        continue;
      }
      if (locale !== 'x-default' && localeForSitePath(targetPath) !== locale) {
        problems.push(`${ownPath || '/'}: hreflang="${locale}" points to a ${localeForSitePath(targetPath)} page`);
      }
      const reciprocal = extractAlternates(readFileSync(htmlFileForSitePath(distDir, targetPath), 'utf8'));
      if (!reciprocal.some((candidate) => sitePathForAbsoluteUrl(candidate.href) === ownPath)) {
        problems.push(`${ownPath || '/'}: ${targetPath} does not link back with hreflang`);
      }
    }
  }
  return problems;
}

async function headStatus(url) {
  try {
    const response = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    if (response.status === 405 || response.status === 501) {
      const getResponse = await fetch(url, { method: 'GET', redirect: 'follow' });
      return getResponse.status;
    }
    return response.status;
  } catch (error) {
    return `network error: ${error.message}`;
  }
}

export async function checkBuiltSite(distDir) {
  const htmlFiles = listHtmlFiles(distDir);
  const brokenInternal = [];
  const externalResults = [];
  const seenExternalUrls = new Set();
  let downloadUrlFound = false;

  for (const htmlFile of htmlFiles) {
    const html = readFileSync(htmlFile, 'utf8');
    const htmlFileDir = dirname(htmlFile);

    for (const reference of extractReferences(html)) {
      const kind = classifyReference(reference);

      if (kind === 'fragment' || kind === 'non-navigable') {
        continue;
      }

      if (kind === 'internal') {
        const resolved = resolveInternalReference(reference, htmlFileDir);
        if (!existsSync(resolved)) {
          brokenInternal.push({ htmlFile, reference, resolved });
        }
        continue;
      }

      if (reference === DOWNLOAD_URL) {
        downloadUrlFound = true;
      }
      if (!seenExternalUrls.has(reference)) {
        seenExternalUrls.add(reference);
        externalResults.push({ url: reference, status: await headStatus(reference) });
      }
    }
  }

  const localeProblems = checkLocaleAlternates(distDir, htmlFiles);
  const downloadUrlShapeOk = EXPECTED_DOWNLOAD_URL_PATTERN.test(DOWNLOAD_URL) && DOWNLOAD_URL.endsWith(STABLE_DMG_FILE_NAME);

  return {
    htmlFileCount: htmlFiles.length,
    brokenInternal,
    externalResults,
    downloadUrlFound,
    downloadUrlShapeOk,
    localeProblems,
  };
}

async function main() {
  const report = await checkBuiltSite(DIST_DIR);

  log(`scanned ${report.htmlFileCount} HTML files under ${DIST_DIR}`);
  log(`internal links/assets broken: ${report.brokenInternal.length}`);
  for (const broken of report.brokenInternal) {
    log(`  BROKEN: ${broken.reference} (in ${broken.htmlFile}, resolved to ${broken.resolved})`);
  }

  log(`external links found: ${report.externalResults.length}`);
  for (const result of report.externalResults) {
    log(`  ${result.status} — ${result.url}`);
  }

  log(`download URL present in the built site: ${report.downloadUrlFound}`);
  log(`download URL has the expected shape: ${report.downloadUrlShapeOk} (${DOWNLOAD_URL})`);

  log(`hreflang / lang problems: ${report.localeProblems.length}`);
  for (const problem of report.localeProblems) {
    log(`  LOCALE: ${problem}`);
  }

  if (report.brokenInternal.length > 0 || report.localeProblems.length > 0 || !report.downloadUrlFound || !report.downloadUrlShapeOk) {
    process.exitCode = 1;
  }
}

const isDirectRun = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main();
}
