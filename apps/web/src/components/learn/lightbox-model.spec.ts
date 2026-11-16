import { describe, expect, it } from 'vitest';

import { stepLightboxIndex } from './lightbox-model';

describe('stepLightboxIndex', () => {
  it('wraps around both ends', () => {
    expect(stepLightboxIndex(3, 2, 1)).toBe(0);
    expect(stepLightboxIndex(3, 0, -1)).toBe(2);
  });

  it('stays at zero when there is nothing to step through', () => {
    expect(stepLightboxIndex(0, 0, 1)).toBe(0);
  });
});
