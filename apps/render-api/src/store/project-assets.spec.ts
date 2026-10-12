import { CatalogSchema, resolveMediaProject } from '@video-maker/auto-montage';
import { describe, expect, it } from 'vitest';

import { createCallLog } from '../__fixtures__/call-log';
import { buildCatalogAssetFixture, buildCatalogFixture } from '../__fixtures__/catalog-fixtures';
import { createFakeObjectStorage } from '../__fixtures__/fake-object-storage';
import { countAssetsByRole, resolveProjectAssets } from './project-assets';

describe('resolveProjectAssets', () => {
  it('reports source catalog and the catalog assets when work/catalog.json validates', async () => {
    const callLog = createCallLog();
    const project = resolveMediaProject('/media/smoke-ingest');
    const catalogAsset = buildCatalogAssetFixture({ assetId: 'raw/aroll/clip01.mp4' });
    const catalog = CatalogSchema.parse({
      ...buildCatalogFixture('smoke-ingest', [catalogAsset]),
      probeFailures: [{ path: 'raw/audio/bad.wav', errorCode: 'COMMAND_FAILED', message: 'stale' }],
    });
    const storage = createFakeObjectStorage(callLog, {
      files: [{ path: `${project.workDir}/catalog.json`, contents: JSON.stringify(catalog) }],
    });

    const result = await resolveProjectAssets(storage, project);

    expect(result.source).toBe('catalog');
    expect(result.assets).toEqual([
      {
        path: catalogAsset.asset.id,
        role: catalogAsset.role,
        fingerprint: catalogAsset.fingerprint,
        media: catalogAsset.asset,
      },
    ]);
    expect(result.probeFailures).toEqual([{ path: 'raw/audio/bad.wav', errorCode: 'COMMAND_FAILED' }]);
  });

  it('reports source raw-scan with media null and writes nothing when there is no catalog', async () => {
    const callLog = createCallLog();
    const project = resolveMediaProject('/media/smoke-ingest');
    const storage = createFakeObjectStorage(callLog, {
      directories: [project.rawDir, `${project.rawDir}/aroll`],
      files: [{ path: `${project.rawDir}/aroll/clip01.mp4`, contents: 'binary-placeholder' }],
    });

    const result = await resolveProjectAssets(storage, project);

    expect(result.source).toBe('raw-scan');
    expect(result.assets).toEqual([
      {
        path: 'raw/aroll/clip01.mp4',
        role: 'aroll',
        fingerprint: { sizeBytes: 'binary-placeholder'.length, modifiedAtMs: expect.any(Number) },
        media: null,
      },
    ]);
    expect(result.probeFailures).toEqual([]);

    const writePorts = ['writeTextFile', 'ensureDirectory', 'writeTemporary', 'promoteTemporary', 'removeTemporary'];
    for (const port of writePorts) {
      expect(callLog.ports()).not.toContain(port);
    }
  });

  it('merges raw files that the catalog does not know yet and drops catalog entries that vanished from disk (FIX-e-burgos-005-002)', async () => {
    const callLog = createCallLog();
    const project = resolveMediaProject('/media/smoke-ingest');
    const known = buildCatalogAssetFixture({ assetId: 'raw/aroll/clip01.mp4' });
    const vanished = buildCatalogAssetFixture({ assetId: 'raw/broll/gone.mp4' });
    const catalog = CatalogSchema.parse(buildCatalogFixture('smoke-ingest', [known, vanished]));
    const storage = createFakeObjectStorage(callLog, {
      directories: [project.rawDir, `${project.rawDir}/aroll`, `${project.rawDir}/broll`],
      files: [
        { path: `${project.workDir}/catalog.json`, contents: JSON.stringify(catalog) },
        { path: `${project.rawDir}/aroll/clip01.mp4`, contents: 'binary-placeholder' },
        { path: `${project.rawDir}/broll/added-by-hand.mp4`, contents: 'new-binary' },
      ],
    });

    const result = await resolveProjectAssets(storage, project);

    expect(result.source).toBe('catalog');
    expect(result.assets.map((entry) => [entry.path, entry.media === null])).toEqual([
      ['raw/aroll/clip01.mp4', false],
      ['raw/broll/added-by-hand.mp4', true],
    ]);
  });

  it('throws PROJECT_LAYOUT_INVALID when the raw directory is missing on a raw scan', async () => {
    const callLog = createCallLog();
    const project = resolveMediaProject('/media/smoke-ingest');
    const storage = createFakeObjectStorage(callLog);

    await expect(resolveProjectAssets(storage, project)).rejects.toMatchObject({
      code: 'PROJECT_LAYOUT_INVALID',
    });
  });

  it('throws CATALOG_UNREADABLE and never falls back to the raw scan when the catalog is corrupt', async () => {
    const callLog = createCallLog();
    const project = resolveMediaProject('/media/smoke-ingest');
    const storage = createFakeObjectStorage(callLog, {
      directories: [project.rawDir],
      files: [{ path: `${project.workDir}/catalog.json`, contents: 'not valid json' }],
    });

    await expect(resolveProjectAssets(storage, project)).rejects.toMatchObject({
      code: 'CATALOG_UNREADABLE',
    });
    expect(callLog.ports()).not.toContain('listDirectory');
  });
});

describe('countAssetsByRole', () => {
  it('counts assets by role including the roles with zero', () => {
    const counts = countAssetsByRole([
      { role: 'aroll' },
      { role: 'aroll' },
      { role: 'broll' },
      { role: 'voice' },
      { role: 'logo' },
    ]);

    expect(counts).toEqual({ aroll: 2, broll: 1, image: 0, audio: 0, voice: 1, logo: 1, reference: 0 });
  });
});
