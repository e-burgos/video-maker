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
  });
});
