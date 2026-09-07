import type { MediaAsset } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { createFakeFileSystem } from '../__fixtures__/fake-file-system';
import { CatalogUnreadableError } from '../errors/catalog-unreadable-error';
import { resolveMediaProject } from '../project/media-project';
import { CATALOG_SCHEMA_VERSION } from './catalog.schema';
import type { Catalog } from './catalog.schema';
import { readCatalog } from './read-catalog';
import { writeCatalog } from './write-catalog';

const project = resolveMediaProject('/tmp/media/pitch-deck');

const arollAsset: MediaAsset = {
  id: 'raw/aroll/clip01.mp4',
  kind: 'video',
  path: 'raw/aroll/clip01.mp4',
  durationMs: 10_000,
  fps: 30,
  width: 1920,
  height: 1080,
  hasAudio: true,
  probedAt: '2026-01-01T00:00:00.000Z',
};

function sampleCatalog(): Catalog {
  return {
    schemaVersion: CATALOG_SCHEMA_VERSION,
    projectSlug: project.slug,
    assets: [{ role: 'aroll', fingerprint: { sizeBytes: 10, modifiedAtMs: 1 }, asset: arollAsset }],
    transcripts: [
      {
        assetId: 'raw/aroll/clip01.mp4',
        transcriptPath: 'work/transcripts/aroll/clip01.json',
        fingerprint: { sizeBytes: 10, modifiedAtMs: 1 },
        engine: 'whisper.cpp',
        model: 'ggml-base.bin',
        language: 'es',
      },
    ],
    ignored: [{ path: 'raw/aroll/.DS_Store', reason: 'hidden' }],
    probeFailures: [],
  };
}

function readWriteDeps(fakeFileSystem: ReturnType<typeof createFakeFileSystem>) {
  return {
    readTextFile: fakeFileSystem.readTextFile,
    writeTextFile: fakeFileSystem.writeTextFile,
    ensureDirectory: fakeFileSystem.ensureDirectory,
  };
}

describe('readCatalog', () => {
  it('devuelve null cuando no existe un catálogo previo', async () => {
    const fakeFileSystem = createFakeFileSystem();

    await expect(readCatalog(project, { readTextFile: fakeFileSystem.readTextFile })).resolves.toBeNull();
  });

  it('lee y valida un catálogo previamente escrito', async () => {
    const fakeFileSystem = createFakeFileSystem();
    const deps = readWriteDeps(fakeFileSystem);
    await writeCatalog(project, sampleCatalog(), deps);

    const result = await readCatalog(project, deps);

    expect(result).toEqual(sampleCatalog());
  });

  it('lanza CatalogUnreadableError si el contenido no es JSON válido', async () => {
    const fakeFileSystem = createFakeFileSystem([
      { path: '/tmp/media/pitch-deck/work/catalog.json', contents: 'esto no es json' },
    ]);

    await expect(readCatalog(project, { readTextFile: fakeFileSystem.readTextFile })).rejects.toThrow(
      CatalogUnreadableError,
    );
  });

  it('lanza CatalogUnreadableError con las dos versiones en el mensaje si schemaVersion no coincide', async () => {
    const staleCatalog = { ...sampleCatalog(), schemaVersion: 999 };
    const fakeFileSystem = createFakeFileSystem([
      {
        path: '/tmp/media/pitch-deck/work/catalog.json',
        contents: JSON.stringify(staleCatalog),
      },
    ]);

    await expect(readCatalog(project, { readTextFile: fakeFileSystem.readTextFile })).rejects.toThrow(
      /999.*1|1.*999/u,
    );
  });

  it('lanza CatalogUnreadableError si projectSlug no coincide con el proyecto', async () => {
    const mismatchedCatalog = { ...sampleCatalog(), projectSlug: 'otro-proyecto' };
    const fakeFileSystem = createFakeFileSystem([
      {
        path: '/tmp/media/pitch-deck/work/catalog.json',
        contents: JSON.stringify(mismatchedCatalog),
      },
    ]);

    await expect(readCatalog(project, { readTextFile: fakeFileSystem.readTextFile })).rejects.toThrow(
      CatalogUnreadableError,
    );
  });

  it('lanza CatalogUnreadableError si el contenido no cumple otro invariante del schema', async () => {
    const catalog = sampleCatalog();
    const brokenCatalog = { ...catalog, assets: [...catalog.assets, catalog.assets[0]] };
    const fakeFileSystem = createFakeFileSystem([
      { path: '/tmp/media/pitch-deck/work/catalog.json', contents: JSON.stringify(brokenCatalog) },
    ]);

    await expect(readCatalog(project, { readTextFile: fakeFileSystem.readTextFile })).rejects.toThrow(
      CatalogUnreadableError,
    );
  });

  it('round-trip: escribir, leer y volver a escribir produce el mismo string byte a byte', async () => {
    const fakeFileSystem = createFakeFileSystem();
    const deps = readWriteDeps(fakeFileSystem);

    await writeCatalog(project, sampleCatalog(), deps);
    const firstWrite = fakeFileSystem.readFile('/tmp/media/pitch-deck/work/catalog.json');

    const reloaded = await readCatalog(project, deps);
    expect(reloaded).not.toBeNull();

    await writeCatalog(project, reloaded as Catalog, deps);
    const secondWrite = fakeFileSystem.readFile('/tmp/media/pitch-deck/work/catalog.json');

    expect(secondWrite).toBe(firstWrite);
  });
});
