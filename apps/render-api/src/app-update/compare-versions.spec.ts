import { describe, expect, it } from 'vitest';

import { isNewerVersion } from './compare-versions';

describe('isNewerVersion', () => {
  it('detects a higher patch, minor and major', () => {
    expect(isNewerVersion('0.3.3', '0.3.2')).toBe(true);
    expect(isNewerVersion('0.4.0', '0.3.9')).toBe(true);
    expect(isNewerVersion('1.0.0', '0.9.9')).toBe(true);
  });

  it('compares numerically, not lexically', () => {
    expect(isNewerVersion('0.10.0', '0.9.0')).toBe(true);
  });

  it('reports equal and older versions as not newer', () => {
    expect(isNewerVersion('0.3.2', '0.3.2')).toBe(false);
    expect(isNewerVersion('0.3.1', '0.3.2')).toBe(false);
  });

  it('ignores pre-release suffixes and a leading v', () => {
    expect(isNewerVersion('v0.3.2', '0.3.2-dev')).toBe(false);
    expect(isNewerVersion('0.3.3', '0.3.2-beta.1')).toBe(true);
  });

  it('returns null when a version is not numeric', () => {
    expect(isNewerVersion('latest', '0.3.2')).toBeNull();
    expect(isNewerVersion('0.3.2', '')).toBeNull();
  });
});
