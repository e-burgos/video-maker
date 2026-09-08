import { describe, expect, it } from 'vitest';

import { gainDbToVolume } from './gain-db-to-volume';

describe('gainDbToVolume', () => {
  it('convierte -6 dB al factor lineal esperado', () => {
    expect(gainDbToVolume(-6)).toBeCloseTo(0.501187234, 9);
  });

  it('convierte 0 dB a la identidad', () => {
    expect(gainDbToVolume(0)).toBe(1);
  });

  it('clampea ganancias positivas a 1', () => {
    expect(gainDbToVolume(20)).toBe(1);
  });

  it('clampea ganancias muy negativas a 0', () => {
    expect(gainDbToVolume(-8000)).toBe(0);
  });
});
