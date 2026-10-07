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

  it.each([
    [{ ...valid, scenes: [] }, 'scenes must be a non-empty array'],
    [{ ...valid, scenes: [{ id: 'Hook', vo: 'x' }] }, 'kebab-case'],
    [{ ...valid, scenes: [{ id: 'a', vo: 'x' }, { id: 'a', vo: 'y' }] }, 'unique'],
    [{ ...valid, scenes: [{ id: 'a', vo: 'x', minBars: 0 }] }, 'minBars must be positive'],
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
