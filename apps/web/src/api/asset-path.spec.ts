import { describe, expect, it } from 'vitest';

import { assetFileName } from './asset-path';

describe('assetFileName', () => {
  it('takes the last segment of a project-relative asset path', () => {
    expect(assetFileName('raw/aroll/clip01.mp4')).toBe('clip01.mp4');
    expect(assetFileName('raw/images/photo 01.jpg')).toBe('photo 01.jpg');
  });

  it('returns a bare filename unchanged', () => {
    expect(assetFileName('clip01.mp4')).toBe('clip01.mp4');
  });

  it('returns an empty name for a path that ends in a separator', () => {
    expect(assetFileName('raw/aroll/')).toBe('');
  });
});
