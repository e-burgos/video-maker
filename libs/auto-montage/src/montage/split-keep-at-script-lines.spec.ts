import { describe, expect, it } from 'vitest';

import { splitKeepAtScriptLines } from './split-keep-at-script-lines';

const whole = [{ id: 'keep-0001', startMs: 0, endMs: 20_000 }];

describe('splitKeepAtScriptLines', () => {
  it('parte el keep único en el medio del hueco entre líneas, contiguos y sin perder material', () => {
    const lines = [
      { startMs: 500, endMs: 4000 },
      { startMs: 5000, endMs: 9000 },
      { startMs: 10_000, endMs: 19_000 },
    ];

    expect(splitKeepAtScriptLines(whole, lines, 450)).toEqual([
      { id: 'keep-0001', startMs: 0, endMs: 4500 },
      { id: 'keep-0002', startMs: 4500, endMs: 9500 },
      { id: 'keep-0003', startMs: 9500, endMs: 20_000 },
    ]);
  });

  it('no corta donde un tramo quedaría más corto que minKeepMs', () => {
    const lines = [
      { startMs: 0, endMs: 300 },
      { startMs: 400, endMs: 10_000 },
      { startMs: 10_100, endMs: 19_900 },
    ];

    expect(splitKeepAtScriptLines(whole, lines, 450).map((k) => [k.startMs, k.endMs])).toEqual([
      [0, 10_050],
      [10_050, 20_000],
    ]);
  });

  it('deja los keeps como están si ya hay cortes por silencio o si hay menos de dos líneas', () => {
    const two = [{ id: 'keep-0001', startMs: 0, endMs: 5000 }, { id: 'keep-0002', startMs: 6000, endMs: 9000 }];

    expect(splitKeepAtScriptLines(two, [{ startMs: 0, endMs: 1 }, { startMs: 2, endMs: 3 }], 450)).toBe(two);
    expect(splitKeepAtScriptLines(whole, [{ startMs: 0, endMs: 9000 }], 450)).toBe(whole);
  });
});
