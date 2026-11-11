import { describe, expect, it } from 'vitest';

import { createSeededRandom, hashStringToSeed, pickAvoidingPrevious, pickAvoidingRecent, pickFromPool } from './seeded-random';

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

  it('pickAvoidingRecent no repite ninguno de los recientes y, si el pool no alcanza, solo evita el último', () => {
    const next = createSeededRandom(5);
    const pool = ['a', 'b', 'c', 'd'] as const;
    const picked: string[] = [];

    for (let i = 0; i < 40; i += 1) picked.push(pickAvoidingRecent(pool, picked.slice(-2) as never, next));
    picked.slice(2).forEach((value, i) => expect([picked[i], picked[i + 1]]).not.toContain(value));
    expect(pickAvoidingRecent(['a', 'b'], ['a', 'b'], next)).toBe('a');
  });

  it('hashStringToSeed es estable y distingue textos', () => {
    expect(hashStringToSeed('video uno')).toBe(hashStringToSeed('video uno'));
    expect(hashStringToSeed('video uno')).not.toBe(hashStringToSeed('video dos'));
  });
});
