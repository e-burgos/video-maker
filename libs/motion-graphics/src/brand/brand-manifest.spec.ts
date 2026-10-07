import { describe, expect, it } from 'vitest';

import displayads from '../../assets/brands/displayads/brand.json';
import { parseBrandManifest } from './brand-manifest';

describe('parseBrandManifest', () => {
  it('accepts the shipped DisplayAds manifest', () => {
    const brand = parseBrandManifest(displayads);
    expect(brand.devices['counter-15']?.screen?.polygon).toHaveLength(4);
    expect(brand.music.map((m) => m.bpm)).toEqual([122, 110]);
  });

  it('rejects an invalid manifest with the failing field', () => {
    expect(() => parseBrandManifest({ ...displayads, music: [{ id: 'x' }] })).toThrow(/BRAND_INVALID|music\[0\]/u);
  });
});
