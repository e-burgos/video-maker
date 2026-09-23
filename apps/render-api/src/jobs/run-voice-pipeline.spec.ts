import { resolveMediaProject, serializeMontageDocument } from '@video-maker/auto-montage';
import { emptyVoiceManifest, hashNarration, VoiceManifestSchema } from '@video-maker/timeline-core';
import type { MediaAsset, VoiceManifest, VoiceTrack } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { createCallLog } from '../__fixtures__/call-log';
import { createFakeObjectStorage } from '../__fixtures__/fake-object-storage';
import { createFakeRenderApiDependencies } from '../__fixtures__/fake-render-api-dependencies';
import { buildStoryboardDocument } from '../__fixtures__/storyboard-fixtures';
import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import { voiceManifestPath, voiceTrackPath, voiceWordsPath } from '../voice/voice-paths';
import { runVoicePipeline } from './run-voice-pipeline';
import type { VoiceJobProgress } from './render-job';
import { mergeVoiceJobProgress, startVoiceJobStage } from './voice-job-progress';
import { isVoicePipelineCanceled } from './voice-pipeline-observer';
import type { VoicePipelineObserver } from './voice-pipeline-observer';

const PROJECT_ROOT = '/var/data/media/acme-launch';
const PROJECT = resolveMediaProject(PROJECT_ROOT);
const DOCUMENT = buildStoryboardDocument();

function absolute(relativePath: string): string {
  return `${PROJECT_ROOT}/${relativePath}`;
}

function audioAsset(assetId: string, durationMs: number): MediaAsset {
  return {
    id: assetId,
    kind: 'audio',
    path: assetId,
    durationMs,
    hasAudio: true,
    audio: { sampleRate: 48000, channels: 1, codec: 'pcm_s16le' },
    probedAt: '2026-09-08T00:00:00.000Z',
  };
}

interface Harness {
  readonly deps: RenderApiDependencies;
  readonly callLog: ReturnType<typeof createCallLog>;
  readonly storage: ReturnType<typeof createFakeObjectStorage>;
  readonly progress: () => VoiceJobProgress | null;
  readonly observer: VoicePipelineObserver;
}

function createHarness(options?: {
  readonly manifest?: VoiceManifest;
  readonly storyboard?: unknown;
  readonly cancelAfter?: number;
  readonly overrides?: Partial<RenderApiDependencies>;
}): Harness {
  const callLog = createCallLog();
  const files = [
    {
      path: absolute('work/storyboard.json'),
      contents: serializeMontageDocument(options?.storyboard ?? DOCUMENT),
    },
    ...(options?.manifest === undefined
      ? []
      : [{ path: absolute(voiceManifestPath()), contents: serializeMontageDocument(options.manifest) }]),
  ];
  const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT], files });

  let durationCounter = 0;
  const deps = createFakeRenderApiDependencies(callLog, {
    storage,
    probeAsset: async ({ assetId }) => {
      durationCounter += 1;
      return audioAsset(assetId, 3000 + durationCounter * 100);
    },
    ...options?.overrides,
  });

  let progress: VoiceJobProgress | null = null;
  let checkpoints = 0;

  const observer: VoicePipelineObserver = {
    stageStarted: (stage) => {
      progress = startVoiceJobStage(progress, stage);
    },
    sceneProcessed: (stage, processed, total) => {
      progress = mergeVoiceJobProgress(progress, stage, processed, total);
    },
    cancellationRequested: () => {
      checkpoints += 1;
      return options?.cancelAfter !== undefined && checkpoints > options.cancelAfter;
    },
  };

  return { deps, callLog, storage, progress: () => progress, observer };
}

async function readManifest(storage: ReturnType<typeof createFakeObjectStorage>): Promise<VoiceManifest> {
  const raw = await storage.readTextFile(absolute(voiceManifestPath()));
  return VoiceManifestSchema.parse(JSON.parse(raw));
}

