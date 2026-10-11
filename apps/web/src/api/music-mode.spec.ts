import { describe, expect, it } from 'vitest';

import { floorTextOf, parseFloorDb } from './music-mode';

describe('parseFloorDb', () => {
  it('accepts dB values between -60 and -6, with a dot or a comma', () => {
    expect(parseFloorDb('-30')).toBe(-30);
    expect(parseFloorDb('-12,5')).toBe(-12.5);
    expect(parseFloorDb('-60')).toBe(-60);
    expect(parseFloorDb('-6')).toBe(-6);
  });

  it('rejects what is out of range or not a number', () => {
    expect(parseFloorDb('-61')).toBeNull();
    expect(parseFloorDb('-5')).toBeNull();
    expect(parseFloorDb('')).toBeNull();
    expect(parseFloorDb('-')).toBeNull();
    expect(parseFloorDb('abc')).toBeNull();
  });
});

describe('floorTextOf', () => {
  it('falls back to the -30 dB default', () => {
    expect(floorTextOf(undefined)).toBe('-30');
    expect(floorTextOf(-18)).toBe('-18');
  });
});
