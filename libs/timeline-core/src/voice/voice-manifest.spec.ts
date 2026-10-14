import { describe, expect, it } from 'vitest';

import {
  emptyVoiceManifest,
  VOICE_MANIFEST_SCHEMA_VERSION,
  VoiceManifestSchema,
} from '../schemas/voice-manifest.schema';
import type { VoiceManifest, VoiceTrack } from '../schemas/voice-manifest.schema';
import { hashDirectedNarration, hashNarration } from './hash-narration';
import {
  dropVoiceTracksOutsideScenes,
  findVoiceTrack,
  isVoiceTrackStale,
  upsertVoiceTrack,
} from './merge-voice-manifest';

const NARRATION = 'Nx convierte un repo suelto en un monorepo con caché.';

function track(overrides: Partial<VoiceTrack> = {}): VoiceTrack {
  return {
    sceneId: 'scene-01',
    index: 1,
    source: 'generated',
    path: 'work/voice/scene-01.wav',
    wordsPath: 'work/voice/scene-01.words.json',
    durationMs: 4120,
    sampleRate: 48000,
    voiceId: 'es_AR-daniela-high',
    narrationHash: hashNarration(NARRATION),
    updatedAt: '2026-09-09T12:00:00.000Z',
    ...overrides,
  };
}

function manifest(tracks: readonly VoiceTrack[]): VoiceManifest {
  return { ...emptyVoiceManifest('storyboard-nx-intro', 'es-AR'), tracks };
}

describe('VoiceManifestSchema (US-09-007)', () => {
  it('acepta un manifest vacío recién creado', () => {
    expect(VoiceManifestSchema.safeParse(emptyVoiceManifest('storyboard-nx-intro', 'es-AR')).success).toBe(
      true,
    );
  });

  it('acepta una pista generada y una subida en el mismo documento', () => {
    const document = manifest([
      track(),
      track({ sceneId: 'scene-02', index: 2, source: 'uploaded', voiceId: null }),
    ]);

    expect(VoiceManifestSchema.safeParse(document).success).toBe(true);
  });

  it('rechaza dos pistas para la misma escena', () => {
    const document = manifest([track(), track({ index: 2 })]);

    const result = VoiceManifestSchema.safeParse(document);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain('a lo sumo una pista');
  });

  it('rechaza pistas fuera del orden del storyboard', () => {
    const document = manifest([track({ sceneId: 'scene-02', index: 2 }), track()]);

    const result = VoiceManifestSchema.safeParse(document);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['tracks', 1, 'index']);
  });

  it('rechaza una pista subida que declara la voz de un modelo generado', () => {
    const document = manifest([track({ source: 'uploaded' })]);

    const result = VoiceManifestSchema.safeParse(document);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain('source=uploaded no declara voiceId');
  });

  it('rechaza una pista generada sin el voiceId con el que se sintetizó', () => {
    const document = manifest([track({ voiceId: null })]);

    const result = VoiceManifestSchema.safeParse(document);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain('source=generated requiere el voiceId');
  });

  it('rechaza un campo desconocido y una schemaVersion futura', () => {
    expect(
      VoiceManifestSchema.safeParse({ ...manifest([]), unexpected: true }).success,
    ).toBe(false);
    expect(
      VoiceManifestSchema.safeParse({ ...manifest([]), schemaVersion: VOICE_MANIFEST_SCHEMA_VERSION + 1 })
        .success,
    ).toBe(false);
  });
});

