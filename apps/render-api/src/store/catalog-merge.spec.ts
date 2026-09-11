import { CATALOG_SCHEMA_VERSION, CatalogSchema } from '@video-maker/auto-montage';
import type { Catalog } from '@video-maker/auto-montage';
import { describe, expect, it } from 'vitest';

import {
  buildCatalogAssetFixture,
  buildCatalogFixture,
  buildMinimalMediaAsset,
} from '../__fixtures__/catalog-fixtures';
import {
  emptyCatalogFor,
  mergeProbeFailure,
  mergeUploadedAsset,
  removeCatalogAsset,
  toCatalogAsset,
} from './catalog-merge';

describe('emptyCatalogFor', () => {
  it('creates an empty catalog for the slug when there is no previous one', () => {
    const catalog = emptyCatalogFor('smoke-ingest');

    expect(catalog).toEqual({
      schemaVersion: CATALOG_SCHEMA_VERSION,
      projectSlug: 'smoke-ingest',
      assets: [],
      transcripts: [],
      ignored: [],
      probeFailures: [],
    });
    expect(() => CatalogSchema.parse(catalog)).not.toThrow();
  });
});

describe('toCatalogAsset', () => {
  it('forces asset.id and asset.path to the project-relative path', () => {
    const mismatchedAsset = buildMinimalMediaAsset({ id: 'something-else', path: 'something-else' });

    const entry = toCatalogAsset({
      asset: mismatchedAsset,
      assetId: 'raw/aroll/clip01.mp4',
      role: 'aroll',
      fingerprint: { sizeBytes: 10, modifiedAtMs: 0 },
    });

    expect(entry.asset.id).toBe('raw/aroll/clip01.mp4');
    expect(entry.asset.path).toBe('raw/aroll/clip01.mp4');
  });
});

describe('mergeUploadedAsset', () => {
  it('inserts the new asset keeping assets sorted ascending by asset.id', () => {
    const previous = buildCatalogFixture('smoke-ingest', [
      buildCatalogAssetFixture({ assetId: 'raw/aroll/b.mp4' }),
      buildCatalogAssetFixture({ assetId: 'raw/aroll/z.mp4' }),
    ]);
    const entry = buildCatalogAssetFixture({ assetId: 'raw/aroll/a.mp4' });

    const merged = mergeUploadedAsset(previous, entry, 'smoke-ingest');

    expect(merged.assets.map((asset) => asset.asset.id)).toEqual([
      'raw/aroll/a.mp4',
      'raw/aroll/b.mp4',
      'raw/aroll/z.mp4',
    ]);
  });

  it('builds the catalog from scratch when previous is null', () => {
    const entry = buildCatalogAssetFixture({ assetId: 'raw/aroll/clip01.mp4' });

    const merged = mergeUploadedAsset(null, entry, 'smoke-ingest');

    expect(merged.projectSlug).toBe('smoke-ingest');
    expect(merged.assets).toEqual([entry]);
    expect(() => CatalogSchema.parse(merged)).not.toThrow();
  });

  it('produces a catalog that CatalogSchema accepts', () => {
    const previous = buildCatalogFixture('smoke-ingest', [
      buildCatalogAssetFixture({ assetId: 'raw/aroll/b.mp4' }),
    ]);
    const entry = buildCatalogAssetFixture({ assetId: 'raw/aroll/a.mp4' });

    const merged = mergeUploadedAsset(previous, entry, 'smoke-ingest');

    expect(() => CatalogSchema.parse(merged)).not.toThrow();
  });

  it('drops a previous probe failure for the same path when the asset probes fine', () => {
    const assetId = 'raw/aroll/clip01.mp4';
    const previous: Catalog = {
      ...emptyCatalogFor('smoke-ingest'),
      probeFailures: [{ path: assetId, errorCode: 'COMMAND_FAILED', message: 'stale failure' }],
    };
    const entry = buildCatalogAssetFixture({ assetId });

    const merged = mergeUploadedAsset(previous, entry, 'smoke-ingest');

    expect(merged.probeFailures).toEqual([]);
  });

  it('preserves transcripts and ignored entries untouched', () => {
    const previous: Catalog = {
      ...emptyCatalogFor('smoke-ingest'),
      assets: [buildCatalogAssetFixture({ assetId: 'raw/aroll/existing.mp4' })],
      transcripts: [
        {
          assetId: 'raw/aroll/existing.mp4',
          transcriptPath: 'work/transcripts/existing.json',
          fingerprint: { sizeBytes: 10, modifiedAtMs: 0 },
          engine: 'whisper.cpp',
          model: 'base',
          language: 'es',
        },
      ],
      ignored: [{ path: 'raw/aroll/.DS_Store', reason: 'hidden' }],
    };
    const entry = buildCatalogAssetFixture({ assetId: 'raw/broll/new.mp4', role: 'broll' });

    const merged = mergeUploadedAsset(previous, entry, 'smoke-ingest');

    expect(merged.transcripts).toBe(previous.transcripts);
    expect(merged.ignored).toBe(previous.ignored);
  });
});

