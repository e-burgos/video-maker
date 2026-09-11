import type { MediaAsset } from '@video-maker/timeline-core';
import { validateTimeline } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { autoMontage } from './auto-montage';
import { createFakeFileSystem } from './__fixtures__/fake-file-system';
import type { Catalog, CatalogAsset } from './catalog/catalog.schema';
import { CATALOG_SCHEMA_VERSION } from './catalog/catalog.schema';
import { resolveMediaProject } from './project/media-project';
import { catalogPath, toAbsolutePath } from './project/project-paths';
import { voiceScriptManifestPath, voiceScriptTrackPath, voiceScriptWordsPath } from './voice/voice-script-paths';

const project = resolveMediaProject('/tmp/media/display-ads');

const SILENT_AROLL: MediaAsset = {
  id: 'raw/aroll/screen.mp4',
  kind: 'video',
  path: 'raw/aroll/screen.mp4',
  durationMs: 20_000,
  fps: 30,
  width: 1920,
  height: 1080,
  hasAudio: false,
  probedAt: '2026-01-01T00:00:00.000Z',
};

const BROLL: MediaAsset = {
  id: 'raw/broll/terminal.mp4',
  kind: 'video',
  path: 'raw/broll/terminal.mp4',
  durationMs: 8000,
  fps: 30,
  width: 1920,
  height: 1080,
  hasAudio: false,
  probedAt: '2026-01-01T00:00:00.000Z',
};

function catalogAsset(role: CatalogAsset['role'], asset: MediaAsset): CatalogAsset {
  return { role, fingerprint: { sizeBytes: 1000, modifiedAtMs: 0 }, asset };
}

const CATALOG: Catalog = {
  schemaVersion: CATALOG_SCHEMA_VERSION,
  projectSlug: project.slug,
  assets: [catalogAsset('aroll', SILENT_AROLL), catalogAsset('broll', BROLL)],
  transcripts: [],
  ignored: [],
  probeFailures: [],
};

function word(text: string, startMs: number, endMs: number) {
  return { text, startMs, endMs };
}

const VOICE_WORDS = {
  assetId: voiceScriptTrackPath(),
  engine: 'whisper.cpp' as const,
  language: 'es',
  words: [
    word('abrimos', 0, 600),
    word('la', 600, 800),
    word('terminal', 800, 1400),
    word('escribimos', 2600, 3300),
    word('en', 3300, 3500),
    word('la', 3500, 3700),
    word('terminal', 3700, 4300),
    word('y', 5500, 5700),
    word('volvemos', 5700, 6400),
    word('a', 6400, 6500),
    word('la', 6500, 6700),
    word('terminal', 6700, 7300),
  ],
  segments: [],
};

function manifest(durationMs: number) {
  return {
    schemaVersion: 1,
    source: 'script',
    language: 'es',
    voiceId: 'es_AR-daniela-high',
    gapMs: 900,
    path: voiceScriptTrackPath(),
    wordsPath: voiceScriptWordsPath(),
    durationMs,
    sampleRate: 48_000,
    updatedAt: '2026-01-01T00:00:00.000Z',
    lines: [
      { index: 1, text: 'abrimos la terminal', path: 'work/voice/sources/line-01.wav', startMs: 0, durationMs: 2000 },
    ],
  };
}

function buildFileSystem(voiceDurationMs = 8000) {
  return createFakeFileSystem([
    { path: toAbsolutePath(project, catalogPath()), contents: JSON.stringify(CATALOG) },
    {
      path: toAbsolutePath(project, voiceScriptManifestPath()),
      contents: JSON.stringify(manifest(voiceDurationMs)),
    },
    { path: toAbsolutePath(project, voiceScriptWordsPath()), contents: JSON.stringify(VOICE_WORDS) },
  ]);
}

function run(
  fileSystem: ReturnType<typeof createFakeFileSystem>,
  options: Partial<Parameters<typeof autoMontage>[1]> = {},
) {
  return autoMontage(
    project,
    { preset: 'software-demo', seed: 0, outputPreset: 'youtube-16x9', voice: 'script', ...options },
    {
      readTextFile: fileSystem.readTextFile,
      writeTextFile: fileSystem.writeTextFile,
      ensureDirectory: fileSystem.ensureDirectory,
    },
  );
}

