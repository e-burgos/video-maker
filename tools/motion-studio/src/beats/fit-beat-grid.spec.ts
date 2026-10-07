import { describe, expect, it } from 'vitest';

import { fitBeatGrid } from './fit-beat-grid';
import type { Onset } from './parse-hyperframes-beats';

function pulse(bpm: number, phase: number, count: number, jitter: (i: number) => number = () => 0): Onset[] {
  const period = 60 / bpm;
  return Array.from({ length: count }, (_, i) => ({ time: phase + i * period + jitter(i), strength: i % 4 === 0 ? 0.9 : 0.5 }));
}

describe('fitBeatGrid', () => {
  it('recovers tempo and phase of a steady pulse', () => {
    const grid = fitBeatGrid(pulse(122, 0.04, 160), 80);
    expect(grid.bpm).toBeCloseTo(122, 1);
    expect(grid.phase).toBeCloseTo(0.04, 2);
    expect(grid.confidence).toBeGreaterThan(0.95);
  });

  it('stays locked to the pulse when onsets are jittered and doubled with weak off-beats', () => {
    const steady = pulse(110, 0.3, 140, (i) => (i % 3 === 0 ? 0.012 : -0.008));
    const offBeats = steady.map((onset) => ({ time: onset.time + 60 / 110 / 2, strength: 0.15 }));
    const grid = fitBeatGrid([...steady, ...offBeats].sort((a, b) => a.time - b.time), 75);
    expect(grid.bpm).toBeCloseTo(110, 0);
    expect(Math.abs(grid.phase - 0.3)).toBeLessThan(0.03);
  });

  it('folds a double-time detection into the 90–140 BPM window', () => {
    const grid = fitBeatGrid(pulse(244, 0.04, 300), 70);
    expect(grid.bpm).toBeCloseTo(122, 0);
  });

  it('lists every beat of the grid up to the duration, without drift', () => {
    const grid = fitBeatGrid(pulse(120, 0.1, 100), 10);
    expect(grid.beats[0]).toBeCloseTo(0.1, 2);
    expect(grid.beats.at(-1)).toBeLessThanOrEqual(10);
    expect(grid.beats.length).toBe(20);
    expect(grid.beats[19]).toBeCloseTo(0.1 + 19 * 0.5, 2);
  });

  it('rejects too few onsets', () => {
    expect(() => fitBeatGrid(pulse(120, 0, 3), 5)).toThrow(/at least 4 onsets/u);
  });
});