describe('hashNarration (US-09-005)', () => {
  it('es determinista entre corridas para el mismo texto', () => {
    expect(hashNarration(NARRATION)).toBe(hashNarration(NARRATION));
  });

  it('cambia ante una edición mínima del texto', () => {
    expect(hashNarration(NARRATION)).not.toBe(hashNarration(`${NARRATION} `));
    expect(hashNarration('scene a')).not.toBe(hashNarration('scene b'));
  });

  it('distingue textos que sólo difieren en un acento', () => {
    expect(hashNarration('cache')).not.toBe(hashNarration('caché'));
  });

  it('siempre devuelve 16 dígitos hexadecimales, incluso para el texto vacío', () => {
    for (const text of ['', 'a', NARRATION, '🎙️ locución']) {
      expect(hashNarration(text)).toMatch(/^[0-9a-f]{16}$/u);
    }
  });
});

describe('merge del manifest (US-09-005, US-09-006)', () => {
  it('upsert reemplaza la pista de la escena y deja las demás intactas', () => {
    const before = manifest([track(), track({ sceneId: 'scene-02', index: 2, durationMs: 3000 })]);

    const after = upsertVoiceTrack(before, track({ durationMs: 5555 }));

    expect(after.tracks).toHaveLength(2);
    expect(after.tracks[0]?.durationMs).toBe(5555);
    expect(after.tracks[1]).toEqual(before.tracks[1]);
    expect(before.tracks[0]?.durationMs).toBe(4120);
  });

  it('upsert inserta una pista nueva respetando el orden por index', () => {
    const before = manifest([track({ sceneId: 'scene-03', index: 3 })]);

    const after = upsertVoiceTrack(before, track({ sceneId: 'scene-02', index: 2 }));

    expect(after.tracks.map((entry) => entry.sceneId)).toEqual(['scene-02', 'scene-03']);
    expect(VoiceManifestSchema.safeParse(after).success).toBe(true);
  });

  it('findVoiceTrack devuelve la pista de la escena o null', () => {
    const document = manifest([track()]);

    expect(findVoiceTrack(document, 'scene-01')?.sceneId).toBe('scene-01');
    expect(findVoiceTrack(document, 'scene-09')).toBeNull();
  });

  it('isVoiceTrackStale detecta que la narración cambió desde que se sintetizó', () => {
    const existing = track();

    expect(isVoiceTrackStale(existing, NARRATION)).toBe(false);
    expect(isVoiceTrackStale(existing, `${NARRATION} Y algo más.`)).toBe(true);
  });

  it('isVoiceTrackStale marca stale la pista cuando cambia el voiceId y no cuando es el mismo', () => {
    const existing = track({ voiceId: 'es_AR-daniela-high' });

    expect(isVoiceTrackStale(existing, NARRATION, undefined, 'es_AR-daniela-high')).toBe(false);
    expect(isVoiceTrackStale(existing, NARRATION, undefined, 'elevenlabs:abc')).toBe(true);
    expect(isVoiceTrackStale(existing, NARRATION)).toBe(false);
  });

  it('la dirección entra al hash sólo cuando existe: sin dirección el hash es el de siempre y cambiarla vuelve la pista stale', () => {
    const existing = track();
    const direction = { pace: 'slow' as const };

    expect(hashDirectedNarration(NARRATION, undefined)).toBe(hashNarration(NARRATION));
    expect(hashDirectedNarration(NARRATION, {})).toBe(hashNarration(NARRATION));
    expect(isVoiceTrackStale(existing, NARRATION, undefined)).toBe(false);
    expect(isVoiceTrackStale(existing, NARRATION, direction)).toBe(true);
    const directed = track({ narrationHash: hashDirectedNarration(NARRATION, direction) });
    expect(isVoiceTrackStale(directed, NARRATION, direction)).toBe(false);
    expect(isVoiceTrackStale(directed, NARRATION, { pace: 'fast' })).toBe(true);
  });

  it('dropVoiceTracksOutsideScenes borra las pistas de escenas que ya no están en el storyboard', () => {
    const document = manifest([track(), track({ sceneId: 'scene-02', index: 2 })]);

    const after = dropVoiceTracksOutsideScenes(document, ['scene-01']);

    expect(after.tracks.map((entry) => entry.sceneId)).toEqual(['scene-01']);
  });
});