describe('autoMontage — voice: script (FIX-e-burgos-007-002)', () => {
  it('toma el habla del wav sintetizado y deja una Timeline válida con captions y un único tramo de A-roll', async () => {
    const result = await run(buildFileSystem());

    const validation = validateTimeline(result.timeline);
    expect(validation.ok ? [] : validation.issues).toEqual([]);

    expect(result.voiceSource).toBe('script');
    expect(result.transcriptionSource).toBe('voice-script');
    expect(result.timeline.tracks.aroll).toHaveLength(1);
    expect(result.timeline.tracks.voice).toHaveLength(1);
    expect(result.timeline.tracks.voice[0]?.assetId).toBe('work/voice/voice.wav');
    expect(result.timeline.tracks.voice[0]?.from).toBe(0);
    expect(result.timeline.tracks.voice[0]?.trimStartMs).toBe(0);
    expect(result.timeline.tracks.captions.length).toBeGreaterThan(0);
    expect(result.concepts.map((concept) => concept.term)).toContain('terminal');
    expect(result.edl.decisions.filter((decision) => decision.type === 'keep')).toHaveLength(1);
    expect(result.edl.decisions.filter((decision) => decision.type === 'cut')).toHaveLength(0);
  });

  it('publica el wav como asset de audio propio de la Timeline', async () => {
    const result = await run(buildFileSystem());

    expect(result.timeline.assets.find((asset) => asset.id === 'work/voice/voice.wav')).toEqual({
      id: 'work/voice/voice.wav',
      kind: 'audio',
      path: 'work/voice/voice.wav',
      durationMs: 8000,
      probedAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('las captions llevan las palabras del guion, no las del A-roll mudo', async () => {
    const result = await run(buildFileSystem());

    const captionWords = result.timeline.tracks.captions.flatMap((caption) =>
      caption.words.map((entry) => entry.text),
    );

    expect(captionWords).toContain('terminal');
  });

  it('con la voz más corta que el A-roll el video termina con la voz y no reporta recorte', async () => {
    const result = await run(buildFileSystem(8000));

    expect(result.voiceTrack).toEqual({
      assetId: 'work/voice/voice.wav',
      durationMs: 8000,
      truncatedMs: 0,
    });
    expect(result.editedDurationMs).toBeLessThan(SILENT_AROLL.durationMs);
  });

  it('con la voz más larga que el A-roll corta la voz y reporta cuánto quedó afuera', async () => {
    const result = await run(buildFileSystem(26_000));

    expect(result.voiceTrack).toEqual({
      assetId: 'work/voice/voice.wav',
      durationMs: 26_000,
      truncatedMs: 6000,
    });
    const validation = validateTimeline(result.timeline);
    expect(validation.ok ? [] : validation.issues).toEqual([]);
  });

  it('--prune-silences fuerza los cortes por silencio también en modo guion', async () => {
    const result = await run(buildFileSystem(), { pruneSilences: true });

    expect(result.edl.decisions.filter((decision) => decision.type === 'keep').length).toBeGreaterThan(1);
    const validation = validateTimeline(result.timeline);
    expect(validation.ok ? [] : validation.issues).toEqual([]);
  });

  it('con una voz más corta que un frame falla con empty-voice-track', async () => {
    await expect(run(buildFileSystem(10))).rejects.toMatchObject({ reason: 'empty-voice-track' });
  });

  it('sin la pista sintetizada falla con voice-track-missing', async () => {
    const fileSystem = createFakeFileSystem([
      { path: toAbsolutePath(project, catalogPath()), contents: JSON.stringify(CATALOG) },
    ]);

    await expect(run(fileSystem)).rejects.toMatchObject({ reason: 'voice-track-missing' });
  });

  it('el default sigue siendo el A-roll: sin voice no lee la pista sintetizada', async () => {
    const fileSystem = createFakeFileSystem([
      { path: toAbsolutePath(project, catalogPath()), contents: JSON.stringify(CATALOG) },
    ]);

    const result = await run(fileSystem, { voice: 'aroll' });

    expect(result.voiceSource).toBe('aroll');
    expect(result.voiceTrack).toBeNull();
    expect(result.transcriptionSource).toBe('missing');
    expect(result.timeline.tracks.voice[0]?.assetId).toBe(SILENT_AROLL.id);
  });
});
