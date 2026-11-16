import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseBrandManifest } from '@video-maker/motion-graphics';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(__dirname, '..', '..', '..');
const BUILT_IN_BRANDS_DIR = join(REPO_ROOT, 'libs', 'motion-graphics', 'assets', 'brands');
const LOCAL_BRANDS_DIR = join(REPO_ROOT, 'brands');

function brandManifestsIn(directory: string): string[] {
  if (!existsSync(directory)) {
    return [];
  }
  return readdirSync(directory)
    .filter((entry) => !entry.startsWith('.'))
    .map((entry) => join(directory, entry, 'brand.json'))
    .filter((file) => existsSync(file));
}

const brandFiles = [...brandManifestsIn(BUILT_IN_BRANDS_DIR), ...brandManifestsIn(LOCAL_BRANDS_DIR)];

describe('BrandManifestSchema against the real brands', () => {
  it('finds the built-in brands even where the local brands/ folder is not checked out', () => {
    expect(brandManifestsIn(BUILT_IN_BRANDS_DIR).length).toBeGreaterThan(0);
  });

  it.each(brandFiles)('accepts %s', (file) => {
    expect(() => parseBrandManifest(JSON.parse(readFileSync(file, 'utf8')))).not.toThrow();
  });
});
