import type { MediaAsset } from '@video-maker/timeline-core';
import { validateTimeline } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { autoMontage } from './auto-montage';
import { createFakeFileSystem } from './__fixtures__/fake-file-system';
import type { Catalog, CatalogAsset } from './catalog/catalog.schema';
import { CATALOG_SCHEMA_VERSION } from './catalog/catalog.schema';
import { MontageInputError } from './errors/montage-input-error';
import { resolveMediaProject } from './project/media-project';
import { catalogPath, toAbsolutePath, transcriptPath } from './project/project-paths';

const project = resolveMediaProject('/tmp/media/ca-011');

function videoAsset(init: Partial<MediaAsset> & Pick<MediaAsset, 'id' | 'path'>): MediaAsset {
  return {
    kind: 'video',
    durationMs: 8000,
    fps: 30,
    width: 1080,
    height: 1920,
    hasAudio: true,
    probedAt: '2026-01-01T00:00:00.000Z',
    ...init,
  };
}

function catalogAsset(role: CatalogAsset['role'], asset: MediaAsset): CatalogAsset {
  return { role, fingerprint: { sizeBytes: 1000, modifiedAtMs: 0 }, asset };
}

function word(text: string, startMs: number, endMs: number) {
  return { text, startMs, endMs };
}

function buildFixtureFileSystem() {
  const arollAsset = videoAsset({
    id: 'raw/aroll/demo.mp4',
    path: 'raw/aroll/demo.mp4',
    durationMs: 12_000,
  });
  const brollAsset = videoAsset({
    id: 'raw/broll/terminal.mp4',
    path: 'raw/broll/terminal.mp4',
    durationMs: 8000,
    hasAudio: false,
  });
  const audioAsset: MediaAsset = {
    id: 'raw/audio/beat.mp3',
    kind: 'audio',
    path: 'raw/audio/beat.mp3',
    durationMs: 30_000,
    hasAudio: true,
    probedAt: '2026-01-01T00:00:00.000Z',
  };

  const catalog: Catalog = {
    schemaVersion: CATALOG_SCHEMA_VERSION,
    projectSlug: project.slug,
    assets: [
      catalogAsset('aroll', arollAsset),
      catalogAsset('audio', audioAsset),
      catalogAsset('broll', brollAsset),
    ],
    transcripts: [
      {
        assetId: arollAsset.id,
        transcriptPath: transcriptPath('aroll/demo'),
        fingerprint: { sizeBytes: 1000, modifiedAtMs: 0 },
        engine: 'whisper.cpp',
        model: 'base',
        language: 'es',
      },
    ],
    ignored: [],
    probeFailures: [],
  };

  const transcription = {
    assetId: arollAsset.id,
    engine: 'whisper.cpp' as const,
    language: 'es',
    words: [
      word('hola', 0, 300),
      word('vamos', 300, 600),
      word('a', 600, 700),
      word('abrir', 700, 1000),
      word('la', 1600, 1700),
      word('terminal', 1700, 2200),
      word('y', 2200, 2300),
      word('ejecutamos', 2300, 2800),
      word('el', 2900, 3000),
      word('comando', 3000, 3500),
      word('listo', 3500, 3800),
    ],
    segments: [],
  };

  return createFakeFileSystem([
    { path: toAbsolutePath(project, catalogPath()), contents: JSON.stringify(catalog) },
    {
      path: toAbsolutePath(project, transcriptPath('aroll/demo')),
      contents: JSON.stringify(transcription),
    },
  ]);
}

