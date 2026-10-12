import { describe, expect, it } from 'vitest';

import {
  ReferenceBriefSchema,
  buildReferenceSummary,
  orientationFor,
  paceFromScenes,
  wordsPerMinuteFor,
} from './reference-brief';
import type { ReferenceBrief, ReferenceBriefFacts } from './reference-brief';

const FACTS: ReferenceBriefFacts = {
  file: 'raw/reference/modelo.mp4',
  durationSec: 60,
  format: { width: 1080, height: 1920, fps: 30, orientation: 'portrait' },
  scenes: [
    { index: 0, startSec: 0, endSec: 20, durationSec: 20, keyframe: 'work/reference/modelo/scene-00.jpg' },
    { index: 1, startSec: 20, endSec: 45, durationSec: 25, keyframe: 'work/reference/modelo/scene-01.jpg' },
    { index: 2, startSec: 45, endSec: 60, durationSec: 15, keyframe: 'work/reference/modelo/scene-02.jpg' },
  ],
  pace: { cutsPerMinute: 2, meanSceneSec: 20, medianSceneSec: 20 },
  voice: { transcript: [{ startSec: 1, endSec: 3, text: 'Hola' }], wordsPerMinute: 140, speechRatio: 0.8 },
  audio: { integratedLufs: -14.2, longSilences: [] },
};

function briefFrom(facts: ReferenceBriefFacts): ReferenceBrief {
  return { version: 1, ...facts, summary: buildReferenceSummary(facts), createdAt: '2026-10-12T10:00:00.000Z' };
}

describe('ReferenceBriefSchema', () => {
  it('accepts a complete brief', () => {
    expect(ReferenceBriefSchema.safeParse(briefFrom(FACTS)).success).toBe(true);
  });

  it('accepts a brief without voice', () => {
    expect(ReferenceBriefSchema.safeParse(briefFrom({ ...FACTS, voice: null })).success).toBe(true);
  });

  it('rejects unknown fields', () => {
    expect(ReferenceBriefSchema.safeParse({ ...briefFrom(FACTS), extra: 1 }).success).toBe(false);
  });
});

describe('paceFromScenes', () => {
  it('derives cuts per minute, mean and median scene length', () => {
    expect(paceFromScenes(FACTS.scenes, 60)).toEqual({ cutsPerMinute: 2, meanSceneSec: 20, medianSceneSec: 20 });
  });

  it('averages the two middle scenes for an even count', () => {
    const pace = paceFromScenes([{ durationSec: 2 }, { durationSec: 4 }], 6);

    expect(pace.medianSceneSec).toBe(3);
    expect(pace.cutsPerMinute).toBe(10);
  });

  it('reports zero cuts for a single scene', () => {
    expect(paceFromScenes([{ durationSec: 30 }], 30).cutsPerMinute).toBe(0);
  });
});

describe('helpers', () => {
  it('classifies orientation', () => {
    expect([orientationFor(1920, 1080), orientationFor(1080, 1920), orientationFor(1080, 1080)]).toEqual([
      'landscape',
      'portrait',
      'square',
    ]);
  });

  it('computes words per minute', () => {
    expect(wordsPerMinuteFor(70, 30)).toBe(140);
  });
});

describe('buildReferenceSummary', () => {
  it('builds a deterministic Spanish summary from the numbers', () => {
    expect(buildReferenceSummary(FACTS)).toBe(
      'Referencia de 1 min 0 s, vertical 1080x1920 a 30 fps. 3 escenas, 2 cortes por minuto, escena media de 20 s (mediana 20 s). Voz de 140 palabras por minuto, con habla en el 80% del video. Audio: sonoridad -14.2 LUFS, sin silencios largos.',
    );
  });

  it('counts long silences with the right plural', () => {
    const silence = { startSec: 1, endSec: 3 };

    expect(buildReferenceSummary({ ...FACTS, audio: { integratedLufs: null, longSilences: [silence] } })).toContain(
      'sin sonoridad medible, 1 silencio largo.',
    );
    expect(buildReferenceSummary({ ...FACTS, audio: { integratedLufs: null, longSilences: [silence, silence] } })).toContain(
      '2 silencios largos.',
    );
  });

  it('says so when there is no speech', () => {
    expect(buildReferenceSummary({ ...FACTS, voice: null })).toContain('Sin voz hablada detectada.');
  });
});
