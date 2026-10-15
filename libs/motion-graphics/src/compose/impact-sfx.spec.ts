import { describe, expect, it } from 'vitest';

import { IMPACT_DURATION_SEC, IMPACT_TRACK_VOLUME, IMPACT_UNDER_VOICE_LEVEL, IMPACT_VOICE_LEAD_IN_SEC, impactTrack } from './impact-sfx';

describe('impact sound effect', () => {
  const tag = impactTrack('{{start:reveal}}', 'assets/runtime');
  const automation = JSON.parse(/data-automation='([^']*)'/u.exec(tag)?.[1] ?? '{}');

  it('plays full until the voice lead-in and sits well under the voice afterwards', () => {
    const points = automation.lanes[0].points;
    expect(points.at(0)).toEqual({ t: 0, v: 1 });
    expect(points.find((p: { t: number }) => p.t === IMPACT_VOICE_LEAD_IN_SEC)).toEqual({ t: IMPACT_VOICE_LEAD_IN_SEC, v: IMPACT_UNDER_VOICE_LEVEL });
    expect(points.at(-1)).toEqual({ t: IMPACT_DURATION_SEC, v: IMPACT_UNDER_VOICE_LEVEL });
  });

  it('keeps the effect at least 10 dB under a -25.5 LUFS voice while it overlaps it', () => {
    const impactTailLufs = -6.5 - 2;
    const underVoice = impactTailLufs + 20 * Math.log10(IMPACT_TRACK_VOLUME * IMPACT_UNDER_VOICE_LEVEL);
    expect(-25.5 - underVoice).toBeGreaterThanOrEqual(10);
  });
});
