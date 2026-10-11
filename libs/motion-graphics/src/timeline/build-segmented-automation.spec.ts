import { describe, expect, it } from 'vitest';

import { buildDuckAutomation } from './build-duck-automation';
import { buildSegmentedAutomation, floorLevelFor } from './build-segmented-automation';

const slots = [
  { id: 'a', start: 0, end: 12, voStart: 6, voDuration: 3 },
  { id: 'b', start: 12, end: 20, voStart: 10, voDuration: 4 },
  { id: 'c', start: 20, end: 40, voStart: 24, voDuration: 3 },
];

const pointsOf = (automation: ReturnType<typeof buildSegmentedAutomation>) => automation.lanes[0].points;
const valueAt = (automation: ReturnType<typeof buildSegmentedAutomation>, t: number) => pointsOf(automation).find((p) => p.t === t)?.v;

describe('buildSegmentedAutomation (US-023-303)', () => {
  const automation = buildSegmentedAutomation(slots, 40, { bedLevel: 0.5 });

  it('plays the music full in the intro with a 0.6 s fade in', () => {
    expect(pointsOf(automation)[0]).toEqual({ t: 0, v: 0 });
    expect(valueAt(automation, 0.6)).toBe(0.5);
    expect(valueAt(automation, 5.4)).toBe(0.5);
  });

  it('drops to the floor 30 dB under the full level while the voice speaks, with 0.6 s fades', () => {
    const floor = floorLevelFor(0.5, -30);
    expect(floor).toBe(0.0158);
    expect(valueAt(automation, 6)).toBe(floor);
    expect(valueAt(automation, 14)).toBe(floor);
  });

  it('merges scenes whose voices are less than 2 s apart into one spoken stretch', () => {
    const between = pointsOf(automation).filter((p) => p.t > 6 && p.t < 14);
    expect(between).toEqual([]);
  });

  it('returns to the full level in a voice-free gap of 2 s or more and in the outro', () => {
    expect(valueAt(automation, 14.6)).toBe(0.5);
    expect(valueAt(automation, 23.4)).toBe(0.5);
    expect(valueAt(automation, 27.6)).toBe(0.5);
    expect(pointsOf(automation).at(-1)).toEqual({ t: 40, v: 0 });
  });

  it('honours a configurable floor', () => {
    const custom = buildSegmentedAutomation(slots, 40, { bedLevel: 0.5, floorDb: -20 });
    expect(valueAt(custom, 6)).toBe(floorLevelFor(0.5, -20));
  });

  it('keeps time strictly increasing when the voice starts before the fade fits', () => {
    const hurried = buildSegmentedAutomation([{ id: 'a', start: 0, end: 6, voStart: 0.25, voDuration: 4 }], 5, { bedLevel: 0.5 });
    const times = pointsOf(hurried).map((p) => p.t);
    expect(times.every((t, i) => i === 0 || t > (times[i - 1] ?? Infinity))).toBe(true);
    expect(pointsOf(hurried)[0]).toEqual({ t: 0, v: 0 });
    expect(Math.max(...pointsOf(hurried).map((p) => p.v))).toBeLessThan(0.5);
  });

  it('is a plain bed when there is no voice', () => {
    expect(pointsOf(buildSegmentedAutomation([], 30, { bedLevel: 0.5 }))).toEqual([
      { t: 0, v: 0 },
      { t: 0.6, v: 0.5 },
      { t: 27.5, v: 0.5 },
      { t: 30, v: 0 },
    ]);
  });

  it('leaves the bed automation untouched', () => {
    const bed = buildDuckAutomation(slots, 40, { bedLevel: 0.5, duckLevel: 0.15 });
    expect(valueAt(bed, 6)).toBe(0.15);
  });
});
