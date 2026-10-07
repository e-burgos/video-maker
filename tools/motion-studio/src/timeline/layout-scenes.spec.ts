import { describe, expect, it } from 'vitest';

import type { MotionScene } from '../script/motion-script';
import { layoutScenes } from './layout-scenes';

const beats = Array.from({ length: 200 }, (_, i) => Math.round((0.04 + i * 0.5) * 1000) / 1000);
const slotAt = <T>(list: T[], index: number): T => {
  const item = list[index];
  if (item === undefined) throw new Error(`no slot ${index}`);
  return item;
};
const scene = (id: string, minBars = 1, anchor: number | null = null): MotionScene => ({ id, vo: 'x', minBars, anchor });

describe('layoutScenes', () => {
  it('starts every scene after the first on a beat when beat sync is on', () => {
    const slots = layoutScenes([scene('a'), scene('b'), scene('c')], [3.1, 1.2, 4.4], { beatSync: true, beats });
    for (const slot of slots.slice(1)) expect(beats).toContain(slot.start);
    expect(slotAt(slots, 0).voStart).toBe(0.25);
  });

  it('keeps a scene at least minBars long and never cuts the voice', () => {
    const slot = slotAt(layoutScenes([scene('a', 3)], [1], { beatSync: true, beats }), 0);
    expect(slot.end - slot.start).toBeGreaterThanOrEqual(6 - 1e-6);
    const long = slotAt(layoutScenes([scene('a', 1)], [7.3], { beatSync: true, beats }), 0);
    expect(long.end).toBeGreaterThanOrEqual(long.voStart + 7.3 + 0.55);
  });

  it('snaps an anchored scene to the nearest bar and stretches the previous scene to it', () => {
    const slots = layoutScenes([scene('a'), scene('drop', 1, 13.8)], [2, 2], { beatSync: true, beats });
    expect(slotAt(slots, 1).start).toBe(14.04);
    expect(slotAt(slots, 0).end).toBe(14.04);
  });

  it('ignores an anchor the voice has already passed', () => {
    const slots = layoutScenes([scene('a'), scene('late', 1, 2)], [6, 1], { beatSync: true, beats });
    expect(slotAt(slots, 1).start).toBe(slotAt(slots, 0).end);
    expect(slotAt(slots, 1).start).toBeGreaterThan(6);
  });

  it('follows the voice and ignores the grid when beat sync is off', () => {
    const slots = layoutScenes([scene('a', 4, 1), scene('b', 4, 30)], [2, 1], { beatSync: false, beats });
    expect(slots[0]).toEqual({ id: 'a', start: 0, end: 2.8, voStart: 0.25, voDuration: 2 });
    expect(slotAt(slots, 1).start).toBe(2.8);
    expect(slotAt(slots, 1).end).toBe(4.6);
  });
});
