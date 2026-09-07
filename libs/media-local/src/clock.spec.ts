import { describe, expect, it } from 'vitest';

import { systemClock } from './clock';

describe('systemClock', () => {
  it('nowIso devuelve una fecha ISO 8601 válida', () => {
    const before = Date.now();
    const iso = systemClock.nowIso();
    const after = Date.now();

    expect(iso).toBe(new Date(iso).toISOString());
    const parsed = new Date(iso).getTime();
    expect(parsed).toBeGreaterThanOrEqual(before);
    expect(parsed).toBeLessThanOrEqual(after);
  });
});
