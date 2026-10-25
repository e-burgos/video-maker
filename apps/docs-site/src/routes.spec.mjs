import { describe, expect, it } from 'vitest';

import { PAGES, SITE_URL } from './site-config.mjs';
import {
  allPageContexts,
  alternateLinks,
  assetHref,
  canonicalUrl,
  createPageContext,
  depthOfPath,
  otherLocale,
  pageHref,
  pagePath,
  relativePrefix,
} from './routes.mjs';

describe('routes', () => {
  it('keeps the Spanish routes that were already published and puts English under /en/', () => {
    expect(pagePath('es', 'home')).toBe('');
    expect(pagePath('es', 'installation')).toBe('instalacion/');
    expect(pagePath('es', 'privacy')).toBe('privacidad/');
    expect(pagePath('en', 'home')).toBe('en/');
    expect(pagePath('en', 'installation')).toBe('en/installation/');
  });

  it('computes depth and relative prefixes from the path', () => {
    expect(depthOfPath('')).toBe(0);
    expect(depthOfPath('en/')).toBe(1);
    expect(depthOfPath('en/faq/')).toBe(2);
    expect(relativePrefix(0)).toBe('./');
    expect(relativePrefix(2)).toBe('../../');
  });

  it('builds relative hrefs between any two pages and to assets', () => {
    const englishFaq = createPageContext('en', 'faq');
    expect(pageHref(englishFaq, 'installation')).toBe('../../en/installation/');
    expect(pageHref(englishFaq, 'faq', 'es')).toBe('../../preguntas-frecuentes/');
    expect(assetHref(englishFaq, 'assets/style.css')).toBe('../../assets/style.css');
    expect(pageHref(createPageContext('es', 'home'), 'technology')).toBe('./tecnologia/');
  });

  it('declares one alternate per locale plus x-default pointing to Spanish', () => {
    expect(alternateLinks('technology')).toEqual([
      { hreflang: 'es', href: `${SITE_URL}/tecnologia/` },
      { hreflang: 'en', href: `${SITE_URL}/en/technology/` },
      { hreflang: 'x-default', href: `${SITE_URL}/tecnologia/` },
    ]);
    expect(canonicalUrl('en', 'home')).toBe(`${SITE_URL}/en/`);
  });

  it('produces a unique path for every page in every locale', () => {
    const paths = allPageContexts().map((ctx) => ctx.path);
    expect(paths).toHaveLength(PAGES.length * 2);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('switches to the other locale and rejects unknown ids', () => {
    expect(otherLocale('es')).toBe('en');
    expect(otherLocale('en')).toBe('es');
    expect(() => pagePath('fr', 'home')).toThrow(/unknown locale/);
    expect(() => pagePath('es', 'blog')).toThrow(/unknown page id/);
  });
});
