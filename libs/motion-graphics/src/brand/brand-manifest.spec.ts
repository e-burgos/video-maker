import { describe, expect, it } from 'vitest';

import displayads from '../../assets/brands/displayads/brand.json';
import { parseBrandManifest } from './brand-manifest';

describe('parseBrandManifest', () => {
  it('accepts the shipped DisplayAds manifest', () => {
    const brand = parseBrandManifest(displayads);
    expect(brand.devices['counter-15']?.screen?.polygon).toHaveLength(4);
    expect(brand.music.map((m) => m.bpm)).toEqual([122, 110]);
  });

  it('marks the retired device, the device that needs a light plate and describes every scene photo', () => {
    const brand = parseBrandManifest(displayads);
    expect(brand.devices['core-pro']?.retired).toBe(true);
    expect(brand.devices['easy-pro']).toMatchObject({ kind: 'box', plate: true });
    for (const [key, image] of Object.entries(brand.images)) expect(typeof image === 'string' ? key : image.caption.length > 0).toBe(true);
  });

  it('rejects an invalid manifest with the failing field', () => {
    expect(() => parseBrandManifest({ ...displayads, music: [{ id: 'x' }] })).toThrow(/BRAND_INVALID|music\[0\]/u);
  });

  it('requires css or palette', () => {
    const bare = Object.fromEntries(Object.entries(displayads).filter(([key]) => key !== 'css' && key !== 'palette'));
    expect(() => parseBrandManifest(bare)).toThrow(/"css" or "palette"/u);
    expect(parseBrandManifest({ ...bare, palette: displayads.palette }).css).toBeUndefined();
  });

  it('accepts a brand with no music, no photos, no devices and no isotipo', () => {
    const withoutIsotipo = Object.fromEntries(Object.entries(displayads).filter(([key]) => key !== 'isotipo'));
    const brand = parseBrandManifest({ ...withoutIsotipo, music: [], images: {}, devices: {} });
    expect(brand.music).toEqual([]);
  });

  it('rejects token names outside --mg-*, bad palette colors and typography families without a font', () => {
    expect(() => parseBrandManifest({ ...displayads, tokens: { '--other': '#fff' } })).toThrow(/invalid/u);
    expect(() => parseBrandManifest({ ...displayads, palette: { ...displayads.palette, accent: 'blue' } })).toThrow(/invalid/u);
    expect(() => parseBrandManifest({ ...displayads, typography: { display: 'Nope', body: 'Geist' } })).toThrow(/Nope/u);
  });
});
