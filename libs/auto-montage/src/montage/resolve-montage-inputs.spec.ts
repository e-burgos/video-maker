import type { MediaAsset } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { createFakeFileSystem } from '../__fixtures__/fake-file-system';
import type { Catalog, CatalogAsset, TranscriptRef } from '../catalog/catalog.schema';
import { MontageInputError } from '../errors/montage-input-error';
import { resolveMediaProject } from '../project/media-project';
import { toAbsolutePath, transcriptPath } from '../project/project-paths';
import { resolveMontageInputs } from './resolve-montage-inputs';

const project = resolveMediaProject('/tmp/media/demo');

function mediaAsset(init: Partial<MediaAsset> & Pick<MediaAsset, 'id' | 'path' | 'kind'>): MediaAsset {
  return { durationMs: 5000, probedAt: '2026-01-01T00:00:00.000Z', ...init };
}

function catalogAsset(role: CatalogAsset['role'], asset: MediaAsset): CatalogAsset {
  return { role, fingerprint: { sizeBytes: 1000, modifiedAtMs: 0 }, asset };
}

function transcriptRef(assetId: string, mirror: string): TranscriptRef {
  return {
    assetId,
    transcriptPath: transcriptPath(mirror),
    fingerprint: { sizeBytes: 1000, modifiedAtMs: 0 },
    engine: 'whisper.cpp',
    model: 'base',
    language: 'es',
  };
}

function catalogOf(assets: readonly CatalogAsset[], transcripts: readonly TranscriptRef[] = []): Catalog {
  return {
    schemaVersion: 1,
    projectSlug: project.slug,
    assets: [...assets],
    transcripts: [...transcripts],
    ignored: [],
    probeFailures: [],
  };
}

const VALID_TRANSCRIPTION_JSON = JSON.stringify({
  assetId: 'raw/aroll/a-clip.mp4',
  engine: 'whisper.cpp',
  language: 'es',
  words: [{ text: 'hola', startMs: 0, endMs: 300 }],
  segments: [],
});

