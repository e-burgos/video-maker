import { resolveMediaProject, serializeMontageDocument } from '@video-maker/auto-montage';
import { describe, expect, it } from 'vitest';

import { createCallLog } from '../__fixtures__/call-log';
import { buildCatalogAssetFixture, buildCatalogFixture } from '../__fixtures__/catalog-fixtures';
import { createFakeObjectStorage } from '../__fixtures__/fake-object-storage';
import { createFakeRenderApiDependencies } from '../__fixtures__/fake-render-api-dependencies';
import { collectProducerContext } from './collect-producer-context';

const PROJECT = resolveMediaProject('/media/demo-01');
const INPUT = { repoRoot: '/repo', apiUrl: 'http://127.0.0.1:4399' };

describe('collectProducerContext', () => {
  it('toma los assets medidos del catálogo y marca la Timeline persistida', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: ['/media/demo-01', '/media/demo-01/work'],
      files: [
        { path: '/media/demo-01/work/catalog.json', contents: serializeMontageDocument(buildCatalogFixture('demo-01', [buildCatalogAssetFixture()])) },
        { path: '/media/demo-01/work/timeline.json', contents: '{}' },
      ],
    });
    const deps = createFakeRenderApiDependencies(callLog, { storage });

    const context = await collectProducerContext(deps, PROJECT, INPUT);

    expect(context.slug).toBe('demo-01');
    expect(context.projectRoot).toBe('/media/demo-01');
    expect(context.repoRoot).toBe('/repo');
    expect(context.apiUrl).toBe('http://127.0.0.1:4399');
    expect(context.assetSource).toBe('catalog');
    expect(context.hasTimeline).toBe(true);
    expect(context.assets.length).toBeGreaterThan(0);
    expect(context.assets.every((asset) => !asset.path.startsWith('/'))).toBe(true);
  });

  it('cae al escaneo de raw/ y deja las duraciones en null cuando no hay catálogo', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: [
        '/media/demo-01',
        '/media/demo-01/raw',
        '/media/demo-01/raw/aroll',
        '/media/demo-01/work',
      ],
      files: [{ path: '/media/demo-01/raw/aroll/clip01.mp4', contents: 'video' }],
    });
    const deps = createFakeRenderApiDependencies(callLog, { storage });

    const context = await collectProducerContext(deps, PROJECT, INPUT);

    expect(context.assetSource).toBe('raw-scan');
    expect(context.hasTimeline).toBe(false);
    expect(context.assets).toEqual([
      { path: 'raw/aroll/clip01.mp4', role: 'aroll', durationMs: null },
    ]);
    expect(context.pendingAssets).toEqual([]);
  });

  it('incluye los assets pendientes de confirmación del proyecto', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: ['/media/demo-01', '/media/demo-01/raw', '/media/demo-01/work'],
    });
    const deps = createFakeRenderApiDependencies(callLog, { storage });
    deps.localStore.projects.insert('demo-01');
    deps.localStore.assets.insertPending({
      id: 'asset-1',
      slug: 'demo-01',
      path: 'raw/inbox/dropped.mp4',
      fileName: 'dropped.mp4',
      proposedRole: 'aroll',
      proposalReason: 'has-audio',
      probe: {},
    });

    const context = await collectProducerContext(deps, PROJECT, INPUT);

    expect(context.pendingAssets).toEqual([
      { fileName: 'dropped.mp4', proposedRole: 'aroll', proposalReason: 'has-audio' },
    ]);
  });

  it('summarizes the project brand from the brand library and leaves null when it has none or it is gone', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: ['/media/demo-01', '/media/demo-01/raw', '/media/demo-01/work'] });
    const manifest = {
      id: 'acme',
      name: 'Acme',
      spokenName: 'Acme Ei',
      tagline: 'Todo bajo control.',
      url: 'acme.test',
      logo: 'img/logo.svg',
      palette: { background: '#101820', accent: '#ff5500', accent2: '#00aaff', text: '#ffffff' },
      fonts: [{ family: 'Inter', file: 'fonts/inter.woff2' }],
      devices: { counter: { name: 'Counter', image: 'img/counter.png', kind: 'counter' }, old: { name: 'Old', image: 'img/old.png', kind: 'box', retired: true } },
      images: { local: 'img/local.jpg', cafe: 'img/cafe.jpg' },
      music: [],
      voice: { id: 'es_AR-daniela-high', lengthScale: 1.08 },
    };
    const deps = createFakeRenderApiDependencies(callLog, {
      storage,
      listMotionBrands: async () => [{ id: 'acme', source: 'user', manifest }],
    });
    deps.localStore.projects.insert('demo-01', null, 'motion', 'acme');

    const context = await collectProducerContext(deps, PROJECT, INPUT);

    expect(Object.keys(context.brand ?? {}).sort()).toEqual(['devices', 'hasMusic', 'id', 'name', 'photos', 'spokenName', 'tagline', 'url', 'voice']);
    expect(context.brand).toEqual({
      id: 'acme',
      name: 'Acme',
      spokenName: 'Acme Ei',
      tagline: 'Todo bajo control.',
      url: 'acme.test',
      voice: 'es_AR-daniela-high',
      hasMusic: false,
      photos: 2,
      devices: ['Counter'],
    });

    deps.localStore.projects.setBrand('demo-01', 'gone');
    expect((await collectProducerContext(deps, PROJECT, INPUT)).brand).toBeNull();
    deps.localStore.projects.setBrand('demo-01', null);
    expect((await collectProducerContext(deps, PROJECT, INPUT)).brand).toBeNull();
  });
});
