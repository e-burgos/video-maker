import { resolveMediaProject, serializeMontageDocument } from '@video-maker/auto-montage';
import type { Catalog, TranscriptRef } from '@video-maker/auto-montage';
import type { Transcription } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { createCallLog } from '../__fixtures__/call-log';
import { buildCatalogAssetFixture } from '../__fixtures__/catalog-fixtures';
import type { FakeObjectStorageFileSeed } from '../__fixtures__/fake-object-storage';
import { createFakeObjectStorage } from '../__fixtures__/fake-object-storage';
import { createFakeRenderApiDependencies } from '../__fixtures__/fake-render-api-dependencies';
import { buildStoryboardDocument } from '../__fixtures__/storyboard-fixtures';
import { isRenderApiError } from '../errors/render-api-error';
import { collectStoryboardInventory } from './collect-storyboard-inventory';

const PROJECT = resolveMediaProject('/media/acme-launch');
const CATALOG_PATH = '/media/acme-launch/work/catalog.json';
const TRANSCRIPT_PATH = '/media/acme-launch/work/transcripts/aroll/clip01.json';
const STORYBOARD_PATH = '/media/acme-launch/work/storyboard.json';

const AROLL_ID = 'raw/aroll/clip01.mp4';

const TRANSCRIPT_REF: TranscriptRef = {
  assetId: AROLL_ID,
  transcriptPath: 'work/transcripts/aroll/clip01.json',
  fingerprint: { sizeBytes: 10_485_760, modifiedAtMs: 1_757_289_600_000 },
  engine: 'whisper.cpp',
  model: 'ggml-large-v3-turbo',
  language: 'es',
};

const TRANSCRIPTION: Transcription = {
  assetId: AROLL_ID,
  engine: 'whisper.cpp',
  language: 'es',
  words: [
    { text: 'Hola,', startMs: 120, endMs: 500 },
    { text: 'hoy', startMs: 500, endMs: 900 },
    { text: 'vemos', startMs: 900, endMs: 1400 },
    { text: 'Nx.', startMs: 1400, endMs: 2000 },
    { text: 'Tres', startMs: 2100, endMs: 2600 },
    { text: 'trampas.', startMs: 2600, endMs: 3900 },
  ],
  segments: [
    { startMs: 120, endMs: 2000, text: ' Hola, hoy vemos Nx. ', wordRange: [0, 3] },
    { startMs: 2100, endMs: 3900, text: 'Tres trampas.', wordRange: [4, 5] },
  ],
};

function catalogWith(overrides?: Partial<Catalog>): Catalog {
  return {
    schemaVersion: 1,
    projectSlug: 'acme-launch',
    assets: [
      buildCatalogAssetFixture({ assetId: AROLL_ID, role: 'aroll' }),
      buildCatalogAssetFixture({ assetId: 'raw/broll/desk.mp4', role: 'broll' }),
    ],
    transcripts: [],
    ignored: [],
    probeFailures: [],
    ...overrides,
  };
}

function depsWith(files: readonly FakeObjectStorageFileSeed[]) {
  const callLog = createCallLog();
  const storage = createFakeObjectStorage(callLog, {
    directories: ['/media/acme-launch', '/media/acme-launch/work'],
    files,
  });
  return createFakeRenderApiDependencies(callLog, { storage });
}

describe('collectStoryboardInventory', () => {
  it('devuelve el inventario vacío cuando el proyecto no tiene nada en work/', async () => {
    expect(await collectStoryboardInventory(depsWith([]), PROJECT)).toEqual({
      assets: [],
      transcript: null,
      previousStoryboard: null,
    });
  });

  it('lista los assets del catálogo con rol, kind y duración', async () => {
    const deps = depsWith([{ path: CATALOG_PATH, contents: serializeMontageDocument(catalogWith()) }]);

    const inventory = await collectStoryboardInventory(deps, PROJECT);

    expect(inventory.assets).toEqual([
      { id: AROLL_ID, role: 'aroll', kind: 'video', durationMs: 12000 },
      { id: 'raw/broll/desk.mp4', role: 'broll', kind: 'video', durationMs: 12000 },
    ]);
    expect(inventory.transcript).toBeNull();
  });

  it('concatena el texto de la transcripción del A-roll', async () => {
    const deps = depsWith([
      {
        path: CATALOG_PATH,
        contents: serializeMontageDocument(catalogWith({ transcripts: [TRANSCRIPT_REF] })),
      },
      { path: TRANSCRIPT_PATH, contents: serializeMontageDocument(TRANSCRIPTION) },
    ]);

    expect((await collectStoryboardInventory(deps, PROJECT)).transcript).toBe('Hola, hoy vemos Nx. Tres trampas.');
  });

  it('ignora una transcripción referenciada que falta en disco', async () => {
    const deps = depsWith([
      {
        path: CATALOG_PATH,
        contents: serializeMontageDocument(catalogWith({ transcripts: [TRANSCRIPT_REF] })),
      },
    ]);

    expect((await collectStoryboardInventory(deps, PROJECT)).transcript).toBeNull();
  });

  it('ignora una transcripción que no valida contra el schema', async () => {
    const deps = depsWith([
      {
        path: CATALOG_PATH,
        contents: serializeMontageDocument(catalogWith({ transcripts: [TRANSCRIPT_REF] })),
      },
      { path: TRANSCRIPT_PATH, contents: '{ "assetId": 1 }' },
    ]);

    expect((await collectStoryboardInventory(deps, PROJECT)).transcript).toBeNull();
  });

  it('incluye el storyboard previo cuando existe y es usable', async () => {
    const previous = buildStoryboardDocument();
    const deps = depsWith([{ path: STORYBOARD_PATH, contents: serializeMontageDocument(previous) }]);

    expect((await collectStoryboardInventory(deps, PROJECT)).previousStoryboard).toEqual(previous);
  });

  it('ignora un storyboard previo corrupto en vez de bloquear la regeneración', async () => {
    const deps = depsWith([{ path: STORYBOARD_PATH, contents: '{ roto' }]);

    expect((await collectStoryboardInventory(deps, PROJECT)).previousStoryboard).toBeNull();
  });

  it('reporta CATALOG_UNREADABLE cuando el catálogo existe pero no se puede leer', async () => {
    const deps = depsWith([{ path: CATALOG_PATH, contents: '{ roto' }]);

    try {
      await collectStoryboardInventory(deps, PROJECT);
      expect.unreachable('un catálogo ilegible debe fallar');
    } catch (error) {
      expect(isRenderApiError(error) && error.code).toBe('CATALOG_UNREADABLE');
    }
  });
});
