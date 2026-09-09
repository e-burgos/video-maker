import { DEFAULT_MUSIC_MIX, planDucking } from '@video-maker/timeline-core';
import type { VoiceRange } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { rescaleMusicAutomation } from './rescale-music-automation';

const FPS = 30;

// Close enough that the release of the first valley is cut short by the attack of the
// second (producing a release-tail keyframe), yet far enough apart (gap > holdMs) that
// mergeVoiceRanges keeps them as two separate valleys.
const TWO_VALLEY_VOICE_RANGES: VoiceRange[] = [
  { startMs: 1000, endMs: 2000 },
  { startMs: 2600, endMs: 3600 },
];

describe('rescaleMusicAutomation', () => {
  it('matches the real producer keyframe-for-keyframe: rescaling planA against {A,B}->{A2,B2} equals planning directly with {A2,B2}', () => {
    const previous = { baseGainDb: -12, duckedGainDb: -24 };
    const next = { baseGainDb: -6, duckedGainDb: -30 };

    const planA = planDucking(
      TWO_VALLEY_VOICE_RANGES,
      { ...DEFAULT_MUSIC_MIX, baseGainDb: previous.baseGainDb, duckedGainDb: previous.duckedGainDb },
      FPS,
    );
    const planB = planDucking(
      TWO_VALLEY_VOICE_RANGES,
      { ...DEFAULT_MUSIC_MIX, baseGainDb: next.baseGainDb, duckedGainDb: next.duckedGainDb },
      FPS,
    );

    expect(planA.automation.length).toBeGreaterThanOrEqual(6);

    const result = rescaleMusicAutomation(planA.automation, previous, next);

    expect(result.rescaled).toBe(true);
    expect(result.automation).toHaveLength(planB.automation.length);
    result.automation.forEach((keyframe, index) => {
      const expected = planB.automation[index];
      expect(keyframe.frame).toBe(expected?.frame);
      expect(keyframe.gainDb).toBeCloseTo(expected?.gainDb ?? NaN, 9);
    });
  });

  it('rescales a fractional tail value correctly, unlike the literal CA-210 rule which would leave it stale', () => {
    // resolveReleaseTail in plan-ducking.ts computes exactly this kind of value
    // (ducked + (base - ducked) * ratio) for a release cut short by the next valley's
    // attack. The literal CA-210 rule only rewrites keyframes matching the OLD base or
    // OLD ducked value exactly, so it would leave a fractional keyframe untouched,
    // producing a discontinuous curve after the levels change.
    const previous = { baseGainDb: -12, duckedGainDb: -24 };
    const next = { baseGainDb: -6, duckedGainDb: -20 };
    const automation = [
      { frame: 0, gainDb: previous.baseGainDb },
      { frame: 30, gainDb: previous.duckedGainDb },
      { frame: 45, gainDb: (previous.baseGainDb + previous.duckedGainDb) / 2 },
    ];

    const result = rescaleMusicAutomation(automation, previous, next);

    const expectedTailGainDb = next.duckedGainDb + 0.5 * (next.baseGainDb - next.duckedGainDb);
    expect(result.automation[2]?.gainDb).toBeCloseTo(expectedTailGainDb, 9);
    expect(result.automation[2]?.gainDb).not.toBeCloseTo(automation[2]?.gainDb ?? NaN, 6);
  });

  it('applies both levels in a single pass against the previous values, never chaining an already-updated origin', () => {
    const previous = { baseGainDb: -12, duckedGainDb: -24 };
    const next = { baseGainDb: -24, duckedGainDb: -12 };

    const planA = planDucking(
      TWO_VALLEY_VOICE_RANGES,
      { ...DEFAULT_MUSIC_MIX, baseGainDb: previous.baseGainDb, duckedGainDb: previous.duckedGainDb },
      FPS,
    );
    const planB = planDucking(
      TWO_VALLEY_VOICE_RANGES,
      { ...DEFAULT_MUSIC_MIX, baseGainDb: next.baseGainDb, duckedGainDb: next.duckedGainDb },
      FPS,
    );

    const result = rescaleMusicAutomation(planA.automation, previous, next);

    result.automation.forEach((keyframe, index) => {
      expect(keyframe.gainDb).toBeCloseTo(planB.automation[index]?.gainDb ?? NaN, 9);
    });
  });

  it('preserves frame exactly, never touching it', () => {
    const previous = { baseGainDb: -12, duckedGainDb: -24 };
    const next = { baseGainDb: -8, duckedGainDb: -20 };
    const automation = [
      { frame: 0, gainDb: -12 },
      { frame: 30, gainDb: -24 },
      { frame: 60, gainDb: -18 },
    ];

    const result = rescaleMusicAutomation(automation, previous, next);

    expect(result.automation.map((keyframe) => keyframe.frame)).toEqual([0, 30, 60]);
  });

  it('returns rescaled: false and leaves the curve untouched when the previous levels were equal (span === 0)', () => {
    const automation = [
      { frame: 0, gainDb: -12 },
      { frame: 30, gainDb: -12 },
    ];

    const result = rescaleMusicAutomation(automation, { baseGainDb: -12, duckedGainDb: -12 }, {
      baseGainDb: -6,
      duckedGainDb: -30,
    });

    expect(result.rescaled).toBe(false);
    expect(result.automation).toEqual(automation);
  });

  it('leaves an empty automation untouched', () => {
    const result = rescaleMusicAutomation([], { baseGainDb: -12, duckedGainDb: -24 }, {
      baseGainDb: -6,
      duckedGainDb: -30,
    });

    expect(result.automation).toEqual([]);
    expect(result.rescaled).toBe(true);
  });
});
