import type { Catalog } from '../catalog/catalog.schema';
import type { MediaAsset, SceneAssignment, StoryboardDocument, Transcription, VoiceManifest } from '@video-maker/timeline-core';
import { validateTimeline } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { createFakeFileSystem } from '../__fixtures__/fake-file-system';
import type { FakeFileSystem, FakeFileSystemFileInit } from '../__fixtures__/fake-file-system';
import { AssembleInputError } from '../errors/assemble-input-error';
import { resolveMediaProject } from '../project/media-project';
import {
  catalogPath,
  sceneAssignmentPath,
  storyboardDocumentPath,
  timelinePath,
  toAbsolutePath,
  voiceManifestPath,
} from '../project/project-paths';
import { assembleFromStoryboard } from './assemble-from-storyboard';

const project = resolveMediaProject('/media/demo');
const PROBED_AT = '2026-09-10T00:00:00.000Z';

function imageAsset(id: string): MediaAsset {
  return { id, kind: 'image', path: id, durationMs: 0, width: 1080, height: 1920, probedAt: PROBED_AT };
}

function videoAsset(id: string): MediaAsset {
  return {
    id,
    kind: 'video',
    path: id,
    durationMs: 4000,
    fps: 30,
    width: 1080,
    height: 1920,
    hasAudio: false,
    videoCodec: 'h264',
    probedAt: PROBED_AT,
  };
}

function audioAsset(id: string): MediaAsset {
  return {
    id,
    kind: 'audio',
    path: id,
    durationMs: 120_000,
    hasAudio: true,
    audio: { sampleRate: 44_100, channels: 2, codec: 'mp3' },
    probedAt: PROBED_AT,
  };
}

const catalog: Catalog = {
  schemaVersion: 1,
  projectSlug: 'demo',
  assets: [
    { role: 'audio', fingerprint: { sizeBytes: 10, modifiedAtMs: 1 }, asset: audioAsset('raw/audio/music01.mp3') },
    { role: 'broll', fingerprint: { sizeBytes: 10, modifiedAtMs: 1 }, asset: videoAsset('raw/broll/02.mp4') },
    { role: 'image', fingerprint: { sizeBytes: 10, modifiedAtMs: 1 }, asset: imageAsset('raw/images/01.png') },
  ],
  transcripts: [],
  ignored: [],
  probeFailures: [],
};

const storyboard: StoryboardDocument = {
  schemaVersion: 1,
  id: 'storyboard-demo',
  source: 'brief',
  createdAt: '2026-09-10T12:00:00.000Z',
  title: 'Demo',
  language: 'es-AR',
  format: '9:16',
  captionsStyle: 'kinetic-bold',
  musicTags: [],
  characters: [],
  scenes: [
    {
      id: 'scene-01',
      index: 1,
      narration: 'Primero el plano.',
      visualPrompt: 'A kitchen at dawn.',
      visualSource: 'upload',
      estimatedDurationMs: 9000,
      musicTags: [],
      sfxTags: [],
    },
    {
      id: 'scene-02',
      index: 2,
      narration: 'Después el título.',
      visualPrompt: 'A bold title card.',
      visualSource: 'remotion-scene',
      remotionScene: { kind: 'title', title: 'Escena dos' },
      estimatedDurationMs: 2000,
      musicTags: [],
      sfxTags: [],
    },
  ],
};

const voice: VoiceManifest = {
  schemaVersion: 1,
  storyboardId: 'storyboard-demo',
  language: 'es-AR',
  tracks: [
    {
      sceneId: 'scene-01',
      index: 1,
      source: 'generated',
      path: 'work/voice/scene-01.wav',
      wordsPath: 'work/voice/scene-01.words.json',
      durationMs: 3000,
      sampleRate: 48_000,
      voiceId: 'es_AR-daniela-high',
      narrationHash: 'hash-01',
      updatedAt: '2026-09-10T12:00:00.000Z',
    },
  ],
};

const sceneOneWords: Transcription = {
  assetId: 'work/voice/scene-01.wav',
  engine: 'whisper.cpp',
  language: 'es',
  words: [
    { text: 'Primero', startMs: 0, endMs: 600 },
    { text: 'el', startMs: 620, endMs: 800 },
    { text: 'plano', startMs: 820, endMs: 1600, confidence: 0.9 },
  ],
  segments: [],
};

