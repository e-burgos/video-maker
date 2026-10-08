import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import displayads from '../../assets/brands/displayads/brand.json';
import { parseBrandManifest } from './brand-manifest';
import type { BrandManifest } from './brand-manifest';
import { brandCss, effectiveBrandTokens, parseCssTokens } from './brand-css';
import { deriveBrandTokens } from './derive-brand-tokens';

const displayAdsCss = readFileSync(join(__dirname, '../../assets/brands/displayads/brand.css'), 'utf8');
const brand: BrandManifest = parseBrandManifest(displayads);
const palette = { background: '#09090b', accent: '#0ea5e9', accent2: '#14b8a6', text: '#fafafa' };
const COLOR = /^(#[0-9a-f]{6}|rgba\(\d{1,3}, \d{1,3}, \d{1,3}, [\d.]+\))$/u;

describe('deriveBrandTokens', () => {
  it('produces every variable the DisplayAds stylesheet declares', () => {
    const derived = deriveBrandTokens(palette, { display: 'Outfit', body: 'Geist', mono: 'Geist Mono' });
    expect(Object.keys(derived).sort()).toEqual(Object.keys(parseCssTokens(displayAdsCss)).sort());
  });

  it('reproduces the DisplayAds fonts and flat colors exactly', () => {
    const derived = deriveBrandTokens(palette, { display: 'Outfit', body: 'Geist', mono: 'Geist Mono' });
    const authored = parseCssTokens(displayAdsCss);
    for (const name of ['--mg-bg', '--mg-accent', '--mg-text', '--mg-radius', '--mg-glow-a', '--mg-glow-b', '--mg-accent-soft', '--mg-accent-shadow', '--mg-font-display', '--mg-font-body', '--mg-font-mono', '--mg-tone-warm']) {
      expect(derived[name]).toBe(authored[name]);
    }
  });

  it('emits valid colors for the single-color variables', () => {
    const derived = deriveBrandTokens(palette);
    for (const name of ['--mg-bg', '--mg-accent', '--mg-accent-2', '--mg-text', '--mg-text-2', '--mg-text-3', '--mg-surface', '--mg-surface-glass', '--mg-flash', '--mg-accent-line']) {
      expect(derived[name]).toMatch(COLOR);
    }
  });

  it('keeps the text readable on the background', () => {
    const derived = deriveBrandTokens(palette);
    expect(derived['--mg-text-2']).not.toBe(derived['--mg-bg']);
    expect(derived['--mg-surface']).not.toBe(derived['--mg-bg']);
  });

  it('is deterministic', () => {
    expect(deriveBrandTokens(palette)).toEqual(deriveBrandTokens({ ...palette }));
  });
});

describe('brandCss', () => {
  const paletteOnly: BrandManifest = { ...brand, css: undefined, palette, tokens: { '--mg-radius': '12px' } };

  it('derives the stylesheet from the palette and lets the tokens win', () => {
    const css = brandCss(paletteOnly);
    expect(parseCssTokens(css)['--mg-radius']).toBe('12px');
    expect(css.lastIndexOf('--mg-radius')).toBeGreaterThan(css.indexOf('--mg-accent:'));
    expect(parseCssTokens(css)['--mg-accent']).toBe('#0ea5e9');
  });

  it('uses the authored stylesheet as is when the brand has no tokens', () => {
    expect(brandCss(brand, displayAdsCss)).toBe(displayAdsCss);
  });

  it('appends the tokens after an authored stylesheet', () => {
    const css = brandCss({ ...brand, tokens: { '--mg-accent': '#ff0000' } }, displayAdsCss);
    expect(parseCssTokens(css)['--mg-accent']).toBe('#ff0000');
  });

  it('exposes the effective variables of authored and derived brands', () => {
    expect(effectiveBrandTokens(brand, displayAdsCss)['--mg-bg']).toBe('#09090b');
    expect(effectiveBrandTokens(paletteOnly)['--mg-radius']).toBe('12px');
  });
});
