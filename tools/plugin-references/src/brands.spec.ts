import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseBrandManifest } from '@video-maker/motion-graphics';
import { describe, expect, it } from 'vitest';

const BRANDS_DIR = join(__dirname, '..', '..', '..', 'brands');

const brandFiles = readdirSync(BRANDS_DIR)
  .filter((entry) => !entry.startsWith('.'))
  .map((entry) => join(BRANDS_DIR, entry, 'brand.json'))
  .filter((file) => existsSync(file));

describe('BrandManifestSchema against the real brands/', () => {
  it('finds brands to check', () => {
    expect(brandFiles.length).toBeGreaterThan(0);
  });

  it.each(brandFiles)('accepts %s', (file) => {
    expect(() => parseBrandManifest(JSON.parse(readFileSync(file, 'utf8')))).not.toThrow();
  });
});
