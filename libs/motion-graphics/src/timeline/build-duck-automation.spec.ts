import { describe, expect, it } from 'vitest';

import { buildDuckAutomation } from './build-duck-automation';

describe('buildDuckAutomation', () => {
  const slots = [
    { id: 'a', start: 0, end: 6, voStart: 0.25, voDuration: 4 },
    { id: 'b', start: 6, end: 12, voStart: 6.25, voDuration: 3 },
  ];

  it('ducks the bed under each voice line and fades the whole track in and out', () => {
    const { lanes } = buildDuckAutomation(slots, 12);
    const points = lanes[0].points;
    expect(points[0]).toEqual({ t: 0, v: 0 });
    expect(points.at(-1)).toEqual({ t: 12, v: 0 });
    const at = (t: number) => points.find((p) => p.t === t)?.v;
    expect(at(6.25)).toBe(0.32);
    expect(at(9.35)).toBe(0.32);
    expect(at(9.6)).toBe(0.85);
  });

  it('keeps the ducked level through the whole first voice when it starts before the fade-in ends', () => {
    const first = [
      { id: 'a', start: 0, end: 7.4, voStart: 0.25, voDuration: 6.56 },
      { id: 'b', start: 7.4, end: 14, voStart: 7.848, voDuration: 4.48 },
    ];
    const { lanes } = buildDuckAutomation(first, 20, { bedLevel: 0.885, duckLevel: 0.186 });
    const points = lanes[0].points;
    expect(points.slice(0, 4)).toEqual([{ t: 0, v: 0 }, { t: 0.01, v: 0.885 }, { t: 0.25, v: 0.186 }, { t: 6.91, v: 0.186 }]);
    expect(points.filter((p) => p.t > 0.25 && p.t < 6.91)).toEqual([]);
    expect(points.find((p) => p.t === 7.16)?.v).toBe(0.885);
  });

  it('keeps time strictly increasing even when ramps overlap', () => {
    const { lanes } = buildDuckAutomation([{ id: 'a', start: 0, end: 1, voStart: 0.1, voDuration: 0.3 }], 1.2, { fadeIn: 0.6, fadeOut: 2.5 });
    const times = lanes[0].points.map((p) => p.t);
    expect(times.every((t, i) => i === 0 || t > (times[i - 1] ?? Infinity))).toBe(true);
    expect(times[0]).toBe(0);
  });
});
