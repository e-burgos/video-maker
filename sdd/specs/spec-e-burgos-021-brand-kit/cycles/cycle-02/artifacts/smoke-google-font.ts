import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { addGoogleFont } from '../../../../../../apps/render-api/src/brands/brand-fonts';
import { createBrand } from '../../../../../../apps/render-api/src/brands/brand-library';
import { readStoreConfig } from '../../../../../../apps/render-api/src/config/store-config';
import { createNodeRenderApiDependencies } from '../../../../../../apps/render-api/src/deps/node-render-api-dependencies';

async function main(): Promise<void> {
  const [brandsRoot, family] = process.argv.slice(2);
  if (brandsRoot === undefined || family === undefined) throw new Error('usage: smoke-google-font.ts <brandsRoot> <family>');
  const env = { ...process.env, BRANDS_ROOT: brandsRoot };
  const store = readStoreConfig(env, process.cwd());
  const deps = createNodeRenderApiDependencies(env, store);
  await createBrand(deps, store, { name: 'Smoke Fonts', id: 'smoke-fonts' });
  const detail = await addGoogleFont(deps, store, 'smoke-fonts', family);
  const report = [];
  for (const font of detail.manifest.fonts.filter((candidate) => candidate.family === family)) {
    const bytes = await readFile(join(brandsRoot, 'smoke-fonts', font.file));
    report.push({ ...font, bytes: bytes.length, magic: Buffer.from(bytes.subarray(0, 4)).toString('latin1') });
  }
  process.stdout.write(`${JSON.stringify({ fontFiles: detail.files.fonts, report }, null, 2)}\n`);
}

void main();
