import { describe, expect, it } from 'vitest';

import { buildMotionLevelPlans } from './motion-level-plans';
import { parseMotionSfxCues } from './motion-sfx-cues';

const timeline = {
  duration: 20,
  scenes: [{ id: 'reveal', start: 10, end: 16, voStart: 10.8, voDuration: 4 }],
  musicAutomation: { lanes: [{ target: 'volume', points: [{ t: 0, v: 0.885 }, { t: 10.55, v: 0.885 }, { t: 10.8, v: 0.198 }, { t: 20, v: 0.198 }] }] },
};

describe('buildMotionLevelPlans', () => {
  it('gives the effect the automated gain instead of its track volume while it overlaps the voice', () => {
    const automation = { version: 1, lanes: [{ target: 'volume', points: [{ t: 0, v: 1 }, { t: 0.8, v: 0.03 }, { t: 2, v: 0.03 }] }] };
    const html = `<audio id="sfx-impact" src="assets/runtime/sfx/impact-bass-1.mp3" data-start="10" data-duration="2" data-volume="0.8" data-automation='${JSON.stringify(automation)}'></audio>`;
    const [plan] = buildMotionLevelPlans(timeline, '/w', true, parseMotionSfxCues(html));
    const gainDb = plan?.sfx[0]?.gainDb ?? 0;
    expect(gainDb).toBeCloseTo(20 * Math.log10(0.8 * 0.03), 0);
  });

  it('measures the music gain from the planned automation', () => {
    const [plan] = buildMotionLevelPlans(timeline, '/w', true);
    expect(plan?.musicGainDb).toBeCloseTo(20 * Math.log10(0.8 * 0.198), 1);
  });
});
