import { describe, expect, it } from 'vitest';

import { VOICE_STAGES } from './render-job';
import type { VoiceJob, VoiceJobProgress } from './render-job';
import { toJob, toJobSummary } from './render-job';
import { parseVoiceJobInput, parseVoiceOverwrite, parseVoiceSceneIds } from './voice-job-params';
import { mergeVoiceJobProgress, startVoiceJobStage, voiceProgressPercent } from './voice-job-progress';
import {
  isVoicePipelineCanceled,
  VoicePipelineCanceledError,
  voiceCheckpoint,
} from './voice-pipeline-observer';

describe('parseVoiceJobInput (US-09-004, US-09-005)', () => {
  it('un body vacío sintetiza todas las escenas con la voz configurada y sin sobreescribir', () => {
    expect(parseVoiceJobInput({})).toEqual({
      voiceId: null,
      sceneIds: null,
      overwrite: false,
      scriptText: null,
      scriptPath: null,
      gapMs: 900,
    });
  });

  it('recorta el id de voz y la lista de escenas', () => {
    expect(parseVoiceJobInput({ voice: '  es_AR-daniela-high ', sceneIds: [' scene-02 '] })).toEqual({
      voiceId: 'es_AR-daniela-high',
      sceneIds: ['scene-02'],
      overwrite: false,
      scriptText: null,
      scriptPath: null,
      gapMs: 900,
    });
  });

  it('rechaza un id de voz que no es un string no vacío con VOICE_ID_INVALID', () => {
    for (const value of [42, '', '   ', {}]) {
      expect(() => parseVoiceJobInput({ voice: value })).toThrowError(
        expect.objectContaining({ code: 'VOICE_ID_INVALID' }),
      );
    }
  });

  it('rechaza sceneIds que no es un array no vacío de strings con VOICE_SCENE_IDS_INVALID', () => {
    for (const value of [[], 'scene-01', [1, 2], ['scene-01', ''], {}]) {
      expect(() => parseVoiceSceneIds(value)).toThrowError(
        expect.objectContaining({ code: 'VOICE_SCENE_IDS_INVALID' }),
      );
    }
  });

  it('rechaza sceneIds con duplicados porque sintetizaría dos veces la misma escena', () => {
    expect(() => parseVoiceSceneIds(['scene-01', 'scene-01'])).toThrowError(
      expect.objectContaining({ code: 'VOICE_SCENE_IDS_INVALID', expected: 'scene ids without duplicates' }),
    );
  });

  it('acepta null y undefined en los dos parámetros opcionales', () => {
    expect(parseVoiceSceneIds(null)).toBeNull();
    expect(parseVoiceSceneIds(undefined)).toBeNull();
    expect(parseVoiceJobInput({ voice: null, sceneIds: null })).toEqual({
      voiceId: null,
      sceneIds: null,
      overwrite: false,
      scriptText: null,
      scriptPath: null,
      gapMs: 900,
    });
  });

  it('acepta scriptText o scriptPath como entrada alternativa al storyboard (FIX-e-burgos-009-001)', () => {
    expect(parseVoiceJobInput({ scriptText: 'Primera.\nSegunda.' })).toEqual({
      voiceId: null,
      sceneIds: null,
      overwrite: false,
      scriptText: 'Primera.\nSegunda.',
      scriptPath: null,
      gapMs: 900,
    });
    expect(parseVoiceJobInput({ scriptPath: 'work/producer/script.txt', gapMs: 400 }).gapMs).toBe(400);
  });

  it('rechaza las combinaciones imposibles del guion con VOICE_SCRIPT_INVALID', () => {
    const rejections: readonly Record<string, unknown>[] = [
      { scriptText: 'hola', scriptPath: 'work/producer/script.txt' },
      { scriptText: '   ' },
      { scriptPath: 42 },
      { scriptText: 'hola', sceneIds: ['scene-01'] },
      { gapMs: 400 },
      { scriptText: 'hola', gapMs: -1 },
      { scriptText: 'hola', gapMs: 1.5 },
      { scriptText: 'hola', gapMs: '400' },
    ];

    for (const body of rejections) {
      expect(() => parseVoiceJobInput(body)).toThrowError(
        expect.objectContaining({ code: 'VOICE_SCRIPT_INVALID' }),
      );
    }
  });

  it('overwrite tiene que ser booleano', () => {
    expect(parseVoiceOverwrite(true)).toBe(true);
    expect(parseVoiceOverwrite(undefined)).toBe(false);
    expect(() => parseVoiceOverwrite('true')).toThrowError(
      expect.objectContaining({ code: 'VOICE_OVERWRITE_INVALID' }),
    );
  });
});

