import { emptyVoiceManifest, hashNarration } from '@video-maker/timeline-core';
import type { VoiceManifest, VoiceTrack } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { buildStoryboardDocument } from '../__fixtures__/storyboard-fixtures';
import { assertVoiceTracksNotPersisted, selectVoiceScenes } from './select-voice-scenes';
import { VOICE_TRACK_CHANNELS, VOICE_TRACK_SAMPLE_RATE } from './voice-format';
import { DEFAULT_VOICE_LANGUAGE, voiceLanguageFromModelId, whisperLanguageFor } from './voice-language';
import {
  voiceManifestPath,
  voiceNarrationTextPath,
  voiceSourceWavPath,
  voiceTrackPath,
  voiceWhisperOutBase,
  voiceWhisperWavPath,
  voiceWordsPath,
} from './voice-paths';

const DOCUMENT = buildStoryboardDocument();

function trackFor(sceneId: string, index: number, overrides: Partial<VoiceTrack> = {}): VoiceTrack {
  return {
    sceneId,
    index,
    source: 'generated',
    path: voiceTrackPath(sceneId),
    wordsPath: voiceWordsPath(sceneId),
    durationMs: 4000,
    sampleRate: VOICE_TRACK_SAMPLE_RATE,
    voiceId: 'es_AR-daniela-high',
    narrationHash: hashNarration('whatever'),
    updatedAt: '2026-09-09T12:00:00.000Z',
    ...overrides,
  };
}

function manifestWith(tracks: readonly VoiceTrack[]): VoiceManifest {
  return { ...emptyVoiceManifest(DOCUMENT.id, DOCUMENT.language), tracks };
}

describe('voice paths (US-09-007)', () => {
  it('deja el entregable y sus palabras en work/voice y los intermedios en subdirectorios', () => {
    expect(voiceTrackPath('scene-01')).toBe('work/voice/scene-01.wav');
    expect(voiceWordsPath('scene-01')).toBe('work/voice/scene-01.words.json');
    expect(voiceManifestPath()).toBe('work/voice/manifest.json');
    expect(voiceNarrationTextPath('scene-01')).toBe('work/voice/sources/scene-01.txt');
    expect(voiceSourceWavPath('scene-01')).toBe('work/voice/sources/scene-01.wav');
    expect(voiceWhisperWavPath('scene-01')).toBe('work/voice/whisper/scene-01.wav');
    expect(voiceWhisperOutBase('scene-01')).toBe('work/voice/whisper/scene-01');
  });
});

describe('voice format (US-09-004)', () => {
  it('el entregable sale al sample rate que espera la mezcla, no al que da Piper', async () => {
    const { AUDIO_MIX_SAMPLE_RATE } = await import('@video-maker/media-local');

    expect(VOICE_TRACK_SAMPLE_RATE).toBe(AUDIO_MIX_SAMPLE_RATE);
    expect(VOICE_TRACK_CHANNELS).toBe(1);
  });
});

describe('whisperLanguageFor (US-09-007)', () => {
  it('reduce el tag BCP-47 del storyboard al código que acepta whisper-cli', () => {
    expect(whisperLanguageFor('es-AR')).toBe('es');
    expect(whisperLanguageFor('en-US')).toBe('en');
    expect(whisperLanguageFor('pt')).toBe('pt');
    expect(whisperLanguageFor('ES-ar')).toBe('es');
  });

  it('cae a auto cuando el tag no empieza con un subtag de idioma', () => {
    expect(whisperLanguageFor('123')).toBe('auto');
    expect(whisperLanguageFor('')).toBe('auto');
  });
});

describe('selectVoiceScenes (US-09-005)', () => {
  it('sin sceneIds selecciona todas las escenas en el orden del storyboard', () => {
    expect(selectVoiceScenes(DOCUMENT, null).map((scene) => scene.id)).toEqual([
      'scene-01',
      'scene-02',
      'scene-03',
    ]);
  });

  it('con sceneIds selecciona sólo esas escenas, siempre en el orden del storyboard', () => {
    expect(selectVoiceScenes(DOCUMENT, ['scene-03', 'scene-01']).map((scene) => scene.id)).toEqual([
      'scene-01',
      'scene-03',
    ]);
  });

  it('un sceneId que no está en el storyboard es VOICE_SCENE_NOT_FOUND', () => {
    expect(() => selectVoiceScenes(DOCUMENT, ['scene-09'])).toThrowError(
      expect.objectContaining({ code: 'VOICE_SCENE_NOT_FOUND', resource: 'scene-09' }),
    );
  });

  it('un id de escena que se escapa del proyecto es STORYBOARD_INVALID y no llega a los paths', () => {
    const tampered = buildStoryboardDocument({
      scenes: [{ ...DOCUMENT.scenes[0], id: '../../etc/passwd' }],
    });

    expect(() => selectVoiceScenes(tampered, null)).toThrowError(
      expect.objectContaining({ code: 'STORYBOARD_INVALID', resource: '../../etc/passwd' }),
    );
  });
});

describe('assertVoiceTracksNotPersisted (US-09-005, US-09-006)', () => {
  it('sin manifest previo no bloquea nada', () => {
    expect(() => assertVoiceTracksNotPersisted(null, DOCUMENT.scenes, false)).not.toThrow();
  });

  it('una escena ya sintetizada sin overwrite es VOICE_ALREADY_EXISTS con la pista de cómo seguir', () => {
    const manifest = manifestWith([trackFor('scene-02', 2)]);

    expect(() => assertVoiceTracksNotPersisted(manifest, DOCUMENT.scenes, false)).toThrowError(
      expect.objectContaining({ code: 'VOICE_ALREADY_EXISTS', resource: 'work/voice/manifest.json' }),
    );
  });

  it('con overwrite deja pasar aunque todas las escenas tengan pista', () => {
    const manifest = manifestWith([trackFor('scene-01', 1), trackFor('scene-02', 2)]);

    expect(() => assertVoiceTracksNotPersisted(manifest, DOCUMENT.scenes, true)).not.toThrow();
  });

  it('restringir el job a escenas todavía sin pista no necesita overwrite', () => {
    const manifest = manifestWith([trackFor('scene-01', 1)]);
    const scenes = selectVoiceScenes(DOCUMENT, ['scene-02']);

    expect(() => assertVoiceTracksNotPersisted(manifest, scenes, false)).not.toThrow();
  });
});

describe('voiceLanguageFromModelId (FIX-e-burgos-009-001)', () => {
  it('deriva el idioma del nombre del modelo Piper', () => {
    expect(voiceLanguageFromModelId('es_AR-daniela-high')).toBe('es-AR');
    expect(voiceLanguageFromModelId('es_ES-sharvard-medium')).toBe('es-ES');
    expect(voiceLanguageFromModelId('fr_FR-siwis-low')).toBe('fr-FR');
  });

  it('cae al idioma por defecto cuando el id no sigue la convención', () => {
    expect(voiceLanguageFromModelId('daniela')).toBe(DEFAULT_VOICE_LANGUAGE);
    expect(voiceLanguageFromModelId('')).toBe(DEFAULT_VOICE_LANGUAGE);
    expect(DEFAULT_VOICE_LANGUAGE).toBe('es');
  });

  it('lo que deriva sigue siendo un idioma que Whisper entiende', () => {
    expect(whisperLanguageFor(voiceLanguageFromModelId('es_AR-daniela-high'))).toBe('es');
  });
});