const assignment: SceneAssignment = {
  schemaVersion: 1,
  storyboardId: 'storyboard-demo',
  assignments: [{ sceneId: 'scene-01', assetId: 'raw/images/01.png' }],
};

interface FixtureOverrides {
  readonly storyboardJson?: unknown;
  readonly withCatalog?: boolean;
  readonly withVoice?: boolean;
  readonly voiceJson?: unknown;
  readonly withWords?: boolean;
  readonly assignmentJson?: unknown;
}

function fileSystemFor(overrides: FixtureOverrides = {}): FakeFileSystem {
  const files: FakeFileSystemFileInit[] = [
    {
      path: toAbsolutePath(project, storyboardDocumentPath()),
      contents: JSON.stringify(overrides.storyboardJson ?? storyboard),
    },
  ];

  if (overrides.withCatalog !== false) {
    files.push({ path: toAbsolutePath(project, catalogPath()), contents: JSON.stringify(catalog) });
  }
  if (overrides.withVoice !== false) {
    files.push({
      path: toAbsolutePath(project, voiceManifestPath()),
      contents: JSON.stringify(overrides.voiceJson ?? voice),
    });
  }
  if (overrides.withWords !== false) {
    files.push({
      path: toAbsolutePath(project, 'work/voice/scene-01.words.json'),
      contents: JSON.stringify(sceneOneWords),
    });
  }
  if (overrides.assignmentJson !== undefined) {
    files.push({
      path: toAbsolutePath(project, sceneAssignmentPath()),
      contents: JSON.stringify(overrides.assignmentJson),
    });
  }

  return createFakeFileSystem(files);
}

function depsOf(fileSystem: FakeFileSystem) {
  return {
    readTextFile: fileSystem.readTextFile,
    writeTextFile: fileSystem.writeTextFile,
    ensureDirectory: fileSystem.ensureDirectory,
  };
}