describe('mergeProbeFailure', () => {
  it('keeps probeFailures sorted ascending by path without duplicates', () => {
    const previous: Catalog = {
      ...emptyCatalogFor('smoke-ingest'),
      probeFailures: [
        { path: 'raw/audio/b.wav', errorCode: 'UNKNOWN', message: 'old' },
        { path: 'raw/audio/z.wav', errorCode: 'UNKNOWN', message: 'old' },
      ],
    };

    const firstMerge = mergeProbeFailure(
      previous,
      { path: 'raw/audio/a.wav', errorCode: 'COMMAND_FAILED' },
      'smoke-ingest',
    );
    const secondMerge = mergeProbeFailure(
      firstMerge,
      { path: 'raw/audio/b.wav', errorCode: 'BINARY_NOT_FOUND' },
      'smoke-ingest',
    );

    expect(secondMerge.probeFailures.map((failure) => failure.path)).toEqual([
      'raw/audio/a.wav',
      'raw/audio/b.wav',
      'raw/audio/z.wav',
    ]);
    expect(
      secondMerge.probeFailures.filter((failure) => failure.path === 'raw/audio/b.wav'),
    ).toHaveLength(1);
  });

  it('stores the static English message for the code, never the engine error message', () => {
    const merged = mergeProbeFailure(
      null,
      { path: 'raw/audio/a.wav', errorCode: 'COMMAND_FAILED' },
      'smoke-ingest',
    );

    expect(merged.probeFailures[0]?.message).toBe('A media command exited with a non-zero status.');
  });
});

describe('removeCatalogAsset', () => {
  function catalogWithTranscript(): Catalog {
    const aroll = buildCatalogAssetFixture({ assetId: 'raw/aroll/clip01.mp4', role: 'aroll' });
    const music = buildCatalogAssetFixture({ assetId: 'raw/audio/music01.mp3', role: 'audio' });

    return CatalogSchema.parse({
      ...buildCatalogFixture('smoke-ingest', [aroll, music]),
      transcripts: [
        {
          assetId: 'raw/aroll/clip01.mp4',
          transcriptPath: 'work/transcripts/aroll/clip01.json',
          fingerprint: { sizeBytes: 1024, modifiedAtMs: 1_757_289_600_000 },
          engine: 'whisper.cpp',
          model: 'ggml-large-v3-turbo-q5_0.bin',
          language: 'auto',
        },
      ],
      ignored: [{ path: 'raw/broll/notes.txt', reason: 'unsupported-extension' }],
      probeFailures: [
        {
          path: 'raw/images/broken.jpg',
          errorCode: 'COMMAND_FAILED',
          message: 'A media command exited with a non-zero status.',
        },
      ],
    });
  }

  it('drops the asset entry, its transcript and keeps the catalog valid', () => {
    const removal = removeCatalogAsset(catalogWithTranscript(), 'raw/aroll/clip01.mp4');

    expect(removal.entryRemoved).toBe(true);
    expect(removal.removedTranscriptPaths).toEqual(['work/transcripts/aroll/clip01.json']);
    expect(removal.catalog.assets.map((entry) => entry.asset.id)).toEqual(['raw/audio/music01.mp3']);
    expect(removal.catalog.transcripts).toEqual([]);
    expect(() => CatalogSchema.parse(removal.catalog)).not.toThrow();
  });

  it('leaves the transcripts of the assets it does not remove', () => {
    const removal = removeCatalogAsset(catalogWithTranscript(), 'raw/audio/music01.mp3');

    expect(removal.entryRemoved).toBe(true);
    expect(removal.removedTranscriptPaths).toEqual([]);
    expect(removal.catalog.transcripts.map((entry) => entry.assetId)).toEqual([
      'raw/aroll/clip01.mp4',
    ]);
  });

  it('removes an ignored entry and a probe failure of the same path', () => {
    const ignoredRemoval = removeCatalogAsset(catalogWithTranscript(), 'raw/broll/notes.txt');
    expect(ignoredRemoval.entryRemoved).toBe(true);
    expect(ignoredRemoval.catalog.ignored).toEqual([]);

    const failureRemoval = removeCatalogAsset(catalogWithTranscript(), 'raw/images/broken.jpg');
    expect(failureRemoval.entryRemoved).toBe(true);
    expect(failureRemoval.catalog.probeFailures).toEqual([]);
  });

  it('reports nothing removed for a path the catalog never mentions', () => {
    const catalog = catalogWithTranscript();
    const removal = removeCatalogAsset(catalog, 'raw/aroll/never-ingested.mp4');

    expect(removal.entryRemoved).toBe(false);
    expect(removal.removedTranscriptPaths).toEqual([]);
    expect(removal.catalog).toEqual(catalog);
  });
});
