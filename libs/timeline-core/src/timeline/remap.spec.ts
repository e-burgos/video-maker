import { describe, expect, it } from 'vitest';

import { pruneSilences } from '../silence/prune-silences';
import { remapMsAfterCuts } from './remap-ms-after-cuts';

describe('remapMsAfterCuts', () => {
  it('CA-012: ubica un instante posterior a un corte descontando su duración', () => {
    const { keeps } = pruneSilences(10_000, [{ startMs: 4000, endMs: 5000 }]);

    expect(remapMsAfterCuts(6000, keeps)).toBe(5160);
  });

  it('keeps vacío devuelve siempre 0', () => {
    expect(remapMsAfterCuts(500, [])).toBe(0);
  });

  it('un instante dentro de un cut cae en el borde izquierdo (fin del keep anterior)', () => {
    const { keeps } = pruneSilences(10_000, [{ startMs: 4000, endMs: 5000 }]);

    expect(remapMsAfterCuts(4500, keeps)).toBe(4080);
  });

  it('un instante en el borde exacto del inicio de un cut queda en ese mismo borde', () => {
    const { keeps } = pruneSilences(10_000, [{ startMs: 4000, endMs: 5000 }]);

    expect(remapMsAfterCuts(4080, keeps)).toBe(4080);
  });

  it('un instante en el borde exacto del fin de un cut (inicio del siguiente keep) no descuenta ese keep', () => {
    const { keeps } = pruneSilences(10_000, [{ startMs: 4000, endMs: 5000 }]);

    expect(remapMsAfterCuts(4920, keeps)).toBe(4080);
  });

  it('un instante más allá del último keep devuelve la duración total mantenida', () => {
    const { keeps } = pruneSilences(10_000, [{ startMs: 4000, endMs: 5000 }]);

    expect(remapMsAfterCuts(15_000, keeps)).toBe(9160);
  });

  it('es monótona no decreciente en ms sobre un mismo conjunto de keeps', () => {
    const { keeps } = pruneSilences(10_000, [{ startMs: 4000, endMs: 5000 }]);
    const samples = [0, 1000, 4080, 4500, 4920, 6000, 9000, 10_000, 12_000];

    const remapped = samples.map((ms) => remapMsAfterCuts(ms, keeps));

    for (let index = 1; index < remapped.length; index += 1) {
      const previous = remapped[index - 1];
      const current = remapped[index];
      expect(current).toBeGreaterThanOrEqual(previous ?? 0);
    }
  });
});
