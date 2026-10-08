import { createBrand } from '../../../../../../apps/render-api/src/brands/brand-library';
import { readStoreConfig } from '../../../../../../apps/render-api/src/config/store-config';
import { createNodeRenderApiDependencies } from '../../../../../../apps/render-api/src/deps/node-render-api-dependencies';

async function main(): Promise<void> {
  const [brandsRoot, name, duplicateFrom, id] = process.argv.slice(2);
  if (brandsRoot === undefined || name === undefined) throw new Error('usage: duplicate-brand.ts <brandsRoot> <name> [duplicateFrom] [id]');
  const env = { ...process.env, BRANDS_ROOT: brandsRoot };
  const store = readStoreConfig(env, process.cwd());
  const deps = createNodeRenderApiDependencies(env, store);
  const created = await createBrand(deps, store, { name, ...(duplicateFrom === undefined ? {} : { duplicateFrom }), ...(id === undefined ? {} : { id }) });
  process.stdout.write(`${JSON.stringify({ id: created.id, source: created.source, tokens: Object.keys(created.tokens).length, files: created.files })}\n`);
}

void main();