describe('runVoicePipeline (US-09-004, US-09-007)', () => {
  it('sintetiza una pista por escena con el texto de esa escena y de ninguna otra', async () => {
    const harness = createHarness();

    const report = await runVoicePipeline({ project: PROJECT, voiceId: null, sceneIds: null }, harness.deps, harness.observer);

    expect(report.scenes.map((scene) => scene.sceneId)).toEqual(['scene-01', 'scene-02', 'scene-03']);
    expect(report.manifestPath).toBe('work/voice/manifest.json');
    expect(report.storyboardId).toBe('storyboard-0001');
    expect(report.language).toBe('es-AR');

    for (const scene of DOCUMENT.scenes) {
      const written = await harness.storage.readTextFile(absolute(`work/voice/sources/${scene.id}.txt`));
      expect(written).toBe(`${scene.narration}\n`);
      for (const other of DOCUMENT.scenes.filter((candidate) => candidate.id !== scene.id)) {
        expect(written).not.toContain(other.narration);
      }
    }
  });

  it('colapsa los saltos de línea de la narración porque piper trata cada línea como una emisión', async () => {
    const multiline = buildStoryboardDocument({
      scenes: [{ ...DOCUMENT.scenes[0], narration: 'Primera oración.\nSegunda oración.' }],
    });
    const harness = createHarness({ storyboard: multiline });

    await runVoicePipeline({ project: PROJECT, voiceId: null, sceneIds: null }, harness.deps, harness.observer);

    expect(await harness.storage.readTextFile(absolute('work/voice/sources/scene-01.txt'))).toBe(
      'Primera oración. Segunda oración.\n',
    );
  });

  it('la duración de cada escena sale del audio real medido con ffprobe, no de estimatedDurationMs', async () => {
    const harness = createHarness();

    const report = await runVoicePipeline({ project: PROJECT, voiceId: null, sceneIds: null }, harness.deps, harness.observer);

    expect(report.scenes.map((scene) => scene.durationMs)).toEqual([3100, 3200, 3300]);
    expect(report.scenes.map((scene) => scene.durationMs)).not.toEqual(
      DOCUMENT.scenes.map((scene) => scene.estimatedDurationMs),
    );

    const manifest = await readManifest(harness.storage);
    expect(manifest.tracks.map((track) => track.durationMs)).toEqual([3100, 3200, 3300]);
    expect(manifest.tracks.every((track) => track.sampleRate === 48000)).toBe(true);
  });

  it('normaliza a 48 kHz para la mezcla y a 16 kHz para whisper, en ese orden por escena', async () => {
    const harness = createHarness({ storyboard: buildStoryboardDocument({ scenes: [DOCUMENT.scenes[0]] }) });

    await runVoicePipeline({ project: PROJECT, voiceId: null, sceneIds: null }, harness.deps, harness.observer);

    const extracts = harness.callLog
      .entries()
      .filter((entry) => entry.port === 'extractVoiceAudio')
      .map((entry) => entry.input as { inputPath: string; outPath: string; sampleRate: number });

    expect(extracts).toEqual([
      {
        inputPath: absolute('work/voice/sources/scene-01.wav'),
        outPath: absolute('work/voice/scene-01.wav'),
        sampleRate: 48000,
        channels: 1,
        projectRoot: PROJECT_ROOT,
      },
      {
        inputPath: absolute('work/voice/scene-01.wav'),
        outPath: absolute('work/voice/whisper/scene-01.wav'),
        sampleRate: 16000,
        channels: 1,
        projectRoot: PROJECT_ROOT,
      },
    ]);
  });

  it('todo path que cruza a un binario va absoluto: el binario corre con cwd del proyecto pero el wrapper lee el JSON desde el cwd del proceso', async () => {
    const harness = createHarness({ storyboard: buildStoryboardDocument({ scenes: [DOCUMENT.scenes[0]] }) });

    await runVoicePipeline({ project: PROJECT, voiceId: null, sceneIds: null }, harness.deps, harness.observer);

    const crossing = harness.callLog
      .entries()
      .filter((entry) => ['synthesizeVoice', 'extractVoiceAudio', 'transcribeVoice'].includes(entry.port))
      .flatMap((entry) => {
        const input = entry.input as Record<string, unknown>;
        return ['textPath', 'outPath', 'inputPath', 'wavPath', 'outBase']
          .map((key) => input[key])
          .filter((value): value is string => typeof value === 'string');
      });

    expect(crossing.length).toBeGreaterThan(0);
    for (const path of crossing) {
      expect(path.startsWith(`${PROJECT_ROOT}/`)).toBe(true);
    }

    const transcribe = harness.callLog.entries().find((entry) => entry.port === 'transcribeVoice');
    expect((transcribe?.input as { outBase: string }).outBase).toBe(
      absolute('work/voice/whisper/scene-01'),
    );
    expect((transcribe?.input as { assetId: string }).assetId).toBe('work/voice/scene-01.wav');
  });

  it('escribe las palabras con timing de cada escena en el formato de las transcripciones de ingesta', async () => {
    const harness = createHarness();

    await runVoicePipeline({ project: PROJECT, voiceId: null, sceneIds: null }, harness.deps, harness.observer);

    const words = JSON.parse(await harness.storage.readTextFile(absolute(voiceWordsPath('scene-02'))));
    expect(words.assetId).toBe(voiceTrackPath('scene-02'));
    expect(words.engine).toBe('whisper.cpp');
    expect(words.language).toBe('es');
    expect(words.words.length).toBeGreaterThan(0);
    expect(Object.keys(words.words[0]).sort()).toEqual(['endMs', 'startMs', 'text']);
  });

  it('el manifest publica hash de narración, voz y origen por escena y valida contra su schema', async () => {
    const harness = createHarness();

    await runVoicePipeline({ project: PROJECT, voiceId: null, sceneIds: null }, harness.deps, harness.observer);
    const manifest = await readManifest(harness.storage);

    expect(manifest.storyboardId).toBe('storyboard-0001');
    expect(manifest.tracks.map((track) => track.narrationHash)).toEqual(
      DOCUMENT.scenes.map((scene) => hashNarration(scene.narration)),
    );
    expect(manifest.tracks.every((track) => track.source === 'generated')).toBe(true);
    expect(manifest.tracks.every((track) => track.voiceId === 'es_AR-daniela-high')).toBe(true);
  });
});

