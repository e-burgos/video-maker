import { describe, expect, it } from 'vitest';

import { createSeededRandom, hashStringToSeed, pickAvoidingPrevious, pickFromPool } from './seeded-random';

describe('seeded-random', () => {
  it('repite la misma secuencia con la misma semilla y cambia con otra', () => {
    const first = createSeededRandom(7);
    const again = createSeededRandom(7);
    const other = createSeededRandom(8);
    const a = [first(), first(), first()];

    expect([again(), again(), again()]).toEqual(a);
    expect([other(), other(), other()]).not.toEqual(a);
  });

  it('pickFromPool siempre devuelve un elemento del pool', () => {
    const next = createSeededRandom(3);
    const pool = ['a', 'b', 'c'] as const;

    for (let i = 0; i < 50; i += 1) expect(pool).toContain(pickFromPool(pool, next));
  });

  it('pickAvoidingPrevious nunca repite el anterior si hay alternativa', () => {
    const next = createSeededRandom(11);
    const pool = ['a', 'b'] as const;
    let previous: (typeof pool)[number] | undefined;

    for (let i = 0; i < 30; i += 1) {
      const picked = pickAvoidingPrevious(pool, previous, next);
      expect(picked).not.toBe(previous);
      previous = picked;
    }
  });

  it('pickAvoidingPrevious devuelve el único elemento aunque sea el anterior', () => {
    expect(pickAvoidingPrevious(['a'], 'a', createSeededRandom(1))).toBe('a');
  });

  it('hashStringToSeed es estable y distingue textos', () => {
    expect(hashStringToSeed('video uno')).toBe(hashStringToSeed('video uno'));
    expect(hashStringToSeed('video uno')).not.toBe(hashStringToSeed('video dos'));
  });
});
