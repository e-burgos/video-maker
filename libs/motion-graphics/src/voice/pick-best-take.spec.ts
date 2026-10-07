import { describe, expect, it } from 'vitest';

import { pickBestTake } from './pick-best-take';

const ports = (heard: string[]) => {
  const synthesized: number[] = [];
  return {
    synthesized,
    ports: {
      synthesizeTake: async (take: number) => {
        synthesized.push(take);
        return { path: `take${take}.wav`, durationSec: 2 + take };
      },
      transcribeTake: async (path: string) => ({ text: heard[Number(path.slice(4, 5))] ?? '', words: [] }),
    },
  };
};

describe('pickBestTake', () => {
  it('keeps the take that best matches the script', async () => {
    const fake = ports(['y playas cartelería', 'display ads cartelería digital', 'display us cartelería']);
    const { best, attempts } = await pickBestTake('Display Ads, cartelería digital.', fake.ports, { takes: 3, goodEnough: 1.1 });
    expect(attempts).toHaveLength(3);
    expect(best.take).toBe(1);
    expect(best.durationSec).toBe(3);
  });

  it('stops early once a take is good enough', async () => {
    const fake = ports(['display ads cartelería digital', 'nunca']);
    const { attempts } = await pickBestTake('Display Ads cartelería digital', fake.ports, { takes: 5 });
    expect(attempts).toHaveLength(1);
    expect(fake.synthesized).toEqual([0]);
  });

  it('always synthesizes at least one take', async () => {
    const fake = ports(['hola']);
    const { best } = await pickBestTake('hola', fake.ports, { takes: 0 });
    expect(best.take).toBe(0);
  });
});
