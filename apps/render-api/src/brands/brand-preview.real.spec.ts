import { mkdir, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { StoreConfig } from '../config/store-config';
import { createNodeRenderApiDependencies } from '../deps/node-render-api-dependencies';
import { requestLine } from '../__fixtures__/http-request';
import { handlePostBrandPreview } from '../http/handlers/brands-handler';
import { createRenderApiRuntime } from '../http/render-api-runtime';
import { createBrand } from './brand-library';
import { createBrandPreview } from './brand-preview';

const MOTION_ASSETS = fileURLToPath(new URL('../../../../libs/motion-graphics/assets', import.meta.url));

let root = '';
let store: StoreConfig;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'brand-preview-'));
  await mkdir(join(root, 'media'), { recursive: true });
  store = {
    mediaRoot: join(root, 'media'),
    dbPath: join(root, 'media', '.studio', 'studio.db'),
    maxUploadBytes: 1_000_000,
    objectStore: 'fs',
    motionAssetsRoot: MOTION_ASSETS,
    brandsRoot: join(root, 'brands'),
  };
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('brand preview composed for real', () => {
  it('composes DisplayAds with the real runtime, brand kit and both scenes', async () => {
    const deps = createNodeRenderApiDependencies({}, store);

    const result = await createBrandPreview(deps, store, 'displayads', {});
    const directory = join(store.brandsRoot, '.preview', 'displayads');
    const html = await readFile(join(directory, 'index.html'), 'utf8');

    expect(result).toMatchObject({ url: '/brands/displayads/preview/index.html', durationSec: 9 });
    expect(html).toContain('data-scene="reveal"');
    expect(html).toContain('data-scene="cta"');
    expect(html).toContain('assets/brand/img/logo.svg');
    expect(html).toContain('Tus pantallas, bajo control.');
    expect(html).toContain('mg-brand-tokens');
    expect(html).toContain('#root { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px;');
    expect(html).toContain('function fitStage()');
    expect(html).not.toContain('<audio');
    expect((await stat(join(directory, 'assets/runtime/gsap.min.js'))).isFile()).toBe(true);
    expect((await stat(join(directory, 'assets/runtime/motion-runtime.js'))).isFile()).toBe(true);
    expect((await stat(join(directory, 'assets/brand/img/logo.svg'))).isFile()).toBe(true);
    expect((await stat(join(directory, 'assets/brand/brand.css'))).isFile()).toBe(true);
  });

  it('composes a freshly created user brand into a temporary BRANDS_ROOT', async () => {
    const deps = createNodeRenderApiDependencies({}, store);
    await createBrand(deps, store, { name: 'Árbol Verde' });

    await createBrandPreview(deps, store, 'arbol-verde', { tagline: 'Plantá hoy' });
    const html = await readFile(join(store.brandsRoot, '.preview', 'arbol-verde', 'index.html'), 'utf8');
    const css = await readFile(join(store.brandsRoot, '.preview', 'arbol-verde', 'assets/brand/brand.css'), 'utf8');

    expect(html).toContain('assets/brand/img/logo.svg');
    expect(html).toContain('Plantá hoy');
    expect(css).toContain('--mg-accent');
  });

  it('serializes concurrent previews of the same brand on the real disk so none of them fails', async () => {
    const deps = createNodeRenderApiDependencies({}, store);
    const runtime = createRenderApiRuntime(deps);
    const post = () =>
      handlePostBrandPreview(deps, store, runtime, { id: 'displayads' }, requestLine({ method: 'POST', path: '/brands/displayads/preview' }));

    const responses = await Promise.all([post(), post(), post()]);

    expect(responses.map((response) => response.status)).toEqual([200, 200, 200]);
  });
});