describe('autoMontage (CA-011)', () => {
  it('produce una Timeline que pasa validateTimeline sin ningún issue', async () => {
    const fileSystem = buildFixtureFileSystem();

    const result = await autoMontage(
      project,
      { preset: 'software-demo', seed: 42 },
      {
        readTextFile: fileSystem.readTextFile,
        writeTextFile: fileSystem.writeTextFile,
        ensureDirectory: fileSystem.ensureDirectory,
      },
    );

    const validation = validateTimeline(result.timeline);
    expect(validation.ok ? [] : validation.issues).toEqual([]);
    expect(validation.ok).toBe(true);

    expect(result.edl.sourceAssetId).toBe('raw/aroll/demo.mp4');
    expect(result.transcriptionSource).toBe('catalog');
    expect(result.stopwordLanguage).toBe('es');
    expect(result.concepts.some((concept) => concept.term === 'terminal')).toBe(true);
    expect(result.brollOverlays.length).toBeGreaterThan(0);
    expect(result.editedDurationMs).toBeGreaterThan(0);
    expect(result.edlPath).toBe('work/edl.json');
    expect(result.timelinePath).toBe('work/timeline.json');
    expect(fileSystem.readFile(toAbsolutePath(project, result.edlPath))).toBeDefined();
    expect(fileSystem.readFile(toAbsolutePath(project, result.timelinePath))).toBeDefined();
  });

  it('resuelve el preset por nombre y lanza MontageInputError("unknown-preset") si no existe', async () => {
    const fileSystem = buildFixtureFileSystem();

    await expect(
      autoMontage(
        project,
        { preset: 'cinematic' as never, seed: 1 },
        { readTextFile: fileSystem.readTextFile },
      ),
    ).rejects.toBeInstanceOf(MontageInputError);
  });

  it('lanza MontageInputError("empty-aroll") cuando el A-roll es tan corto que ni un keep sobrevive (D-20)', async () => {
    const arollAsset = videoAsset({
      id: 'raw/aroll/tiny.mp4',
      path: 'raw/aroll/tiny.mp4',
      durationMs: 1,
    });
    const catalog: Catalog = {
      schemaVersion: CATALOG_SCHEMA_VERSION,
      projectSlug: project.slug,
      assets: [catalogAsset('aroll', arollAsset)],
      transcripts: [],
      ignored: [],
      probeFailures: [],
    };
    const fileSystem = createFakeFileSystem([
      { path: toAbsolutePath(project, catalogPath()), contents: JSON.stringify(catalog) },
    ]);

    await expect(
      autoMontage(project, { preset: 'software-demo', seed: 1 }, { readTextFile: fileSystem.readTextFile }),
    ).rejects.toMatchObject({ reason: 'empty-aroll' });
  });

  it('RN-17/D-19: sin ningún asset de broll/ ni images/, los conceptos se rechazan de forma observable, sin reventar', async () => {
    const arollAsset = videoAsset({
      id: 'raw/aroll/sin-broll.mp4',
      path: 'raw/aroll/sin-broll.mp4',
      durationMs: 8000,
    });
    const catalog: Catalog = {
      schemaVersion: CATALOG_SCHEMA_VERSION,
      projectSlug: project.slug,
      assets: [catalogAsset('aroll', arollAsset)],
      transcripts: [
        {
          assetId: arollAsset.id,
          transcriptPath: transcriptPath('aroll/sin-broll'),
          fingerprint: { sizeBytes: 1000, modifiedAtMs: 0 },
          engine: 'whisper.cpp',
          model: 'base',
          language: 'es',
        },
      ],
      ignored: [],
      probeFailures: [],
    };
    const transcription = {
      assetId: arollAsset.id,
      engine: 'whisper.cpp' as const,
      language: 'es',
      words: [word('abrir', 0, 300), word('la', 300, 400), word('terminal', 400, 900)],
      segments: [],
    };
    const fileSystem = createFakeFileSystem([
      { path: toAbsolutePath(project, catalogPath()), contents: JSON.stringify(catalog) },
      {
        path: toAbsolutePath(project, transcriptPath('aroll/sin-broll')),
        contents: JSON.stringify(transcription),
      },
    ]);

    const result = await autoMontage(
      project,
      { preset: 'software-demo', seed: 1, persist: false },
      { readTextFile: fileSystem.readTextFile },
    );

    expect(result.concepts.some((concept) => concept.term === 'terminal')).toBe(true);
    expect(result.brollOverlays).toEqual([]);
    expect(result.brollRejections.length).toBeGreaterThan(0);
    expect(result.brollRejections.every((rejection) => rejection.reason === 'no-candidate')).toBe(true);
    expect(validateTimeline(result.timeline).ok).toBe(true);
  });

  it('RN-17: A-roll sin silencios detectables produce un único keep que cubre todo el material, sin reventar', async () => {
    const arollAsset = videoAsset({
      id: 'raw/aroll/sin-silencios.mp4',
      path: 'raw/aroll/sin-silencios.mp4',
      durationMs: 8000,
    });
    const catalog: Catalog = {
      schemaVersion: CATALOG_SCHEMA_VERSION,
      projectSlug: project.slug,
      assets: [catalogAsset('aroll', arollAsset)],
      transcripts: [
        {
          assetId: arollAsset.id,
          transcriptPath: transcriptPath('aroll/sin-silencios'),
          fingerprint: { sizeBytes: 1000, modifiedAtMs: 0 },
          engine: 'whisper.cpp',
          model: 'base',
          language: 'es',
        },
      ],
      ignored: [],
      probeFailures: [],
    };
    const transcription = {
      assetId: arollAsset.id,
      engine: 'whisper.cpp' as const,
      language: 'es',
      words: [
        word('hola', 0, 300),
        word('vamos', 300, 600),
        word('a', 600, 700),
        word('seguir', 700, 1000),
        word('sin', 1000, 1300),
        word('parar', 1300, 1600),
      ],
      segments: [],
    };
    const fileSystem = createFakeFileSystem([
      { path: toAbsolutePath(project, catalogPath()), contents: JSON.stringify(catalog) },
      {
        path: toAbsolutePath(project, transcriptPath('aroll/sin-silencios')),
        contents: JSON.stringify(transcription),
      },
    ]);

    const result = await autoMontage(
      project,
      { preset: 'software-demo', seed: 1, persist: false },
      { readTextFile: fileSystem.readTextFile },
    );

    const keepDecisions = result.edl.decisions.filter((decision) => decision.type === 'keep');
    const cutDecisions = result.edl.decisions.filter((decision) => decision.type === 'cut');
    expect(keepDecisions).toHaveLength(1);
    expect(cutDecisions).toHaveLength(0);
    expect(validateTimeline(result.timeline).ok).toBe(true);
  });

  it('lanza MontageInputError("catalog-missing") si no hay catálogo en work/catalog.json', async () => {
    const fileSystem = createFakeFileSystem();

    await expect(
      autoMontage(project, { preset: 'software-demo', seed: 1 }, { readTextFile: fileSystem.readTextFile }),
    ).rejects.toMatchObject({ reason: 'catalog-missing' });
  });

  it('respeta arollAssetId, musicAssetId y outputPreset explícitos', async () => {
    const arollA = videoAsset({ id: 'raw/aroll/a-clip.mp4', path: 'raw/aroll/a-clip.mp4', durationMs: 5000 });
    const arollB = videoAsset({ id: 'raw/aroll/b-clip.mp4', path: 'raw/aroll/b-clip.mp4', durationMs: 5000 });
    const musicA: MediaAsset = {
      id: 'raw/audio/a.mp3',
      kind: 'audio',
      path: 'raw/audio/a.mp3',
      durationMs: 10_000,
      hasAudio: true,
      probedAt: '2026-01-01T00:00:00.000Z',
    };
    const musicB: MediaAsset = {
      id: 'raw/audio/b.mp3',
      kind: 'audio',
      path: 'raw/audio/b.mp3',
      durationMs: 10_000,
      hasAudio: true,
      probedAt: '2026-01-01T00:00:00.000Z',
    };
    const catalog: Catalog = {
      schemaVersion: CATALOG_SCHEMA_VERSION,
      projectSlug: project.slug,
      assets: [
        catalogAsset('aroll', arollA),
        catalogAsset('aroll', arollB),
        catalogAsset('audio', musicA),
        catalogAsset('audio', musicB),
      ],
      transcripts: [],
      ignored: [],
      probeFailures: [],
    };
    const fileSystem = createFakeFileSystem([
      { path: toAbsolutePath(project, catalogPath()), contents: JSON.stringify(catalog) },
    ]);

    const result = await autoMontage(
      project,
      {
        preset: 'software-demo',
        seed: 1,
        arollAssetId: 'raw/aroll/b-clip.mp4',
        musicAssetId: 'raw/audio/b.mp3',
        outputPreset: 'youtube-16x9',
        persist: true,
      },
      {
        readTextFile: fileSystem.readTextFile,
        writeTextFile: fileSystem.writeTextFile,
        ensureDirectory: fileSystem.ensureDirectory,
      },
    );

    expect(result.edl.sourceAssetId).toBe('raw/aroll/b-clip.mp4');
    expect(result.edl.format.preset).toBe('youtube-16x9');
    expect(fileSystem.writtenFiles.size).toBe(2);
  });

  it('RN-17: transcripción vacía (sin TranscriptRef) produce cero conceptos y cero captions, Timeline válida igual; arma la Timeline sin música cuando el catálogo no tiene ningún asset de role audio', async () => {
    const arollAsset = videoAsset({ id: 'raw/aroll/solo.mp4', path: 'raw/aroll/solo.mp4', durationMs: 5000 });
    const catalog: Catalog = {
      schemaVersion: CATALOG_SCHEMA_VERSION,
      projectSlug: project.slug,
      assets: [catalogAsset('aroll', arollAsset)],
      transcripts: [],
      ignored: [],
      probeFailures: [],
    };
    const fileSystem = createFakeFileSystem([
      { path: toAbsolutePath(project, catalogPath()), contents: JSON.stringify(catalog) },
    ]);

    let writeCallCount = 0;
    const spyWriteTextFile: typeof fileSystem.writeTextFile = async (path, contents) => {
      writeCallCount += 1;
      await fileSystem.writeTextFile(path, contents);
    };

    const result = await autoMontage(
      project,
      { preset: 'software-demo', seed: 1, persist: false },
      {
        readTextFile: fileSystem.readTextFile,
        writeTextFile: spyWriteTextFile,
        ensureDirectory: fileSystem.ensureDirectory,
      },
    );

    expect(result.transcriptionSource).toBe('missing');
    expect(result.concepts).toEqual([]);
    expect(result.timeline.tracks.captions).toEqual([]);
    expect(result.timeline.tracks.music).toEqual([]);
    expect(validateTimeline(result.timeline).ok).toBe(true);
    expect(writeCallCount).toBe(0);
    expect(fileSystem.writtenFiles.size).toBe(0);
  });

  it('usa nodeReadTextFile por defecto cuando no se inyecta readTextFile', async () => {
    const emptyProject = resolveMediaProject('/tmp/media/auto-montage-ca011-no-deps-xyz');

    await expect(
      autoMontage(emptyProject, { preset: 'software-demo', seed: 1 }),
    ).rejects.toMatchObject({ reason: 'catalog-missing' });
  });
});
