import { resolveMediaProject } from '@video-maker/auto-montage';
import { TranscriptionSchema, VoiceScriptManifestSchema } from '@video-maker/timeline-core';
import type { MediaAsset, Transcription, VoiceScriptManifest } from '@video-maker/timeline-core';
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

async function readVoiceWords(
  storage: ReturnType<typeof createFakeObjectStorage>,
): Promise<Transcription> {
  const raw = await storage.readTextFile(absolute(voiceScriptWordsPath()));
  return TranscriptionSchema.parse(JSON.parse(raw));
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

  it('transcribe el wav de cada frase por separado, nunca la pista concatenada', async () => {
    const harness = createHarness();

    await runVoicePipeline(
      { project: PROJECT, voiceId: null, sceneIds: null, scriptText: SCRIPT, scriptPath: null, gapMs: 900 },
      harness.deps,
      harness.observer,
    );

    const transcribed = harness.callLog
      .entries()
      .filter((entry) => entry.port === 'transcribeVoice')
      .map((entry) => (entry.input as { wavPath: string }).wavPath);

    expect(transcribed).toEqual([
      absolute('work/voice/whisper/line-01.wav'),
      absolute('work/voice/whisper/line-02.wav'),
      absolute('work/voice/whisper/line-03.wav'),
    ]);
  });

  it('desplaza y acota las palabras de cada frase a la ventana de su línea', async () => {
    const harness = createHarness();

    await runVoicePipeline(
      { project: PROJECT, voiceId: null, sceneIds: null, scriptText: SCRIPT, scriptPath: null, gapMs: 900 },
      harness.deps,
      harness.observer,
    );

    const words = await readVoiceWords(harness.storage);
    const manifest = await readScriptManifest(harness.storage);

    expect(words.words.map((word) => word.text)).toEqual([
      'Primera', 'frase', 'del', 'guion.',
      'Segunda', 'frase', 'del', 'guion.',
      'Tercera', 'frase', 'del', 'guion.',
    ]);
    const lineSpans = [0, 4, 8].map((first) => [words.words[first]?.startMs, words.words[first + 3]?.endMs]);
    expect(lineSpans).toEqual([
      [0, 900],
      [1900, 2800],
      [4800, 5700],
    ]);
    expect(words.segments).toEqual([]);
    manifest.lines.forEach((line) => {
      const lineWords = words.words.filter(
        (word) => word.startMs >= line.startMs && word.startMs < line.startMs + line.durationMs,
      );
      expect(lineWords.every((word) => word.endMs <= line.startMs + line.durationMs)).toBe(true);
    });
  });

  it('anota wordsSource whisper por línea', async () => {
    const harness = createHarness();

    await runVoicePipeline(
      { project: PROJECT, voiceId: null, sceneIds: null, scriptText: SCRIPT, scriptPath: null, gapMs: 900 },
      harness.deps,
      harness.observer,
    );

    const manifest = await readScriptManifest(harness.storage);

    expect(manifest.lines.map((line) => line.wordsSource)).toEqual(['whisper', 'whisper', 'whisper']);
  });

  it('cae al guion de la línea y lo anota cuando Whisper falla en esa frase', async () => {
    const harness = createHarness({
      overrides: {
        transcribeVoice: async (input) => {
          if (input.wavPath.endsWith('line-02.wav')) {
            throw new Error('whisper-cli exited with 1');
          }
          return {
            assetId: input.assetId,
            engine: 'whisper.cpp',
            language: input.language,
            words: [{ text: 'hola', startMs: 0, endMs: 400 }],
            segments: [],
          };
        },
      },
    });

    await runVoicePipeline(
      { project: PROJECT, voiceId: null, sceneIds: null, scriptText: SCRIPT, scriptPath: null, gapMs: 900 },
      harness.deps,
      harness.observer,
    );

    const manifest = await readScriptManifest(harness.storage);
    const words = await readVoiceWords(harness.storage);
    const lineTwo = manifest.lines[1];

    expect(manifest.lines.map((line) => line.wordsSource)).toEqual(['whisper', 'script', 'whisper']);
    const fallbackWords = words.words.filter(
      (word) => word.startMs >= (lineTwo?.startMs ?? 0) && word.startMs < (lineTwo?.endMs ?? 0),
    );
    expect(fallbackWords.map((word) => word.text)).toEqual(['Segunda', 'frase', 'del', 'guion.']);
    expect(fallbackWords.every((word) => word.endMs <= (lineTwo?.endMs ?? 0))).toBe(true);
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

const TIMED_SCRIPT = '[0:00] Entramos a la plataforma.\n[0:20] Las campañas viven acá.\n[0:28] Creamos una nueva.\n';

function createTimedHarness(durationsByLine: ReadonlyMap<string, readonly number[]>, trackDurationMs: number) {
  const callLog = createCallLog();
  const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });
  const probeCounts = new Map<string, number>();

  const deps = createFakeRenderApiDependencies(callLog, {
    storage,
    probeAsset: async ({ assetId }) => {
      if (assetId === voiceScriptTrackPath()) {
        return audioAsset(assetId, trackDurationMs);
      }
      const attempt = probeCounts.get(assetId) ?? 0;
      probeCounts.set(assetId, attempt + 1);
      const durations = durationsByLine.get(assetId) ?? [1000];
      return audioAsset(assetId, durations[Math.min(attempt, durations.length - 1)] ?? 1000);
    },
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

  return { deps, callLog, storage, observer };
}

function runTimed(harness: ReturnType<typeof createTimedHarness>, scriptText = TIMED_SCRIPT) {
  return runVoicePipeline(
    { project: PROJECT, voiceId: null, sceneIds: null, scriptText, scriptPath: null, gapMs: 900 },
    harness.deps,
    harness.observer,
  );
}

describe('runVoicePipeline con guion cronometrado (FIX-e-burgos-009-002)', () => {
  const FITTING = new Map<string, readonly number[]>([
    ['work/voice/sources/line-01.wav', [4000]],
    ['work/voice/sources/line-02.wav', [6000]],
    ['work/voice/sources/line-03.wav', [3000]],
  ]);

  it('coloca cada frase en el tiempo de su marca en vez de concatenarlas', async () => {
    const harness = createTimedHarness(FITTING, 31_000);

    await runTimed(harness);

    const placed = harness.callLog.entries().find((entry) => entry.port === 'placeVoiceTracks');

    expect(placed?.input).toEqual({
      segments: [
        { path: absolute('work/voice/sources/line-01.wav'), startMs: 0 },
        { path: absolute('work/voice/sources/line-02.wav'), startMs: 20_000 },
        { path: absolute('work/voice/sources/line-03.wav'), startMs: 28_000 },
      ],
      totalMs: null,
      outPath: absolute(voiceScriptTrackPath()),
      sampleRate: 48000,
      channels: 1,
      projectRoot: PROJECT_ROOT,
    });
    expect(harness.callLog.entries().some((entry) => entry.port === 'concatVoiceTracks')).toBe(false);
  });

  it('estira el track hasta el fin de la ventana que el guion declaró (FIX-e-burgos-009-002)', async () => {
    const harness = createTimedHarness(FITTING, 40_000);

    await runTimed(harness, '[0:00] Entramos.\n[0:20] Las campañas viven acá.\n[0:28-0:40] Creamos una nueva.\n');

    const placed = harness.callLog.entries().find((entry) => entry.port === 'placeVoiceTracks');

    expect((placed?.input as { totalMs: number | null }).totalMs).toBe(40_000);
  });

  it('no estira el track cuando la narración pasa el fin declarado (FIX-e-burgos-009-002)', async () => {
    const harness = createTimedHarness(
      new Map<string, readonly number[]>([
        ['work/voice/sources/line-01.wav', [4000]],
        ['work/voice/sources/line-02.wav', [6000]],
        ['work/voice/sources/line-03.wav', [9000]],
      ]),
      37_000,
    );

    await runTimed(harness, '[0:00] Entramos.\n[0:20] Las campañas viven acá.\n[0:28-0:35] Creamos una nueva.\n');

    const placed = harness.callLog.entries().find((entry) => entry.port === 'placeVoiceTracks');

    expect((placed?.input as { totalMs: number | null }).totalMs).toBeNull();
  });

  it('guarda startMs, endMs, requestedStartMs y overflowMs por línea', async () => {
    const harness = createTimedHarness(FITTING, 31_000);

    await runTimed(harness);
    const manifest = await readScriptManifest(harness.storage);

    expect(
      manifest.lines.map((line) => [line.startMs, line.endMs, line.requestedStartMs, line.overflowMs]),
    ).toEqual([
      [0, 4000, 0, 0],
      [20_000, 26_000, 20_000, 0],
      [28_000, 31_000, 28_000, 0],
    ]);
    expect(manifest.lines.every((line) => line.lengthScale === undefined)).toBe(true);
  });

  it('acelera con length-scale la frase que no entra en su ventana y vuelve a sintetizarla', async () => {
    const harness = createTimedHarness(
      new Map<string, readonly number[]>([
        ['work/voice/sources/line-01.wav', [21_000, 19_000]],
        ['work/voice/sources/line-02.wav', [6000]],
        ['work/voice/sources/line-03.wav', [3000]],
      ]),
      31_000,
    );

    await runTimed(harness);

    const scales = harness.callLog
      .entries()
      .filter((entry) => entry.port === 'synthesizeVoice')
      .map((entry) => (entry.input as { lengthScale?: number }).lengthScale);
    const manifest = await readScriptManifest(harness.storage);

    expect(scales).toEqual([undefined, undefined, undefined, 0.95]);
    expect(manifest.lines[0]?.lengthScale).toBe(0.95);
    expect(manifest.lines[0]?.overflowMs).toBe(0);
  });

  it('desplaza la línea siguiente y reporta el sobrante cuando la aceleración no alcanza', async () => {
    const harness = createTimedHarness(
      new Map<string, readonly number[]>([
        ['work/voice/sources/line-01.wav', [26_000, 22_000]],
        ['work/voice/sources/line-02.wav', [6000]],
        ['work/voice/sources/line-03.wav', [3000]],
      ]),
      31_000,
    );

    await runTimed(harness);
    const manifest = await readScriptManifest(harness.storage);

    expect(manifest.lines[0]?.overflowMs).toBe(2000);
    expect(manifest.lines[1]?.startMs).toBe(22_000);
    expect(manifest.lines[1]?.requestedStartMs).toBe(20_000);
  });

  it('encadena con gapMs las líneas sin marca mezcladas con las marcadas', async () => {
    const harness = createTimedHarness(FITTING, 31_000);

    await runTimed(harness, '[0:00] Entramos.\nSeguimos.\n[0:28] Creamos una nueva.\n');
    const manifest = await readScriptManifest(harness.storage);

    expect(manifest.lines.map((line) => [line.startMs, line.requestedStartMs])).toEqual([
      [0, 0],
      [4900, null],
      [28_000, 28_000],
    ]);
  });
});

describe('runVoicePipeline con la voz de la marca', () => {
  function synthesisInputs(harness: ReturnType<typeof createHarness>) {
    return harness.callLog
      .entries()
      .filter((entry) => entry.port === 'synthesizeVoice')
      .map((entry) => entry.input as { modelPath: string; lengthScale?: number });
  }

  it('sin voiceId usa la voz de la marca y su velocidad cuando está instalada', async () => {
    const harness = createHarness();

    await runVoicePipeline(
      {
        project: PROJECT,
        voiceId: null,
        sceneIds: null,
        scriptText: SCRIPT,
        scriptPath: null,
        gapMs: 900,
        brandVoice: { id: 'es_ES-sharvard-medium', lengthScale: 1.08 },
      },
      harness.deps,
      harness.observer,
    );

    const inputs = synthesisInputs(harness);
    expect(inputs.every((input) => input.modelPath.endsWith('vits-piper-es_ES-sharvard-medium'))).toBe(true);
    expect(inputs.every((input) => input.lengthScale === 1.08)).toBe(true);
  });

  it('con la voz de la marca no instalada cae a la voz por defecto sin velocidad', async () => {
    const harness = createHarness();

    await runVoicePipeline(
      {
        project: PROJECT,
        voiceId: null,
        sceneIds: null,
        scriptText: SCRIPT,
        scriptPath: null,
        gapMs: 900,
        brandVoice: { id: 'es_MX-ausente-high', lengthScale: 1.08 },
      },
      harness.deps,
      harness.observer,
    );

    const inputs = synthesisInputs(harness);
    expect(inputs.every((input) => input.modelPath.endsWith('vits-piper-es_AR-daniela-high'))).toBe(true);
    expect(inputs.some((input) => input.lengthScale !== undefined)).toBe(false);
  });

  it('un voiceId explícito gana sobre la voz de la marca', async () => {
    const harness = createHarness();

    await runVoicePipeline(
      {
        project: PROJECT,
        voiceId: 'es_AR-daniela-high',
        sceneIds: null,
        scriptText: SCRIPT,
        scriptPath: null,
        gapMs: 900,
        brandVoice: { id: 'es_ES-sharvard-medium', lengthScale: 1.08 },
      },
      harness.deps,
      harness.observer,
    );

    const inputs = synthesisInputs(harness);
    expect(inputs.every((input) => input.modelPath.endsWith('vits-piper-es_AR-daniela-high'))).toBe(true);
    expect(inputs.some((input) => input.lengthScale !== undefined)).toBe(false);
  });
});

describe('runVoicePipeline con dirección de voz por línea (US-023-301)', () => {
  const DIRECTION_PATH = 'work/producer/voice-direction.json';

  async function runWithDirections(directions: unknown) {
    const harness = createHarness();
    await harness.storage.writeTextFile(absolute(DIRECTION_PATH), JSON.stringify(directions));
    await runVoicePipeline(
      { project: PROJECT, voiceId: null, sceneIds: null, scriptText: SCRIPT, scriptPath: null, gapMs: 900 },
      harness.deps,
      harness.observer,
    );
    return harness;
  }

  function synthesisCalls(harness: ReturnType<typeof createHarness>) {
    return harness.callLog
      .entries()
      .filter((entry) => entry.port === 'synthesizeVoice')
      .map((entry) => entry.input as Record<string, unknown>);
  }

  it('sin archivo de dirección las llamadas de síntesis no llevan ningún parámetro nuevo', async () => {
    const harness = createHarness();
    await runVoicePipeline(
      { project: PROJECT, voiceId: null, sceneIds: null, scriptText: SCRIPT, scriptPath: null, gapMs: 900 },
      harness.deps,
      harness.observer,
    );

    for (const call of synthesisCalls(harness)) {
      expect(Object.keys(call).sort()).toEqual(['modelPath', 'outPath', 'projectRoot', 'textPath']);
    }
    const manifest = await readScriptManifest(harness.storage);
    expect(manifest.lines.some((line) => line.direction !== undefined)).toBe(false);
  });

  it('aplica ritmo, energía y pausa solo a la línea dirigida y los anota en el manifiesto', async () => {
    const harness = await runWithDirections({ '2': { pace: 'slow', energy: 'lively', pauseAfterMs: 500 } });

    const [first, second, third] = synthesisCalls(harness);
    expect(second).toMatchObject({ lengthScale: 1.12, noiseScale: 0.8, noiseScaleW: 1, trailingPauseMs: 500 });
    expect(Object.keys(first ?? {})).not.toContain('noiseScale');
    expect(Object.keys(third ?? {})).not.toContain('trailingPauseMs');
    const manifest = await readScriptManifest(harness.storage);
    expect(manifest.lines[1]?.direction).toEqual({ pace: 'slow', energy: 'lively', pauseAfterMs: 500 });
    expect(manifest.lines[0]?.direction).toBeUndefined();
  });

  it('un archivo de dirección inválido falla nombrando el archivo', async () => {
    await expect(runWithDirections({ '1': { pace: 'turbo' } })).rejects.toMatchObject({
      code: 'INVALID_INPUT',
      resource: DIRECTION_PATH,
    });
  });
});
