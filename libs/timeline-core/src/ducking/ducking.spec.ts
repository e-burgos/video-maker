import { describe, expect, it } from 'vitest';

import { ca013Format } from '../__fixtures__/edl';
import type { MusicMixSettings } from '../schemas/audio-mix-plan.schema';
import { AudioMixPlanSchema } from '../schemas/audio-mix-plan.schema';
import type { EditDecisionList } from '../schemas/edit-decision-list.schema';
import { EditDecisionListSchema } from '../schemas/edit-decision-list.schema';
import type { VoiceRange } from './plan-ducking';
import { DEFAULT_AUDIO_MIX_PLAN, DEFAULT_MUSIC_MIX, mergeVoiceRanges, planDucking } from './plan-ducking';

function edlWithDuckDecisions(decisions: EditDecisionList['decisions']): EditDecisionList {
  return {
    schemaVersion: 1,
    sourceAssetId: 'aroll-cam-01',
    format: ca013Format,
    generatedBy: { tool: 'fixture', params: {} },
    decisions: [{ id: 'keep-0001', type: 'keep', startMs: 0, endMs: 5000 }, ...decisions],
  };
}

describe('mergeVoiceRanges', () => {
  it('fusiona rangos separados por menos que holdMs (CA-011)', () => {
    const ranges: VoiceRange[] = [
      { startMs: 1000, endMs: 2000 },
      { startMs: 2100, endMs: 3000 },
    ];

    expect(mergeVoiceRanges(ranges, 250)).toEqual([{ startMs: 1000, endMs: 3000 }]);
  });

  it('no fusiona rangos separados exactamente por holdMs (comparación estricta)', () => {
    const ranges: VoiceRange[] = [
      { startMs: 1000, endMs: 2000 },
      { startMs: 2250, endMs: 3000 },
    ];

    expect(mergeVoiceRanges(ranges, 250)).toEqual([
      { startMs: 1000, endMs: 2000 },
      { startMs: 2250, endMs: 3000 },
    ]);
  });

  it('no fusiona rangos separados por más que holdMs', () => {
    const ranges: VoiceRange[] = [
      { startMs: 1000, endMs: 2000 },
      { startMs: 3000, endMs: 4000 },
    ];

    expect(mergeVoiceRanges(ranges, 250)).toEqual(ranges);
  });

  it('normaliza rangos desordenados y descarta rangos degenerados', () => {
    const ranges: VoiceRange[] = [
      { startMs: 3000, endMs: 4000 },
      { startMs: 500, endMs: 500 },
      { startMs: 0, endMs: 1000 },
    ];

    expect(mergeVoiceRanges(ranges, 250)).toEqual([
      { startMs: 0, endMs: 1000 },
      { startMs: 3000, endMs: 4000 },
    ]);
  });

  it('no muta los rangos de entrada', () => {
    const ranges: VoiceRange[] = [
      { startMs: 1000, endMs: 2000 },
      { startMs: 2100, endMs: 3000 },
    ];
    const snapshot = ranges.map((range) => ({ ...range }));

    mergeVoiceRanges(ranges, 250);

    expect(ranges).toEqual(snapshot);
  });
});

describe('planDucking — CA-010', () => {
  it('produce los 5 keyframes exactos para voz [1000,3000] @30fps con defaults', () => {
    const result = planDucking([{ startMs: 1000, endMs: 3000 }], DEFAULT_MUSIC_MIX, 30);

    expect(result.automation).toEqual([
      { frame: 0, gainDb: -12 },
      { frame: 26, gainDb: -12 },
      { frame: 30, gainDb: -24 },
      { frame: 98, gainDb: -24 },
      { frame: 110, gainDb: -12 },
    ]);
  });

  it('genera una única decisión duck con el gain ducked', () => {
    const result = planDucking([{ startMs: 1000, endMs: 3000 }], DEFAULT_MUSIC_MIX, 30);

    expect(result.decisions).toEqual([
      { id: 'duck-0001', startMs: 1000, endMs: 3000, gainDb: -24 },
    ]);
  });
});

describe('planDucking — CA-011 (fusión de valles)', () => {
  it('dos rangos separados por menos del hold producen un único valle sin subida intermedia', () => {
    const result = planDucking(
      [
        { startMs: 1000, endMs: 2000 },
        { startMs: 2100, endMs: 3000 },
      ],
      DEFAULT_MUSIC_MIX,
      30,
    );

    expect(result.decisions).toHaveLength(1);
    expect(result.decisions[0]).toMatchObject({ startMs: 1000, endMs: 3000 });

    const gains = result.automation.map((keyframe) => keyframe.gainDb);
    const firstDuckedIndex = gains.indexOf(-24);
    const lastDuckedIndex = gains.lastIndexOf(-24);
    for (let index = firstDuckedIndex; index <= lastDuckedIndex; index += 1) {
      expect(gains[index]).toBe(-24);
    }
  });

  it('dos rangos separados por más del hold producen dos valles independientes', () => {
    const result = planDucking(
      [
        { startMs: 1000, endMs: 2000 },
        { startMs: 3000, endMs: 4000 },
      ],
      DEFAULT_MUSIC_MIX,
      30,
    );

    expect(result.decisions).toHaveLength(2);
    expect(result.decisions.map((decision) => decision.id)).toEqual(['duck-0001', 'duck-0002']);

    const gains = result.automation.map((keyframe) => keyframe.gainDb);
    expect(gains).toContain(-12);
    expect(gains.filter((gainDb) => gainDb === -24).length).toBeGreaterThanOrEqual(2);
  });
});

