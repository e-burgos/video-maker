export type RandomGenerator = () => number;

const MULBERRY32_INCREMENT = 0x6d2b79f5;
const UINT32_RANGE = 4294967296;

export function createSeededRandom(seed: number): RandomGenerator {
  let state = seed >>> 0;

  return () => {
    state = (state + MULBERRY32_INCREMENT) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / UINT32_RANGE;
  };
}

export function pickFromPool<T>(pool: readonly [T, ...T[]], next: RandomGenerator): T {
  const index = Math.min(Math.floor(next() * pool.length), pool.length - 1);
  return pool[index] ?? pool[0];
}

export function pickAvoidingPrevious<T>(
  pool: readonly [T, ...T[]],
  previous: T | undefined,
  next: RandomGenerator,
): T {
  const [first, ...rest] = pool.filter((candidate) => candidate !== previous);
  return first === undefined ? pickFromPool(pool, next) : pickFromPool([first, ...rest], next);
}

export function hashStringToSeed(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193);
  }
  return hash >>> 0;
}