describe('runVoicePipeline regeneración parcial (US-09-005)', () => {
  it('con sceneIds reescribe sólo esas escenas y deja intactas las demás entradas del manifest', async () => {
    const untouched: VoiceTrack = {
      sceneId: 'scene-01',
      index: 1,
      source: 'generated',
      path: voiceTrackPath('scene-01'),
      wordsPath: voiceWordsPath('scene-01'),
      durationMs: 9999,
      sampleRate: 48000,
      voiceId: 'es_ES-sharvard-medium',
      narrationHash: 'deadbeefdeadbeef',
      updatedAt: '2026-09-01T00:00:00.000Z',
    };
    const harness = createHarness({
      manifest: { ...emptyVoiceManifest(DOCUMENT.id, DOCUMENT.language), tracks: [untouched] },
    });

    const report = await runVoicePipeline(
      { project: PROJECT, voiceId: null, sceneIds: ['scene-02'] },
      harness.deps,
      harness.observer,
    );

    expect(report.scenes.map((scene) => scene.sceneId)).toEqual(['scene-02']);

    const manifest = await readManifest(harness.storage);
    expect(manifest.tracks.map((track) => track.sceneId)).toEqual(['scene-01', 'scene-02']);
    expect(manifest.tracks[0]).toEqual(untouched);

    const synthesized = harness.callLog
      .entries()
      .filter((entry) => entry.port === 'synthesizeVoice')
      .map((entry) => (entry.input as { outPath: string }).outPath);
    expect(synthesized).toEqual([absolute('work/voice/sources/scene-02.wav')]);
  });

  it('una escena con locución subida no se re-sintetiza aunque el job la seleccione', async () => {
    const uploaded: VoiceTrack = {
      sceneId: 'scene-02',
      index: 2,
      source: 'uploaded',
      path: voiceTrackPath('scene-02'),
      wordsPath: voiceWordsPath('scene-02'),
      durationMs: 7777,
      sampleRate: 48000,
      voiceId: null,
      narrationHash: hashNarration(DOCUMENT.scenes[1].narration),
      updatedAt: '2026-09-01T00:00:00.000Z',
    };
    const harness = createHarness({
      manifest: { ...emptyVoiceManifest(DOCUMENT.id, DOCUMENT.language), tracks: [uploaded] },
    });

    const report = await runVoicePipeline({ project: PROJECT, voiceId: null, sceneIds: null }, harness.deps, harness.observer);

    expect(report.scenes.map((scene) => scene.sceneId)).toEqual(['scene-01', 'scene-03']);

    const manifest = await readManifest(harness.storage);
    expect(manifest.tracks.find((track) => track.sceneId === 'scene-02')).toEqual(uploaded);
  });

  it('elige la voz pedida y la resuelve contra el directorio de voces configurado', async () => {
    const harness = createHarness();

    const report = await runVoicePipeline(
      { project: PROJECT, voiceId: 'es_ES-sharvard-medium', sceneIds: ['scene-01'] },
      harness.deps,
      harness.observer,
    );

    expect(report.voiceId).toBe('es_ES-sharvard-medium');
    const call = harness.callLog.entries().find((entry) => entry.port === 'synthesizeVoice');
    expect((call?.input as { modelPath: string }).modelPath).toBe(
      '/usr/share/tts-voices/vits-piper-es_ES-sharvard-medium',
    );
  });

  it('una voz que no está instalada es VOICE_ID_INVALID y no sintetiza nada', async () => {
    const harness = createHarness();

    await expect(
      runVoicePipeline({ project: PROJECT, voiceId: 'fr_FR-siwis-low', sceneIds: null }, harness.deps, harness.observer),
    ).rejects.toMatchObject({ code: 'VOICE_ID_INVALID', resource: 'fr_FR-siwis-low' });

    expect(harness.callLog.entries().filter((entry) => entry.port === 'synthesizeVoice')).toEqual([]);
  });

  it('sin ninguna voz instalada, pedir la default es VOICE_MODEL_UNAVAILABLE (US-017-201)', async () => {
    const harness = createHarness({ overrides: { listVoiceModels: async () => [] } });

    await expect(
      runVoicePipeline({ project: PROJECT, voiceId: null, sceneIds: null }, harness.deps, harness.observer),
    ).rejects.toMatchObject({ code: 'VOICE_MODEL_UNAVAILABLE' });

    expect(harness.callLog.entries().filter((entry) => entry.port === 'synthesizeVoice')).toEqual([]);
  });
});

