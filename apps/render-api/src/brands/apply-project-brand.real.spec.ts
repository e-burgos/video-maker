import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { StoreConfig } from '../config/store-config';
import { createNodeRenderApiDependencies } from '../deps/node-render-api-dependencies';
import { resolveHeadlessBrowser } from '../deps/svg-rasterizer';
import { createBrand, getBrand } from './brand-library';

const MOTION_ASSETS = fileURLToPath(new URL('../../../../libs/motion-graphics/assets', import.meta.url));
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const RGBA_COLOR_TYPE = 6;

let root = '';
let store: StoreConfig;
const browserAvailable = (await resolveHeadlessBrowser(process.env.REMOTION_BROWSER_EXECUTABLE ?? null, process.cwd())) !== null;

function pngChunks(png: Buffer): Array<{ type: string; data: Buffer }> {
  const chunks: Array<{ type: string; data: Buffer }> = [];
  let offset = PNG_SIGNATURE.length;
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    chunks.push({ type: png.toString('ascii', offset + 4, offset + 8), data: png.subarray(offset + 8, offset + 8 + length) });
    offset += 12 + length;
  }
  return chunks;
}

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'brand-rasterize-'));
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

describe('brand logo rasterized with the real headless browser', () => {
  it.skipIf(!browserAvailable)('turns the wordmark SVG of a new brand into a transparent PNG', async () => {
    const deps = createNodeRenderApiDependencies({}, store);
    await createBrand(deps, store, { name: 'Smoke Co' });
    const detail = await getBrand(deps, store, 'smoke-co');
    const svgPath = join(store.brandsRoot, 'smoke-co', detail.manifest.logo);
    const outPath = join(root, 'logo.png');

    await deps.rasterizeSvg({ svgPath, outPath, widthPx: 1600, heightPx: 350 });

    const png = await readFile(outPath);
    expect(png.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
    const chunks = pngChunks(png);
    const header = chunks.find((chunk) => chunk.type === 'IHDR')?.data as Buffer;
    expect([header.readUInt32BE(0), header.readUInt32BE(4)]).toEqual([1600, 350]);
    expect(header[9]).toBe(RGBA_COLOR_TYPE);
    const pixels = inflateSync(Buffer.concat(chunks.filter((chunk) => chunk.type === 'IDAT').map((chunk) => chunk.data)));
    const firstPixelAlpha = pixels[4];
    expect(firstPixelAlpha).toBe(0);
    const anyOpaque = [...pixels].some((_, index) => index % (1600 * 4 + 1) > 0 && (index % (1600 * 4 + 1)) % 4 === 0 && pixels[index] === 255);
    expect(anyOpaque).toBe(true);
    deps.localStore.close();
  }, 60_000);
});