describe('assembleFromStoryboard', () => {
  it('escribe work/timeline.json con el mismo escritor que autoMontage y deja la Timeline válida', async () => {
    const fileSystem = fileSystemFor({ assignmentJson: assignment });

    const result = await assembleFromStoryboard(project, depsOf(fileSystem));

    expect(result.timelinePath).toBe(timelinePath());
    const written = fileSystem.readFile(toAbsolutePath(project, timelinePath()));
    expect(written).toBe(`${JSON.stringify(result.timeline, null, 2)}\n`);
    expect(validateTimeline(result.timeline)).toEqual({ ok: true });
  });

  it('mezcla los assets del catálogo con las pistas de voz del manifest', async () => {
    const fileSystem = fileSystemFor({ assignmentJson: assignment });

    const result = await assembleFromStoryboard(project, depsOf(fileSystem));

    expect(result.timeline.assets.map((asset) => asset.id)).toEqual([
      'raw/audio/music01.mp3',
      'raw/broll/02.mp4',
      'raw/images/01.png',
      'work/voice/scene-01.wav',
    ]);
    expect(result.timeline.tracks.voice).toHaveLength(1);
  });

  it('deriva el formato de salida del formato del storyboard', async () => {
    const portrait = await assembleFromStoryboard(project, depsOf(fileSystemFor()));
    const landscape = await assembleFromStoryboard(
      project,
      depsOf(fileSystemFor({ storyboardJson: { ...storyboard, format: '16:9' } })),
    );

    expect(portrait.format.preset).toBe('reels-9x16');
    expect(landscape.format.preset).toBe('youtube-16x9');
    expect(landscape.format.width).toBe(1920);
  });

  it('lee los words.json del manifest y los convierte en captions', async () => {
    const result = await assembleFromStoryboard(project, depsOf(fileSystemFor()));

    expect(result.timeline.tracks.captions.length).toBeGreaterThan(0);
    expect(result.timeline.tracks.captions[0]?.words[0]?.text).toBe('Primero');
  });

  it('sigue ensamblando cuando falta el words.json de una escena', async () => {
    const result = await assembleFromStoryboard(project, depsOf(fileSystemFor({ withWords: false })));

    expect(result.timeline.tracks.captions).toEqual([]);
    expect(validateTimeline(result.timeline)).toEqual({ ok: true });
  });

  it('reporta las escenas sin voz y sin visual asignado', async () => {
    const result = await assembleFromStoryboard(project, depsOf(fileSystemFor()));

    expect(result.scenesWithVoice).toBe(1);
    expect(result.scenesWithoutVoice).toEqual(['scene-02']);
    expect(result.scenesWithoutVisual).toEqual(['scene-01']);
  });

  it('ensambla sin voz en absoluto, cayendo en las duraciones estimadas', async () => {
    const result = await assembleFromStoryboard(
      project,
      depsOf(fileSystemFor({ withVoice: false, withWords: false })),
    );

    expect(result.scenesWithVoice).toBe(0);
    expect(result.timeline.tracks.voice).toEqual([]);
    expect(result.timeline.durationFrames).toBe(Math.round((9000 / 1000) * 30) + Math.round((2000 / 1000) * 30));
  });

  it('agrega la música pedida sólo si está en el catálogo', async () => {
    const withMusic = await assembleFromStoryboard(project, depsOf(fileSystemFor()), {
      musicAssetId: 'raw/audio/music01.mp3',
    });
    const withGhostMusic = await assembleFromStoryboard(project, depsOf(fileSystemFor()), {
      musicAssetId: 'raw/audio/ghost.mp3',
    });

    expect(withMusic.timeline.tracks.music).toHaveLength(1);
    expect(withGhostMusic.timeline.tracks.music).toEqual([]);
  });

  it('con persist: false no toca el filesystem', async () => {
    const fileSystem = fileSystemFor();

    await assembleFromStoryboard(project, depsOf(fileSystem), { persist: false });

    expect(fileSystem.readFile(toAbsolutePath(project, timelinePath()))).toBeUndefined();
  });

  it('rechaza un proyecto sin storyboard', async () => {
    const fileSystem = createFakeFileSystem([
      { path: toAbsolutePath(project, catalogPath()), contents: JSON.stringify(catalog) },
    ]);

    await expect(assembleFromStoryboard(project, depsOf(fileSystem))).rejects.toMatchObject({
      code: 'ASSEMBLE_INPUT_INVALID',
      reason: 'storyboard-missing',
    });
  });

  it('rechaza un storyboard que no cumple su schema', async () => {
    const fileSystem = fileSystemFor({ storyboardJson: { schemaVersion: 1, scenes: [] } });

    await expect(assembleFromStoryboard(project, depsOf(fileSystem))).rejects.toBeInstanceOf(AssembleInputError);
  });

  it('rechaza un proyecto sin catálogo, que es pedir la ingesta primero', async () => {
    const fileSystem = fileSystemFor({ withCatalog: false });

    await expect(assembleFromStoryboard(project, depsOf(fileSystem))).rejects.toMatchObject({
      reason: 'catalog-missing',
    });
  });

  it('rechaza un manifest de voz corrupto en vez de ensamblar sin voz en silencio', async () => {
    const fileSystem = fileSystemFor({ voiceJson: { schemaVersion: 1, tracks: 'nope' } });

    await expect(assembleFromStoryboard(project, depsOf(fileSystem))).rejects.toMatchObject({
      reason: 'voice-invalid',
    });
  });

  it('rechaza una asignación de escenas corrupta', async () => {
    const fileSystem = fileSystemFor({ assignmentJson: { schemaVersion: 2, assignments: [] } });

    await expect(assembleFromStoryboard(project, depsOf(fileSystem))).rejects.toMatchObject({
      reason: 'assignment-invalid',
    });
  });

  it('es determinista: dos corridas escriben los mismos bytes', async () => {
    const first = fileSystemFor({ assignmentJson: assignment });
    const second = fileSystemFor({ assignmentJson: assignment });

    await assembleFromStoryboard(project, depsOf(first));
    await assembleFromStoryboard(project, depsOf(second));

    expect(first.readFile(toAbsolutePath(project, timelinePath()))).toBe(
      second.readFile(toAbsolutePath(project, timelinePath())),
    );
  });
});
