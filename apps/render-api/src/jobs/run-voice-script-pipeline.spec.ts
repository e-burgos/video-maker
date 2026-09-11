import { resolveMediaProject } from '@video-maker/auto-montage';
import { VoiceScriptManifestSchema } from '@video-maker/timeline-core';
import type { MediaAsset, VoiceScriptManifest } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { createCallLog } from '../__fixtures__/call-log';
import { createFakeObjectStorage } from '../__fixtures__/fake-object-storage';
import { createFakeRenderApiDependencies } from '../__fixtures__/fake-render-api-dependencies';
import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import {
  voiceScriptManifestPath,
  voiceScriptTrackPath,
  voiceScriptWordsPath,
} from '../voice/voice-paths';
import type { VoiceJobProgress } from './render-job';
import { runVoicePipeline } from './run-voice-pipeline';
import { mergeVoiceJobProgress, startVoiceJobStage } from './voice-job-progress';
import type { VoicePipelineObserver } from './voice-pipeline-observer';

const PROJECT_ROOT = '/var/data/media/acme-launch';
const PROJECT = resolveMediaProject(PROJECT_ROOT);
const SCRIPT = 'Primera frase del guion.\n\n  Segunda   frase del guion.  \nTercera frase del guion.\n';
const SCRIPT_PATH = 'work/producer/script.txt';

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
    probedAt: '2026-09-11T00:00:00.000Z',
  };
}

function createHarness(options?: { readonly overrides?: Partial<RenderApiDependencies> }) {
  const callLog = createCallLog();
  const storage = createFakeObjectStorage(callLog, {
    directories: [PROJECT_ROOT],
    files: [{ path: absolute(SCRIPT_PATH), contents: SCRIPT }],
  });

  const durations = new Map<string, number>([
    ['work/voice/sources/line-01.wav', 1000],
    ['work/voice/sources/line-02.wav', 2000],
    ['work/voice/sources/line-03.wav', 3000],
    ['work/voice/voice.wav', 7800],
  ]);

  const deps = createFakeRenderApiDependencies(callLog, {
    storage,
    probeAsset: async ({ assetId }) => audioAsset(assetId, durations.get(assetId) ?? 0),
    ...options?.overrides,
  });

  let progress: VoiceJobProgress | null = null;
  const observer: VoicePipelineObserver = {
    stageStarted: (stage) => {
      progress = startVoiceJobStage(progress, stage);
    },
    sceneProcessed: (stage, processed, total) => {
      progress = mergeVoiceJobProgress(progress, stage, processed, total);
    },
    cancellationRequested: () => false,
  };

  return { deps, callLog, storage, observer, progress: () => progress };
}

async function readScriptManifest(
  storage: ReturnType<typeof createFakeObjectStorage>,
): Promise<VoiceScriptManifest> {
  const raw = await storage.readTextFile(absolute(voiceScriptManifestPath()));
  return VoiceScriptManifestSchema.parse(JSON.parse(raw));
}

