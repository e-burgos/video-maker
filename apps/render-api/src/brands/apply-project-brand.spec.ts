import { readCatalog, resolveMediaProject, toAbsolutePath } from '@video-maker/auto-montage';
import { TimelineSchema } from '@video-maker/timeline-core';
import type { MediaAsset, Timeline } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { createCallLog } from '../__fixtures__/call-log';
import { buildCatalogAssetFixture, buildCatalogFixture } from '../__fixtures__/catalog-fixtures';
import { createFakeObjectStorage } from '../__fixtures__/fake-object-storage';
import type { FakeObjectStorageFileSeed } from '../__fixtures__/fake-object-storage';
import { createFakeRenderApiDependencies } from '../__fixtures__/fake-render-api-dependencies';
import { buildMinimalTimeline } from '../__fixtures__/minimal-timeline';
import type { StoreConfig } from '../config/store-config';
import { PipelineStageError } from '../errors/pipeline-stage-error';
import { createKeyedSerializer } from '../store/serialize-by-key';
import { applyProjectBrand } from './apply-project-brand';

const STORE: StoreConfig = {
  mediaRoot: '/media',
  dbPath: '/media/.studio/studio.db',
  maxUploadBytes: 2_147_483_648,
  objectStore: 'fs',
  motionAssetsRoot: '/assets',
  brandsRoot: '/brands',
};
const SLUG = 'clip';
const PROJECT_ROOT = `${STORE.mediaRoot}/${SLUG}`;
const SERIALIZER = createKeyedSerializer();

function manifest(id: string, logo: string) {
  return {
    id,
    name: id.toUpperCase(),
    spokenName: id,
    tagline: 'Tu mensaje, en video.',
    logo,
    palette: { background: '#101820', accent: '#ff5500', accent2: '#00aaff', text: '#fafafa' },
    typography: { display: 'Outfit', body: 'Geist' },
    fonts: [
      { family: 'Outfit', file: 'fonts/outfit.woff2', weight: '100 900' },
      { family: 'Geist', file: 'fonts/geist.woff2' },
      { family: 'Unused', file: 'fonts/unused.woff2' },
    ],
    devices: {},
    images: {},
    music: [],
    voice: { id: 'es_AR-daniela-high', lengthScale: 1.08 },
  };
}

function brandFiles(id: string, logo: string, logoContents = '<svg viewBox="0 0 400 100"/>'): FakeObjectStorageFileSeed[] {
  return [
    { path: `/brands/${id}/brand.json`, contents: JSON.stringify(manifest(id, logo)) },
    { path: `/brands/${id}/${logo}`, contents: logoContents },
    { path: `/brands/${id}/fonts/outfit.woff2`, contents: 'outfit' },
    { path: `/brands/${id}/fonts/geist.woff2`, contents: 'geist' },
    { path: `/brands/${id}/fonts/unused.woff2`, contents: 'unused' },
  ];
}

function imageAsset(assetId: string): MediaAsset {
  return {
    id: assetId,
    kind: 'image',
    path: assetId,
    durationMs: 0,
    width: 1600,
    height: 400,
    hasAudio: false,
    probedAt: '2026-09-08T00:00:00.000Z',
  };
}

function logoCatalogEntry(brandId: string) {
  const assetId = `raw/logo/brand-${brandId}.png`;
  return buildCatalogAssetFixture({ assetId, role: 'logo' });
}

function projectFiles(brandIds: readonly string[] = []): FakeObjectStorageFileSeed[] {
  const files: FakeObjectStorageFileSeed[] = brandIds.flatMap((id) => [
    { path: `${PROJECT_ROOT}/raw/logo/brand-${id}.png`, contents: 'png' },
  ]);
  if (brandIds.length > 0) {
    const catalog = buildCatalogFixture(SLUG, brandIds.map(logoCatalogEntry));
    files.push({ path: `${PROJECT_ROOT}/work/catalog.json`, contents: JSON.stringify(catalog) });
  }
  return files;
}

function timelineWithLogo(brandId: string): Timeline {
  const base = buildMinimalTimeline();
  const logoAsset = imageAsset(`raw/logo/brand-${brandId}.png`);
  return TimelineSchema.parse({
    ...base,
    assets: [...base.assets, logoAsset],
    logo: { assetId: logoAsset.id },
  });
}

