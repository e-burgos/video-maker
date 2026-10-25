import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { PAGE_RENDERERS, renderSitePage } from '../scripts/build.mjs';
import { LOCALES, PAGES, REPO_URL, SITE_URL } from './site-config.mjs';
import { UI_STRINGS, t } from './i18n.mjs';
import { allPageContexts, createPageContext, pagePath } from './routes.mjs';
import { CLIENT_SCRIPT_FILES, buildRobotsTxt, buildSitemapXml, rewriteClientImports } from './site-files.mjs';
import { headBootstrapScript } from './render.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..');
const NOTICES = readFileSync(join(REPO_ROOT, 'apps/desktop/vendor/THIRD_PARTY_NOTICES.md'), 'utf8');

function render(locale, pageId) {
  return renderSitePage(createPageContext(locale, pageId), NOTICES);
}

function countOf(html, pattern) {
  return (html.match(pattern) ?? []).length;
}

const STRUCTURE_PATTERNS = {
  h1: /<h1[\s>]/g,
  h2: /<h2[\s>]/g,
  figures: /<figure[\s>]/g,
  tables: /<table[\s>]/g,
  faqItems: /<details[\s>]/g,
  steps: /data-step[\s>]/g,
  techCards: /class="tech-card /g,
};

describe('i18n parity', () => {
  it('defines exactly the same UI keys in every locale', () => {
    const [reference, ...others] = LOCALES.map((locale) => Object.keys(UI_STRINGS[locale]).sort());
    for (const keys of others) {
      expect(keys).toEqual(reference);
    }
  });

  it('has a nav label in every locale for every page and a renderer for every page', () => {
    for (const page of PAGES) {
      expect(PAGE_RENDERERS[page.id], page.id).toBeTypeOf('function');
      for (const locale of LOCALES) {
        expect(t(locale, `nav.${page.id}`).length).toBeGreaterThan(0);
        expect(page.slugs[locale], `${page.id}/${locale}`).toBeTypeOf('string');
      }
    }
  });

  it('interpolates variables and fails loudly on a missing key', () => {
    expect(t('es', 'stepper.goTo', { current: 3 })).toBe('Ir al paso 3');
    expect(() => t('en', 'nope')).toThrow(/missing UI string/);
  });

  it('renders every page with the same structure in Spanish and English', () => {
    for (const page of PAGES) {
      const [spanish, english] = LOCALES.map((locale) => render(locale, page.id));
      for (const [name, pattern] of Object.entries(STRUCTURE_PATTERNS)) {
        expect(countOf(english, pattern), `${page.id}: ${name}`).toBe(countOf(spanish, pattern));
      }
    }
  });
});

describe('page shell', () => {
  it('marks the language, canonical and hreflang alternates of every page', () => {
    for (const ctx of allPageContexts()) {
      const html = renderSitePage(ctx, NOTICES);
      expect(html).toContain(`<html lang="${ctx.locale}"`);
      expect(html).toContain(`<link rel="canonical" href="${SITE_URL}/${ctx.path}" />`);
      for (const locale of LOCALES) {
        expect(html).toContain(`<link rel="alternate" hreflang="${locale}" href="${SITE_URL}/${pagePath(locale, ctx.pageId)}" />`);
      }
      expect(html).toContain('hreflang="x-default"');
      expect(html).toContain('property="og:image"');
      expect(countOf(html, /<h1[\s>]/g), `${ctx.path} has one h1`).toBe(1);
      expect(html).not.toMatch(/="undefined"|>[^<]*\bundefined\b[^<]*<\/(?!script)|\[object Object\]/);
    }
  });

  it('links the language switch to the same page in the other locale', () => {
    const html = render('es', 'using-studio');
    expect(html).toContain('href="../en/using-the-studio/" hreflang="en" lang="en" data-locale-switch="en"');
    const english = render('en', 'using-studio');
    expect(english).toContain('href="../../usar-el-estudio/" hreflang="es" lang="es" data-locale-switch="es"');
  });

  it('shows the repository in the header, hero and footer', () => {
    const home = render('es', 'home');
    const header = home.slice(home.indexOf('<header'), home.indexOf('</header>'));
    const hero = home.slice(home.indexOf('class="hero"'), home.indexOf('</section>'));
    const footer = home.slice(home.indexOf('<footer'));
    for (const region of [header, hero, footer]) {
      expect(region).toContain(`href="${REPO_URL}"`);
    }
    expect(footer).toContain(`${REPO_URL}/blob/main/LICENSE`);
  });

  it('keeps every interactive control usable without JavaScript', () => {
    for (const locale of LOCALES) {
      const html = render(locale, 'how-it-works');
      expect(html).toMatch(/role="tablist"[^>]*hidden/);
      expect(countOf(html, /data-stepper-controls hidden/g)).toBe(2);
      expect(countOf(html, /<li class="walkthrough__step" data-step /g)).toBe(9);
      expect(html).not.toMatch(/<li class="walkthrough__step"[^>]*hidden/);
      expect(html).toMatch(/data-theme-toggle hidden/);
    }
  });

  it('does not publish local paths or obvious secrets', () => {
    for (const ctx of allPageContexts()) {
      const html = renderSitePage(ctx, NOTICES);
      expect(html).not.toMatch(/\/Users\/|\/home\/|sk-or-|sk-ant-|BEGIN [A-Z ]*PRIVATE KEY/);
    }
  });

  it('inlines the same theme and locale logic the client tests cover', () => {
    const script = headBootstrapScript();
    expect(script).toContain('function resolveEffectiveTheme');
    expect(script).toContain('function localeRedirectTarget');
    expect(() => new Function(script)).not.toThrow();
  });
});

describe('site files', () => {
  it('lists every page of every locale with its alternates in the sitemap', () => {
    const sitemap = buildSitemapXml();
    expect(countOf(sitemap, /<url>/g)).toBe(PAGES.length * LOCALES.length);
    expect(countOf(sitemap, /<xhtml:link /g)).toBe(PAGES.length * LOCALES.length * (LOCALES.length + 1));
    expect(sitemap).toContain(`<loc>${SITE_URL}/en/open-source/</loc>`);
    expect(buildRobotsTxt()).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);
  });

  it('rewrites client module imports to the published .js names', () => {
    expect(rewriteClientImports("import { a } from './site-logic.mjs';")).toBe("import { a } from './site-logic.js';");
    for (const fileName of CLIENT_SCRIPT_FILES) {
      const source = readFileSync(join(import.meta.dirname, 'client', fileName), 'utf8');
      expect(rewriteClientImports(source)).not.toContain('.mjs');
    }
  });
});