describe('planDucking — casos borde', () => {
  it('sin voz devuelve automation y decisions vacíos', () => {
    expect(planDucking([], DEFAULT_MUSIC_MIX, 30)).toEqual({ automation: [], decisions: [] });
  });

  it('voz desde 0 ms sin espacio para attack clampea el descenso al frame 0', () => {
    const result = planDucking([{ startMs: 0, endMs: 1000 }], DEFAULT_MUSIC_MIX, 30);

    expect(result.automation[0]).toEqual({ frame: 0, gainDb: -24 });
    expect(result.automation.filter((keyframe) => keyframe.frame === 0)).toHaveLength(1);
  });

  it('voz que se extiende hasta el final igual completa attack/hold/release', () => {
    const result = planDucking([{ startMs: 8000, endMs: 20_000 }], DEFAULT_MUSIC_MIX, 30);

    expect(result.automation[0]).toMatchObject({ gainDb: -12 });
    expect(result.automation.at(-1)).toMatchObject({ gainDb: -12 });
    expect(result.automation.map((keyframe) => keyframe.frame)).toEqual(
      [...result.automation.map((keyframe) => keyframe.frame)].sort((a, b) => a - b),
    );
  });

  it('valles no fusionados pero con release invadido trunca el release en el siguiente attack', () => {
    const settings: MusicMixSettings = {
      baseGainDb: -12,
      duckedGainDb: -24,
      attackMs: 150,
      releaseMs: 400,
      holdMs: 250,
    };
    const result = planDucking(
      [
        { startMs: 1000, endMs: 1100 },
        { startMs: 1500, endMs: 1600 },
      ],
      settings,
      30,
    );

    const frames = result.automation.map((keyframe) => keyframe.frame);
    expect(frames).toEqual([...frames].sort((a, b) => a - b));
    expect(new Set(frames).size).toBe(frames.length);
  });

  it('fps 24 redondea los frames de forma independiente', () => {
    const result = planDucking([{ startMs: 1000, endMs: 3000 }], DEFAULT_MUSIC_MIX, 24);

    expect(result.automation).toEqual([
      { frame: 0, gainDb: -12 },
      { frame: 20, gainDb: -12 },
      { frame: 24, gainDb: -24 },
      { frame: 78, gainDb: -24 },
      { frame: 88, gainDb: -12 },
    ]);
  });

  it('fps 60 redondea los frames de forma independiente', () => {
    const result = planDucking([{ startMs: 1000, endMs: 3000 }], DEFAULT_MUSIC_MIX, 60);

    expect(result.automation).toEqual([
      { frame: 0, gainDb: -12 },
      { frame: 51, gainDb: -12 },
      { frame: 60, gainDb: -24 },
      { frame: 195, gainDb: -24 },
      { frame: 219, gainDb: -12 },
    ]);
  });

  it('acepta opciones no default (niveles y rampas distintas)', () => {
    const settings: MusicMixSettings = {
      baseGainDb: -10,
      duckedGainDb: -20,
      attackMs: 100,
      releaseMs: 200,
      holdMs: 500,
    };

    const result = planDucking([{ startMs: 2000, endMs: 2500 }], settings, 30);

    expect(result.automation).toEqual([
      { frame: 0, gainDb: -10 },
      { frame: 57, gainDb: -10 },
      { frame: 60, gainDb: -20 },
      { frame: 90, gainDb: -20 },
      { frame: 96, gainDb: -10 },
    ]);
    expect(result.decisions).toEqual([{ id: 'duck-0001', startMs: 2000, endMs: 2500, gainDb: -20 }]);
  });

  it('releaseMs igual a 0 vuelve a la base en escalón, sin división por cero', () => {
    const settings: MusicMixSettings = {
      baseGainDb: -12,
      duckedGainDb: -24,
      attackMs: 150,
      releaseMs: 0,
      holdMs: 250,
    };

    const result = planDucking([{ startMs: 1000, endMs: 2000 }], settings, 30);

    expect(result.automation.at(-1)).toEqual({ frame: 68, gainDb: -12 });
    expect(Number.isFinite(result.automation.at(-1)?.gainDb)).toBe(true);
  });
});

describe('planDucking — integración con schemas', () => {
  it('el automation producido valida contra AudioMixPlanSchema', () => {
    const { automation } = planDucking([{ startMs: 1000, endMs: 3000 }], DEFAULT_MUSIC_MIX, 30);

    const result = AudioMixPlanSchema.safeParse({
      ...DEFAULT_AUDIO_MIX_PLAN,
      automation,
    });

    expect(result.success).toBe(true);
  });

  it('las decisiones duck validan dentro de una EditDecisionList', () => {
    const { decisions } = planDucking([{ startMs: 1000, endMs: 3000 }], DEFAULT_MUSIC_MIX, 30);
    const edl = edlWithDuckDecisions(
      decisions.map((decision) => ({ ...decision, type: 'duck' as const })),
    );

    const result = EditDecisionListSchema.safeParse(edl);

    expect(result.success).toBe(true);
  });

  it('rechaza una decisión duck que cae fuera de todo keep', () => {
    const { decisions } = planDucking([{ startMs: 1000, endMs: 3000 }], DEFAULT_MUSIC_MIX, 30);
    const edl = edlWithDuckDecisions(
      decisions.map((decision) => ({ ...decision, startMs: 6000, endMs: 7000, type: 'duck' as const })),
    );

    const result = EditDecisionListSchema.safeParse(edl);

    expect(result.success).toBe(false);
  });
});
