import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { SITE_URL } from '../src/site-config.mjs';
import {
  checkLocaleAlternates,
  classifyReference,
  extractAlternates,
  extractHtmlLang,
  localeForSitePath,
  sitePathForAbsoluteUrl,
} from './check-links.mjs';

function pageHtml(lang, alternates) {
  const links = alternates.map(([hreflang, path]) => `<link rel="alternate" hreflang="${hreflang}" href="${SITE_URL}/${path}" />`).join('\n');
  return `<!doctype html>\n<html lang="${lang}">\n<head>\n${links}\n</head></html>`;
}

const temporaryDirectories = [];

function writeSite(pages) {
  const distDir = mkdtempSync(join(tmpdir(), 'docs-site-check-'));
  temporaryDirectories.push(distDir);
  const files = [];
  for (const [path, html] of Object.entries(pages)) {
    mkdirSync(join(distDir, path), { recursive: true });
    const file = join(distDir, path, 'index.html');
    writeFileSync(file, html);
    files.push(file);
  }
  return { distDir, files };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('check-links helpers', () => {
  it('skips mail, data and tel references', () => {
    expect(classifyReference('mailto:someone@example.test')).toBe('non-navigable');
    expect(classifyReference('data:image/svg+xml,abc')).toBe('non-navigable');
    expect(classifyReference('https://example.test')).toBe('external');
    expect(classifyReference('#top')).toBe('fragment');
    expect(classifyReference('../assets/style.css')).toBe('internal');
  });

  it('reads lang and alternates from a page and maps site URLs to locales', () => {
    const html = pageHtml('en', [['es', 'faq-es/'], ['en', 'en/faq/']]);
    expect(extractHtmlLang(html)).toBe('en');
    expect(extractAlternates(html)).toEqual([
      { hreflang: 'es', href: `${SITE_URL}/faq-es/` },
      { hreflang: 'en', href: `${SITE_URL}/en/faq/` },
    ]);
    expect(sitePathForAbsoluteUrl(`${SITE_URL}/en/faq/`)).toBe('en/faq/');
    expect(sitePathForAbsoluteUrl('https://elsewhere.test/en/')).toBeNull();
    expect(localeForSitePath('en/faq/')).toBe('en');
    expect(localeForSitePath('preguntas-frecuentes/')).toBe('es');
  });

  it('accepts a reciprocal pair of pages', () => {
    const alternates = [['es', ''], ['en', 'en/'], ['x-default', '']];
    const { distDir, files } = writeSite({ '': pageHtml('es', alternates), en: pageHtml('en', alternates) });
    expect(checkLocaleAlternates(distDir, files)).toEqual([]);
  });

  it('reports a wrong lang, a missing translation and a page that does not link back', () => {
    const { distDir, files } = writeSite({
      '': pageHtml('en', [['es', ''], ['en', 'en/missing/'], ['x-default', '']]),
      privacidad: pageHtml('es', [['es', 'privacidad/'], ['en', 'en/'], ['x-default', 'privacidad/']]),
      en: pageHtml('en', [['es', ''], ['en', 'en/'], ['x-default', '']]),
    });
    const problems = checkLocaleAlternates(distDir, files).join('\n');
    expect(problems).toContain('<html lang> is en, expected es');
    expect(problems).toContain('points to a page that was not built');
    expect(problems).toContain('en/ does not link back');
  });
});