describe('runVoicePipeline con guion suelto (FIX-e-burgos-009-001)', () => {
  it('sintetiza un wav por línea, sin leer el storyboard', async () => {
    const harness = createHarness();

    await runVoicePipeline(
      { project: PROJECT, voiceId: null, sceneIds: null, scriptText: SCRIPT, scriptPath: null, gapMs: 900 },
      harness.deps,
      harness.observer,
    );

    const synthesized = harness.callLog
      .entries()
      .filter((entry) => entry.port === 'synthesizeVoice')
      .map((entry) => (entry.input as { outPath: string }).outPath);

    expect(synthesized).toEqual([
      absolute('work/voice/sources/line-01.wav'),
      absolute('work/voice/sources/line-02.wav'),
      absolute('work/voice/sources/line-03.wav'),
    ]);
    expect(
      harness.callLog.entries().some((entry) => JSON.stringify(entry.input ?? '').includes('work/storyboard.json')),
    ).toBe(false);
  });

  it('escribe una línea por frase, colapsando espacios y saltando líneas vacías', async () => {
    const harness = createHarness();

    await runVoicePipeline(
      { project: PROJECT, voiceId: null, sceneIds: null, scriptText: SCRIPT, scriptPath: null, gapMs: 900 },
      harness.deps,
      harness.observer,
    );

    expect(await harness.storage.readTextFile(absolute('work/voice/sources/line-02.txt'))).toBe(
      'Segunda frase del guion.\n',
    );
  });

  it('concatena las frases con el gap pedido en un wav de 48 kHz mono', async () => {
    const harness = createHarness();

    await runVoicePipeline(
      { project: PROJECT, voiceId: null, sceneIds: null, scriptText: SCRIPT, scriptPath: null, gapMs: 900 },
      harness.deps,
      harness.observer,
    );

    const concat = harness.callLog.entries().find((entry) => entry.port === 'concatVoiceTracks');

    expect(concat?.input).toEqual({
      inputPaths: [
        absolute('work/voice/sources/line-01.wav'),
        absolute('work/voice/sources/line-02.wav'),
        absolute('work/voice/sources/line-03.wav'),
      ],
      outPath: absolute(voiceScriptTrackPath()),
      gapMs: 900,
      sampleRate: 48000,
      channels: 1,
      projectRoot: PROJECT_ROOT,
    });
  });

  it('transcribe la pista concatenada y publica el manifest con source script', async () => {
    const harness = createHarness();

    const report = await runVoicePipeline(
      { project: PROJECT, voiceId: null, sceneIds: null, scriptText: SCRIPT, scriptPath: null, gapMs: 900 },
      harness.deps,
      harness.observer,
    );

    const manifest = await readScriptManifest(harness.storage);

    expect(report).toEqual({
      source: 'script',
      manifestPath: voiceScriptManifestPath(),
      storyboardId: null,
      voiceId: 'es_AR-daniela-high',
      language: 'es-AR',
      scenes: [],
      track: {
        path: voiceScriptTrackPath(),
        wordsPath: voiceScriptWordsPath(),
        durationMs: 7800,
        lineCount: 3,
        gapMs: 900,
      },
    });
    expect(manifest.source).toBe('script');
    expect(manifest.gapMs).toBe(900);
    expect(manifest.lines.map((line) => [line.index, line.startMs, line.durationMs])).toEqual([
      [1, 0, 1000],
      [2, 1900, 2000],
      [3, 4800, 3000],
    ]);
    expect(manifest.durationMs).toBe(7800);
    expect(manifest.sampleRate).toBe(48000);
  });

  it('lee el guion del proyecto cuando llega por scriptPath', async () => {
    const harness = createHarness();

    const report = await runVoicePipeline(
      { project: PROJECT, voiceId: null, sceneIds: null, scriptText: null, scriptPath: SCRIPT_PATH, gapMs: 0 },
      harness.deps,
      harness.observer,
    );

    expect(report.track?.lineCount).toBe(3);
    expect(report.track?.gapMs).toBe(0);
  });

  it('falla con VOICE_SCRIPT_NOT_FOUND cuando el scriptPath no se puede leer', async () => {
    const harness = createHarness();

    await expect(
      runVoicePipeline(
        { project: PROJECT, voiceId: null, sceneIds: null, scriptText: null, scriptPath: 'work/nope.txt', gapMs: 900 },
        harness.deps,
        harness.observer,
      ),
    ).rejects.toMatchObject({ code: 'VOICE_SCRIPT_NOT_FOUND', stage: 'synthesize', resource: 'work/nope.txt' });
  });

  it('falla con VOICE_SCRIPT_INVALID cuando el guion no tiene ninguna línea con texto', async () => {
    const harness = createHarness();

    await expect(
      runVoicePipeline(
        { project: PROJECT, voiceId: null, sceneIds: null, scriptText: '  \n\n  ', scriptPath: null, gapMs: 900 },
        harness.deps,
        harness.observer,
      ),
    ).rejects.toMatchObject({ code: 'VOICE_SCRIPT_INVALID', stage: 'synthesize' });
  });
});