describe('resolveMontageInputs (§8, D-10, D-20)', () => {
  it('sin arollAssetId, elige el primer aroll del catálogo por assetId ascendente', async () => {
    const catalog = catalogOf(
      [
        catalogAsset('aroll', mediaAsset({ id: 'raw/aroll/b-clip.mp4', path: 'raw/aroll/b-clip.mp4', kind: 'video' })),
        catalogAsset('aroll', mediaAsset({ id: 'raw/aroll/a-clip.mp4', path: 'raw/aroll/a-clip.mp4', kind: 'video' })),
        catalogAsset('aroll', mediaAsset({ id: 'raw/aroll/c-clip.mp4', path: 'raw/aroll/c-clip.mp4', kind: 'video' })),
      ],
      [transcriptRef('raw/aroll/a-clip.mp4', 'aroll/a-clip')],
    );
    const fileSystem = createFakeFileSystem([
      { path: toAbsolutePath(project, transcriptPath('aroll/a-clip')), contents: VALID_TRANSCRIPTION_JSON },
    ]);

    const result = await resolveMontageInputs(project, catalog, {}, { readTextFile: fileSystem.readTextFile });

    expect(result.arollAsset.id).toBe('raw/aroll/a-clip.mp4');
    expect(result.transcriptionSource).toBe('catalog');
    expect(result.transcription.words).toHaveLength(1);
    expect(result.format.preset).toBe('reels-9x16');
  });

  it('respeta arollAssetId cuando se especifica', async () => {
    const catalog = catalogOf([
      catalogAsset('aroll', mediaAsset({ id: 'raw/aroll/b-clip.mp4', path: 'raw/aroll/b-clip.mp4', kind: 'video' })),
      catalogAsset('aroll', mediaAsset({ id: 'raw/aroll/a-clip.mp4', path: 'raw/aroll/a-clip.mp4', kind: 'video' })),
    ]);
    const fileSystem = createFakeFileSystem();

    const result = await resolveMontageInputs(
      project,
      catalog,
      { arollAssetId: 'raw/aroll/b-clip.mp4' },
      { readTextFile: fileSystem.readTextFile },
    );

    expect(result.arollAsset.id).toBe('raw/aroll/b-clip.mp4');
  });

  it('lanza MontageInputError("aroll-asset-not-found") si el arollAssetId pedido no existe', async () => {
    const catalog = catalogOf([
      catalogAsset('aroll', mediaAsset({ id: 'raw/aroll/a-clip.mp4', path: 'raw/aroll/a-clip.mp4', kind: 'video' })),
    ]);
    const fileSystem = createFakeFileSystem();

    await expect(
      resolveMontageInputs(
        project,
        catalog,
        { arollAssetId: 'raw/aroll/missing.mp4' },
        { readTextFile: fileSystem.readTextFile },
      ),
    ).rejects.toMatchObject({ reason: 'aroll-asset-not-found' });
  });

  it('lanza MontageInputError("no-aroll-asset") si el catálogo no tiene ningún aroll', async () => {
    const catalog = catalogOf([
      catalogAsset('broll', mediaAsset({ id: 'raw/broll/x.mp4', path: 'raw/broll/x.mp4', kind: 'video' })),
    ]);
    const fileSystem = createFakeFileSystem();

    await expect(
      resolveMontageInputs(project, catalog, {}, { readTextFile: fileSystem.readTextFile }),
    ).rejects.toBeInstanceOf(MontageInputError);
  });

  it('sin musicAssetId, elige el primer asset de role audio por assetId ascendente, o ninguno', async () => {
    const catalogWithMusic = catalogOf([
      catalogAsset('aroll', mediaAsset({ id: 'raw/aroll/a-clip.mp4', path: 'raw/aroll/a-clip.mp4', kind: 'video' })),
      catalogAsset('audio', mediaAsset({ id: 'raw/audio/b.mp3', path: 'raw/audio/b.mp3', kind: 'audio' })),
      catalogAsset('audio', mediaAsset({ id: 'raw/audio/a.mp3', path: 'raw/audio/a.mp3', kind: 'audio' })),
    ]);
    const fileSystem = createFakeFileSystem();

    const withMusic = await resolveMontageInputs(
      project,
      catalogWithMusic,
      {},
      { readTextFile: fileSystem.readTextFile },
    );
    expect(withMusic.musicAsset?.id).toBe('raw/audio/a.mp3');

    const catalogWithoutMusic = catalogOf([
      catalogAsset('aroll', mediaAsset({ id: 'raw/aroll/a-clip.mp4', path: 'raw/aroll/a-clip.mp4', kind: 'video' })),
    ]);
    const withoutMusic = await resolveMontageInputs(
      project,
      catalogWithoutMusic,
      {},
      { readTextFile: fileSystem.readTextFile },
    );
    expect(withoutMusic.musicAsset).toBeUndefined();
  });

  it('respeta musicAssetId cuando se especifica y existe', async () => {
    const catalog = catalogOf([
      catalogAsset('aroll', mediaAsset({ id: 'raw/aroll/a-clip.mp4', path: 'raw/aroll/a-clip.mp4', kind: 'video' })),
      catalogAsset('audio', mediaAsset({ id: 'raw/audio/b.mp3', path: 'raw/audio/b.mp3', kind: 'audio' })),
      catalogAsset('audio', mediaAsset({ id: 'raw/audio/a.mp3', path: 'raw/audio/a.mp3', kind: 'audio' })),
    ]);
    const fileSystem = createFakeFileSystem();

    const result = await resolveMontageInputs(
      project,
      catalog,
      { musicAssetId: 'raw/audio/b.mp3' },
      { readTextFile: fileSystem.readTextFile },
    );

    expect(result.musicAsset?.id).toBe('raw/audio/b.mp3');
  });

  it('lanza MontageInputError("music-asset-not-found") si el musicAssetId pedido no existe', async () => {
    const catalog = catalogOf([
      catalogAsset('aroll', mediaAsset({ id: 'raw/aroll/a-clip.mp4', path: 'raw/aroll/a-clip.mp4', kind: 'video' })),
    ]);
    const fileSystem = createFakeFileSystem();

    await expect(
      resolveMontageInputs(
        project,
        catalog,
        { musicAssetId: 'raw/audio/missing.mp3' },
        { readTextFile: fileSystem.readTextFile },
      ),
    ).rejects.toMatchObject({ reason: 'music-asset-not-found' });
  });

  it('transcriptionSource "missing": sin TranscriptRef para el aroll, produce una transcripción vacía sin lanzar', async () => {
    const catalog = catalogOf([
      catalogAsset('aroll', mediaAsset({ id: 'raw/aroll/a-clip.mp4', path: 'raw/aroll/a-clip.mp4', kind: 'video' })),
    ]);
    const fileSystem = createFakeFileSystem();

    const result = await resolveMontageInputs(project, catalog, {}, { readTextFile: fileSystem.readTextFile });

    expect(result.transcriptionSource).toBe('missing');
    expect(result.transcription.words).toEqual([]);
  });

  it('transcriptionSource "unreadable": el archivo referenciado no existe', async () => {
    const catalog = catalogOf(
      [catalogAsset('aroll', mediaAsset({ id: 'raw/aroll/a-clip.mp4', path: 'raw/aroll/a-clip.mp4', kind: 'video' }))],
      [transcriptRef('raw/aroll/a-clip.mp4', 'aroll/a-clip')],
    );
    const fileSystem = createFakeFileSystem();

    const result = await resolveMontageInputs(project, catalog, {}, { readTextFile: fileSystem.readTextFile });

    expect(result.transcriptionSource).toBe('unreadable');
  });

  it('transcriptionSource "unreadable": el archivo existe pero no es JSON válido', async () => {
    const catalog = catalogOf(
      [catalogAsset('aroll', mediaAsset({ id: 'raw/aroll/a-clip.mp4', path: 'raw/aroll/a-clip.mp4', kind: 'video' }))],
      [transcriptRef('raw/aroll/a-clip.mp4', 'aroll/a-clip')],
    );
    const fileSystem = createFakeFileSystem([
      { path: toAbsolutePath(project, transcriptPath('aroll/a-clip')), contents: 'not-json' },
    ]);

    const result = await resolveMontageInputs(project, catalog, {}, { readTextFile: fileSystem.readTextFile });

    expect(result.transcriptionSource).toBe('unreadable');
  });

  it('transcriptionSource "unreadable": el archivo es JSON válido pero no cumple TranscriptionSchema', async () => {
    const catalog = catalogOf(
      [catalogAsset('aroll', mediaAsset({ id: 'raw/aroll/a-clip.mp4', path: 'raw/aroll/a-clip.mp4', kind: 'video' }))],
      [transcriptRef('raw/aroll/a-clip.mp4', 'aroll/a-clip')],
    );
    const fileSystem = createFakeFileSystem([
      { path: toAbsolutePath(project, transcriptPath('aroll/a-clip')), contents: JSON.stringify({ foo: 'bar' }) },
    ]);

    const result = await resolveMontageInputs(project, catalog, {}, { readTextFile: fileSystem.readTextFile });

    expect(result.transcriptionSource).toBe('unreadable');
  });

  it('respeta options.outputPreset cuando se especifica', async () => {
    const catalog = catalogOf([
      catalogAsset('aroll', mediaAsset({ id: 'raw/aroll/a-clip.mp4', path: 'raw/aroll/a-clip.mp4', kind: 'video' })),
    ]);
    const fileSystem = createFakeFileSystem();

    const result = await resolveMontageInputs(
      project,
      catalog,
      { outputPreset: 'youtube-16x9' },
      { readTextFile: fileSystem.readTextFile },
    );

    expect(result.format.preset).toBe('youtube-16x9');
  });
});
