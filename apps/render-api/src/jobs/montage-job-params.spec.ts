import { describe, expect, it } from 'vitest';

import { parseMontageOverwrite, parseMontagePreset, parseMontageSeed } from './montage-job-params';

function captureError(run: () => unknown): unknown {
  try {
    run();
    return null;
  } catch (error) {
    return error;
  }
}

describe('parseMontagePreset', () => {
  it('defaults to software-demo when the value is absent', () => {
    expect(parseMontagePreset(undefined)).toBe('software-demo');
  });

  it('passes through each known preset name unchanged', () => {
    expect(parseMontagePreset('software-demo')).toBe('software-demo');
    expect(parseMontagePreset('hardware')).toBe('hardware');
    expect(parseMontagePreset('recipe')).toBe('recipe');
    expect(parseMontagePreset('educational')).toBe('educational');
  });

  it('rejects an unknown preset name with MONTAGE_PRESET_INVALID and the list of valid presets', () => {
    const error = captureError(() => parseMontagePreset('nope'));

    expect(error).toMatchObject({ code: 'MONTAGE_PRESET_INVALID', stage: null });
    expect((error as { expected: string }).expected).toContain('software-demo');
    expect((error as { expected: string }).expected).toContain('hardware');
    expect((error as { expected: string }).expected).toContain('recipe');
    expect((error as { expected: string }).expected).toContain('educational');
  });

  it('rejects a non-string preset value', () => {
    expect(captureError(() => parseMontagePreset(42))).toMatchObject({ code: 'MONTAGE_PRESET_INVALID' });
    expect(captureError(() => parseMontagePreset(null))).toMatchObject({ code: 'MONTAGE_PRESET_INVALID' });
  });
});

describe('parseMontageSeed', () => {
  it('defaults to 0 when the value is absent', () => {
    expect(parseMontageSeed(undefined)).toBe(0);
  });

  it('passes through a non-zero non-negative integer unchanged', () => {
    expect(parseMontageSeed(7)).toBe(7);
  });

  it('rejects a negative integer', () => {
    expect(captureError(() => parseMontageSeed(-1))).toMatchObject({
      code: 'MONTAGE_SEED_INVALID',
      stage: null,
    });
  });

  it('rejects a non-integer number', () => {
    expect(captureError(() => parseMontageSeed(1.5))).toMatchObject({ code: 'MONTAGE_SEED_INVALID' });
  });

  it('rejects a numeric string', () => {
    expect(captureError(() => parseMontageSeed('0'))).toMatchObject({ code: 'MONTAGE_SEED_INVALID' });
  });

  it('rejects NaN', () => {
    expect(captureError(() => parseMontageSeed(Number.NaN))).toMatchObject({ code: 'MONTAGE_SEED_INVALID' });
  });

  it('rejects Infinity', () => {
    expect(captureError(() => parseMontageSeed(Number.POSITIVE_INFINITY))).toMatchObject({
      code: 'MONTAGE_SEED_INVALID',
    });
  });
});

describe('parseMontageOverwrite', () => {
  it('defaults to false when the value is absent', () => {
    expect(parseMontageOverwrite(undefined)).toBe(false);
  });

  it('passes through true unchanged', () => {
    expect(parseMontageOverwrite(true)).toBe(true);
  });

  it('passes through false unchanged', () => {
    expect(parseMontageOverwrite(false)).toBe(false);
  });

  it('rejects the string "yes"', () => {
    expect(captureError(() => parseMontageOverwrite('yes'))).toMatchObject({
      code: 'MONTAGE_OVERWRITE_INVALID',
      stage: null,
    });
  });

  it('rejects the string "true"', () => {
    expect(captureError(() => parseMontageOverwrite('true'))).toMatchObject({
      code: 'MONTAGE_OVERWRITE_INVALID',
    });
  });

  it('rejects the number 1', () => {
    expect(captureError(() => parseMontageOverwrite(1))).toMatchObject({ code: 'MONTAGE_OVERWRITE_INVALID' });
  });

  it('rejects null', () => {
    expect(captureError(() => parseMontageOverwrite(null))).toMatchObject({ code: 'MONTAGE_OVERWRITE_INVALID' });
  });
});