describe('runVoicePipeline fallos y cancelación (US-09-004)', () => {
  it('sin storyboard persistido falla con STORYBOARD_NOT_FOUND antes de tocar ningún binario', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });
    const deps = createFakeRenderApiDependencies(callLog, { storage });

    await expect(
      runVoicePipeline({ project: PROJECT, voiceId: null, sceneIds: null }, deps, {
        stageStarted: () => undefined,
        sceneProcessed: () => undefined,
        cancellationRequested: () => false,
      }),
    ).rejects.toMatchObject({ code: 'STORYBOARD_NOT_FOUND' });

    expect(callLog.entries().filter((entry) => entry.port === 'synthesizeVoice')).toEqual([]);
  });

  it('un fallo del sintetizador se reporta como VOICE_SYNTHESIS_FAILED con la escena como resource', async () => {
    const harness = createHarness({
      overrides: {
        synthesizeVoice: async () => {
          throw new Error('piper exited with 1');
        },
      },
    });

    await expect(
      runVoicePipeline({ project: PROJECT, voiceId: null, sceneIds: null }, harness.deps, harness.observer),
    ).rejects.toMatchObject({ code: 'VOICE_SYNTHESIS_FAILED', stage: 'synthesize', resource: 'scene-01' });
  });

  it('un fallo del transcriptor se reporta como VOICE_TRANSCRIPTION_FAILED sin escribir el manifest', async () => {
    const harness = createHarness({
      overrides: {
        transcribeVoice: async () => {
          throw new Error('whisper wrote no json');
        },
      },
    });

    await expect(
      runVoicePipeline({ project: PROJECT, voiceId: null, sceneIds: null }, harness.deps, harness.observer),
    ).rejects.toMatchObject({ code: 'VOICE_TRANSCRIPTION_FAILED', stage: 'transcribe' });

    await expect(harness.storage.stat(absolute(voiceManifestPath()))).resolves.toBeNull();
  });

  it('la cancelación es cooperativa entre escenas y no deja el manifest a medias', async () => {
    const harness = createHarness({ cancelAfter: 2 });

    const error = await runVoicePipeline(
      { project: PROJECT, voiceId: null, sceneIds: null },
      harness.deps,
      harness.observer,
    ).catch((cause: unknown) => cause);

    expect(isVoicePipelineCanceled(error)).toBe(true);
    await expect(harness.storage.stat(absolute(voiceManifestPath()))).resolves.toBeNull();
  });

  it('el progreso avanza por escena, es monótono y termina en persist', async () => {
    const snapshots: VoiceJobProgress[] = [];
    let progress: VoiceJobProgress | null = null;
    const observer: VoicePipelineObserver = {
      stageStarted: (stage) => {
        progress = startVoiceJobStage(progress, stage);
        snapshots.push(progress);
      },
      sceneProcessed: (stage, processed, total) => {
        progress = mergeVoiceJobProgress(progress, stage, processed, total);
        snapshots.push(progress);
      },
      cancellationRequested: () => false,
    };
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: [PROJECT_ROOT],
      files: [{ path: absolute('work/storyboard.json'), contents: serializeMontageDocument(DOCUMENT) }],
    });
    const deps = createFakeRenderApiDependencies(callLog, {
      storage,
      probeAsset: async ({ assetId }) => audioAsset(assetId, 3000),
    });

    await runVoicePipeline({ project: PROJECT, voiceId: null, sceneIds: null }, deps, observer);

    expect(snapshots.map((entry) => `${entry.stage}:${entry.processedScenes ?? '-'}/${entry.totalScenes ?? '-'}`)).toEqual([
      'synthesize:-/-',
      'synthesize:1/3',
      'synthesize:2/3',
      'synthesize:3/3',
      'transcribe:-/-',
      'transcribe:1/3',
      'transcribe:2/3',
      'transcribe:3/3',
      'persist:-/-',
    ]);
    expect(snapshots.map((entry) => entry.percent)).toEqual([null, 33, 66, 100, null, 33, 66, 100, null]);

    const order = ['synthesize', 'transcribe', 'persist'];
    const indexes = snapshots.map((entry) => order.indexOf(entry.stage));
    expect(indexes).toEqual([...indexes].sort((left, right) => left - right));
  });
});
