import { describe, expect, it } from 'vitest';

import { parseMotionScript } from './motion-script';

const valid = {
  voice: 'es_AR-daniela-high',
  music: { file: 'Voxel Revolution.mp3', credit: 'Kevin MacLeod · CC BY 4.0' },
  scenes: [
    { id: 'hook', vo: 'Hola', minBars: 3 },
    { id: 'reveal', vo: 'Display Ads', anchor: 13.8 },
  ],
  sfx: [{ id: 'riser', scene: 'reveal', offset: -3.4 }],
};

describe('parseMotionScript', () => {
  it('applies defaults', () => {
    const script = parseMotionScript(valid);
    expect(script.lengthScale).toBe(1);
    expect(script.noWhooshOn).toEqual([]);
    expect(script.scenes[0]).toEqual({ id: 'hook', vo: 'Hola', minBars: 3, anchor: null });
    expect(script.scenes[1]).toMatchObject({ minBars: 2, anchor: 13.8 });
    expect(script.sfx[0]).toEqual({ id: 'riser', scene: 'reveal', word: null, offset: -3.4 });
  });

  it('parses the optional voice direction of a scene and omits it otherwise', () => {
    const script = parseMotionScript({ ...valid, sfx: [], scenes: [{ id: 'hook', vo: 'Hola', direction: { pace: 'slow', energy: 'calm', pauseAfterMs: 500 } }, { id: 'end', vo: 'Chau' }] });
    expect(script.scenes[0]?.direction).toEqual({ pace: 'slow', energy: 'calm', pauseAfterMs: 500 });
    expect(script.scenes[1]).not.toHaveProperty('direction');
  });

  it('parses the music mode and floor and rejects an unknown mode', () => {
    const music = { file: 'a.mp3', credit: 'c', mode: 'segments', floorDb: -24 };
    expect(parseMotionScript({ ...valid, music }).music).toEqual(music);
    expect(parseMotionScript(valid).music).not.toHaveProperty('mode');
    expect(() => parseMotionScript({ ...valid, music: { ...music, mode: 'loud' } })).toThrow('music.mode');
    expect(() => parseMotionScript({ ...valid, music: { ...music, floorDb: 'x' } })).toThrow('music.floorDb');
  });

  it('rejects an invalid voice direction naming the scene', () => {
    expect(() => parseMotionScript({ ...valid, scenes: [{ id: 'hook', vo: 'Hola', direction: { pace: 'turbo' } }] })).toThrow('scenes[0].direction');
  });

  it('reads minSec when a scene sets it', () => {
    expect(parseMotionScript({ ...valid, sfx: [], scenes: [{ id: 'a', vo: 'x', minSec: 4.5 }] }).scenes[0]).toMatchObject({ minSec: 4.5 });
  });

  it.each([
    [{ ...valid, scenes: [] }, 'scenes must be a non-empty array'],
    [{ ...valid, scenes: [{ id: 'Hook', vo: 'x' }] }, 'kebab-case'],
    [{ ...valid, scenes: [{ id: 'a', vo: 'x' }, { id: 'a', vo: 'y' }] }, 'unique'],
    [{ ...valid, scenes: [{ id: 'a', vo: 'x', minBars: 0 }] }, 'minBars must be positive'],
    [{ ...valid, scenes: [{ id: 'a', vo: 'x', minSec: 0 }] }, 'minSec must be positive'],
    [{ ...valid, sfx: [{ id: 's', scene: 'nope' }] }, 'is not a scene id'],
    [{ ...valid, sfx: 'x' }, 'sfx must be an array'],
    [{ ...valid, noWhooshOn: [1] }, 'noWhooshOn'],
    [{ ...valid, music: { file: '' } }, 'music.file'],
    [{ ...valid, lengthScale: 'x' }, 'lengthScale'],
    [null, 'root must be an object'],
  ])('rejects invalid scripts (%#)', (raw, message) => {
    expect(() => parseMotionScript(raw)).toThrow(message);
  });
});