describe('progreso del job de voz (US-09-004)', () => {
  it('cada etapa arranca sin contador y no retrocede a una anterior', () => {
    const synthesize = startVoiceJobStage(null, 'synthesize');
    expect(synthesize).toEqual({ stage: 'synthesize', processedScenes: null, totalScenes: null, percent: null });

    const transcribe = startVoiceJobStage(synthesize, 'transcribe');
    expect(transcribe.stage).toBe('transcribe');
    expect(startVoiceJobStage(transcribe, 'synthesize')).toBe(transcribe);
    expect(startVoiceJobStage(transcribe, 'transcribe')).toBe(transcribe);
  });

  it('el porcentaje por escena es monótono y se satura en 100', () => {
    expect(voiceProgressPercent(0, 3)).toBe(0);
    expect(voiceProgressPercent(1, 3)).toBe(33);
    expect(voiceProgressPercent(3, 3)).toBe(100);
    expect(voiceProgressPercent(4, 3)).toBe(100);
    expect(voiceProgressPercent(1, 0)).toBeNull();
  });

  it('una escena procesada de una etapa anterior no pisa el progreso de la etapa en curso', () => {
    const transcribe: VoiceJobProgress = {
      stage: 'transcribe',
      processedScenes: 1,
      totalScenes: 3,
      percent: 33,
    };

    expect(mergeVoiceJobProgress(transcribe, 'synthesize', 3, 3)).toBe(transcribe);
    expect(mergeVoiceJobProgress(transcribe, 'transcribe', 2, 3)).toEqual({
      stage: 'transcribe',
      processedScenes: 2,
      totalScenes: 3,
      percent: 66,
    });
  });

  it('las etapas están declaradas en el orden en que corren', () => {
    expect([...VOICE_STAGES]).toEqual(['synthesize', 'transcribe', 'persist']);
  });
});

describe('cancelación del pipeline de voz (US-09-004)', () => {
  it('el checkpoint lanza sólo cuando el observer pide cancelar, con la etapa que iba a empezar', () => {
    const observer = {
      stageStarted: () => undefined,
      sceneProcessed: () => undefined,
      cancellationRequested: () => true,
    };

    expect(() => voiceCheckpoint(observer, 'transcribe')).toThrowError(VoicePipelineCanceledError);
    expect(() => voiceCheckpoint({ ...observer, cancellationRequested: () => false }, 'transcribe')).not.toThrow();
    expect(() => voiceCheckpoint(undefined, 'transcribe')).not.toThrow();
  });

  it('isVoicePipelineCanceled distingue la cancelación de cualquier otro fallo', () => {
    expect(isVoicePipelineCanceled(new VoicePipelineCanceledError('persist'))).toBe(true);
    expect(isVoicePipelineCanceled(new Error('sherpa-onnx-offline-tts exited with 1'))).toBe(false);
    expect(new VoicePipelineCanceledError('persist').stage).toBe('persist');
  });
});

describe('proyección del job de voz (US-09-004)', () => {
  const job: VoiceJob = {
    id: 'render-0001',
    slug: 'acme-launch',
    kind: 'voice',
    state: 'running',
    createdAt: '2026-09-09T12:00:00.000Z',
    startedAt: '2026-09-09T12:00:01.000Z',
    finishedAt: null,
    progress: { stage: 'transcribe', processedScenes: 2, totalScenes: 3, percent: 66 },
    report: null,
    error: null,
  };

  it('toJob publica exactamente el mismo set de campos que los otros tres tipos de job', () => {
    expect(Object.keys(toJob(job)).sort()).toEqual([
      'createdAt',
      'error',
      'finishedAt',
      'id',
      'kind',
      'progress',
      'report',
      'slug',
      'startedAt',
      'state',
    ]);
  });

  it('toJobSummary expone la etapa de voz en curso', () => {
    expect(toJobSummary(job)).toEqual({
      id: 'render-0001',
      kind: 'voice',
      state: 'running',
      stage: 'transcribe',
      errorCode: null,
      createdAt: '2026-09-09T12:00:00.000Z',
      startedAt: '2026-09-09T12:00:01.000Z',
      finishedAt: null,
    });
  });
});