function setup(files: readonly FakeObjectStorageFileSeed[], timeline: Timeline | null = null) {
  const callLog = createCallLog();
  const timelineFile: FakeObjectStorageFileSeed[] =
    timeline === null ? [] : [{ path: `${PROJECT_ROOT}/work/timeline.json`, contents: JSON.stringify(timeline) }];
  const storage = createFakeObjectStorage(callLog, {
    directories: [PROJECT_ROOT, `${PROJECT_ROOT}/raw`, `${PROJECT_ROOT}/raw/logo`],
    files: [...files, ...timelineFile],
  });
  const deps = createFakeRenderApiDependencies(callLog, { storage, probeAsset: async ({ assetId }) => imageAsset(assetId) });
  return { callLog, storage, deps };
}

async function exists(storage: ReturnType<typeof setup>['storage'], path: string): Promise<boolean> {
  return (await storage.stat(path)) !== null;
}

async function catalogIds(deps: ReturnType<typeof setup>['deps']): Promise<string[]> {
  const catalog = await readCatalog(resolveMediaProject(PROJECT_ROOT), { readTextFile: deps.storage.readTextFile });
  return (catalog?.assets ?? []).map((entry) => entry.asset.id);
}

describe('applyProjectBrand', () => {
  it('rasterizes an SVG logo into raw/logo, catalogs it and returns the caption theme', async () => {
    const { deps, storage, callLog } = setup(brandFiles('acme', 'img/logo.svg'));

    const applied = await applyProjectBrand(deps, STORE, SERIALIZER, SLUG, 'acme');

    const calls = callLog.entries().filter((entry) => entry.port === 'rasterizeSvg');
    expect(calls).toHaveLength(1);
    expect(calls[0]?.input).toEqual({
      svgPath: '/brands/acme/img/logo.svg',
      outPath: `${PROJECT_ROOT}/work/.brand/acme.png`,
      widthPx: 1600,
      heightPx: 400,
    });
    expect(await exists(storage, `${PROJECT_ROOT}/raw/logo/brand-acme.png`)).toBe(true);
    expect(await catalogIds(deps)).toEqual(['raw/logo/brand-acme.png']);
    expect(applied.logoAssetId).toBe('raw/logo/brand-acme.png');
    expect(applied.captionTheme).toEqual({
      fontFamily: 'Outfit',
      fontFiles: [{ path: 'work/brand/fonts/outfit.woff2', weight: '100 900' }],
      textColor: '#fafafa',
      accentColor: '#ff5500',
      boxColor: '#101820',
    });
  });

  it('copies only the display and body fonts into work/brand/fonts', async () => {
    const { deps, storage } = setup(brandFiles('acme', 'img/logo.svg'));

    await applyProjectBrand(deps, STORE, SERIALIZER, SLUG, 'acme');

    expect(await storage.readTextFile(`${PROJECT_ROOT}/work/brand/fonts/outfit.woff2`)).toBe('outfit');
    expect(await storage.readTextFile(`${PROJECT_ROOT}/work/brand/fonts/geist.woff2`)).toBe('geist');
    expect(await exists(storage, `${PROJECT_ROOT}/work/brand/fonts/unused.woff2`)).toBe(false);
  });

  it('copies a PNG logo without rasterizing', async () => {
    const { deps, storage, callLog } = setup(brandFiles('acme', 'img/logo.png', 'png-bytes'));

    await applyProjectBrand(deps, STORE, SERIALIZER, SLUG, 'acme');

    expect(callLog.entries().some((entry) => entry.port === 'rasterizeSvg')).toBe(false);
    expect(await storage.readTextFile(`${PROJECT_ROOT}/raw/logo/brand-acme.png`)).toBe('png-bytes');
  });

  it('leaves the project unchanged when the rasterizer fails', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: [PROJECT_ROOT, `${PROJECT_ROOT}/raw`, `${PROJECT_ROOT}/raw/logo`],
      files: brandFiles('acme', 'img/logo.svg'),
    });
    const deps = createFakeRenderApiDependencies(callLog, {
      storage,
      rasterizeSvg: async () => {
        throw new PipelineStageError({ code: 'BRAND_LOGO_RASTERIZE_FAILED', stage: null });
      },
    });

    await expect(applyProjectBrand(deps, STORE, SERIALIZER, SLUG, 'acme')).rejects.toMatchObject({
      code: 'BRAND_LOGO_RASTERIZE_FAILED',
    });

    expect(await exists(storage, `${PROJECT_ROOT}/raw/logo/brand-acme.png`)).toBe(false);
    expect(await exists(storage, `${PROJECT_ROOT}/work/catalog.json`)).toBe(false);
    expect(await exists(storage, `${PROJECT_ROOT}/work/brand`)).toBe(false);
  });

  it('replaces the previous brand logo and swaps the timeline logo to the new asset', async () => {
    const { deps, storage } = setup(
      [...brandFiles('acme', 'img/logo.svg'), ...brandFiles('globex', 'img/logo.svg'), ...projectFiles(['acme'])],
      timelineWithLogo('acme'),
    );

    await applyProjectBrand(deps, STORE, SERIALIZER, SLUG, 'globex');

    expect(await exists(storage, `${PROJECT_ROOT}/raw/logo/brand-acme.png`)).toBe(false);
    expect(await exists(storage, `${PROJECT_ROOT}/raw/logo/brand-globex.png`)).toBe(true);
    expect(await catalogIds(deps)).toEqual(['raw/logo/brand-globex.png']);
    const timeline = TimelineSchema.parse(JSON.parse(await storage.readTextFile(`${PROJECT_ROOT}/work/timeline.json`)));
    expect(timeline.logo?.assetId).toBe('raw/logo/brand-globex.png');
    expect(timeline.assets.map((asset) => asset.id)).toContain('raw/logo/brand-globex.png');
    expect(timeline.assets.map((asset) => asset.id)).not.toContain('raw/logo/brand-acme.png');
  });

  it('retargets a brand caption style to the new brand theme', async () => {
    const withBrandCaptions = TimelineSchema.parse({
      ...timelineWithLogo('acme'),
      captionStyle: 'brand',
      captionTheme: { fontFamily: 'Old', fontFiles: [{ path: 'work/brand/fonts/old.woff2' }], textColor: '#000000', accentColor: '#111111', boxColor: '#222222' },
    });
    const { deps, storage } = setup(
      [...brandFiles('acme', 'img/logo.svg'), ...brandFiles('globex', 'img/logo.svg'), ...projectFiles(['acme'])],
      withBrandCaptions,
    );

    await applyProjectBrand(deps, STORE, SERIALIZER, SLUG, 'globex');

    const timeline = TimelineSchema.parse(JSON.parse(await storage.readTextFile(`${PROJECT_ROOT}/work/timeline.json`)));
    expect(timeline.captionTheme?.fontFamily).toBe('Outfit');
  });

  it('removes the brand logo when the brand is cleared and nothing references it', async () => {
    const { deps, storage } = setup([...brandFiles('acme', 'img/logo.svg'), ...projectFiles(['acme'])]);

    const applied = await applyProjectBrand(deps, STORE, SERIALIZER, SLUG, null);

    expect(applied).toEqual({ captionTheme: null, logoAssetId: null });
    expect(await exists(storage, `${PROJECT_ROOT}/raw/logo/brand-acme.png`)).toBe(false);
    expect(await catalogIds(deps)).toEqual([]);
  });

  it('keeps the brand logo when the brand is cleared but the timeline references it', async () => {
    const { deps, storage } = setup(
      [...brandFiles('acme', 'img/logo.svg'), ...projectFiles(['acme'])],
      timelineWithLogo('acme'),
    );

    await applyProjectBrand(deps, STORE, SERIALIZER, SLUG, null);

    expect(await exists(storage, `${PROJECT_ROOT}/raw/logo/brand-acme.png`)).toBe(true);
    expect(await catalogIds(deps)).toEqual(['raw/logo/brand-acme.png']);
  });

  it('never touches a logo the user uploaded', async () => {
    const { deps, storage } = setup([
      ...brandFiles('acme', 'img/logo.svg'),
      { path: `${PROJECT_ROOT}/raw/logo/mi-logo.png`, contents: 'mine' },
    ]);

    await applyProjectBrand(deps, STORE, SERIALIZER, SLUG, null);

    expect(await exists(storage, `${PROJECT_ROOT}/raw/logo/mi-logo.png`)).toBe(true);
    expect(toAbsolutePath(resolveMediaProject(PROJECT_ROOT), 'raw/logo/mi-logo.png')).toBe(`${PROJECT_ROOT}/raw/logo/mi-logo.png`);
  });

  it('rejects an unknown brand before touching the project', async () => {
    const { deps, storage } = setup([]);

    await expect(applyProjectBrand(deps, STORE, SERIALIZER, SLUG, 'ghost')).rejects.toMatchObject({ code: 'BRAND_UNKNOWN' });
    expect(await exists(storage, `${PROJECT_ROOT}/raw/logo/brand-ghost.png`)).toBe(false);
  });
});
