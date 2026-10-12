import type { Transcription } from '@video-maker/timeline-core';
import { ReferenceBriefSchema } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { buildReferenceBrief } from './build-reference-brief';
import type { ReferenceBriefInputs } from './build-reference-brief';

const TRANSCRIPTION: Transcription = {
  assetId: 'raw/reference/modelo.mp4',
  engine: 'whisper.cpp',
  language: 'es',
  words: [
    { text: 'hola', startMs: 1000, endMs: 1400 },
    { text: 'a', startMs: 1400, endMs: 1600 },
    { text: 'todos', startMs: 1600, endMs: 2400 },
  ],
  segments: [{ startMs: 1000, endMs: 2400, text: 'hola a todos', wordRange: [0, 2] }],
};

function inputs(overrides: Partial<ReferenceBriefInputs> = {}): ReferenceBriefInputs {
  return {
    file: 'raw/reference/modelo.mp4',
    name: 'modelo',
    probe: { durationSec: 30, width: 1080, height: 1920, fps: 29.97, hasAudio: true },
    scenes: [
      { index: 0, startSec: 0, endSec: 10, durationSec: 10 },
      { index: 1, startSec: 10, endSec: 30, durationSec: 20 },
    ],
    transcription: TRANSCRIPTION,
    integratedLufs: -16.44,
    longSilences: [{ startSec: 12, endSec: 14 }],
    createdAt: '2026-10-12T10:00:00.000Z',
    ...overrides,
  };
}

function wordsAt(entries: ReadonlyArray<readonly [string, number, number]>): Transcription['words'] {
  return entries.map(([text, startMs, endMs]) => ({ text, startMs, endMs }));
}

describe('buildReferenceBrief', () => {
  it('assembles a schema-valid brief with format, scenes, pace, voice and audio', () => {
    const brief = buildReferenceBrief(inputs());

    expect(ReferenceBriefSchema.safeParse(brief).success).toBe(true);
    expect(brief.format).toEqual({ width: 1080, height: 1920, fps: 29.97, orientation: 'portrait' });
    expect(brief.scenes.map((scene) => scene.keyframe)).toEqual([
      'work/reference/modelo/scene-00.jpg',
      'work/reference/modelo/scene-01.jpg',
    ]);
    expect(brief.pace).toEqual({ cutsPerMinute: 2, meanSceneSec: 15, medianSceneSec: 15 });
    expect(brief.audio).toEqual({ integratedLufs: -16.4, longSilences: [{ startSec: 12, endSec: 14 }] });
    expect(brief.summary).toContain('2 escenas');
  });

  it('measures words per minute, speech ratio and phrase times', () => {
    const { voice } = buildReferenceBrief(inputs());

    expect(voice).toEqual({
      transcript: [{ startSec: 1, endSec: 2.4, text: 'hola a todos' }],
      wordsPerMinute: 6,
      speechRatio: 0.05,
    });
  });

  it('leaves voice null and loudness null when the video has no speech or audio', () => {
    const silent = buildReferenceBrief(inputs({ transcription: null, integratedLufs: null, longSilences: [] }));
    const emptyTranscription = buildReferenceBrief(inputs({ transcription: { ...TRANSCRIPTION, words: [], segments: [] } }));

    expect(silent.voice).toBeNull();
    expect(silent.audio.integratedLufs).toBeNull();
    expect(emptyTranscription.voice).toBeNull();
    expect(silent.summary).toContain('Sin voz hablada detectada.');
  });

  it('reports a single scene with zero cuts per minute', () => {
    const brief = buildReferenceBrief(inputs({ scenes: [{ index: 0, startSec: 0, endSec: 30, durationSec: 30 }] }));

    expect(brief.pace.cutsPerMinute).toBe(0);
  });
});

describe('buildReferenceBrief phrases', () => {
  it('splits at sentence-ending punctuation and at pauses of 0.7 s or more', () => {
    const words = wordsAt([
      ['Hola', 0, 400],
      ['amigos.', 400, 900],
      ['Hoy', 1000, 1300],
      ['vemos', 1300, 1700],
      ['café', 2600, 3000],
    ]);

    const { voice } = buildReferenceBrief(inputs({ transcription: { ...TRANSCRIPTION, words, segments: [] }, longSilences: [] }));

    expect(voice?.transcript).toEqual([
      { startSec: 0, endSec: 0.9, text: 'Hola amigos.' },
      { startSec: 1, endSec: 1.7, text: 'Hoy vemos' },
      { startSec: 2.6, endSec: 3, text: 'café' },
    ]);
  });

  it('caps a stretched last word and trims a phrase edge that falls inside a long silence', () => {
    const words = wordsAt([
      ['Hola', 0, 400],
      ['mundo', 400, 9000],
    ]);

    const { voice } = buildReferenceBrief(
      inputs({
        transcription: { ...TRANSCRIPTION, words, segments: [] },
        longSilences: [{ startSec: 0, endSec: 0.5 }],
      }),
    );

    expect(voice?.transcript).toEqual([{ startSec: 0.5, endSec: 1.2, text: 'Hola mundo' }]);
  });
});
