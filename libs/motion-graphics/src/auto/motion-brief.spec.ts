import { describe, expect, it } from 'vitest';

import { MotionStudioError } from '../errors/motion-studio-error';
import { briefImageRef, parseMotionBrief } from './motion-brief';

describe('parseMotionBrief', () => {
  it('fills defaults for format, beat sync, music and images', () => {
    const brief = parseMotionBrief({ version: 1, brand: 'acme', script: 'Hola' });
    expect(brief).toEqual({ version: 1, brand: 'acme', script: 'Hola', format: '16:9', beatSync: true, music: 'auto', images: [] });
  });

  it('accepts a fixed track, no music and described images', () => {
    expect(parseMotionBrief({ version: 1, brand: 'acme', script: 'Hola', music: null }).music).toBeNull();
    const brief = parseMotionBrief({ version: 1, brand: 'acme', script: 'Hola', music: 'beat', images: [{ file: 'a.jpg', caption: 'Un local' }] });
    expect(brief.images[0]?.caption).toBe('Un local');
  });

  it('reports BRIEF_INVALID with the failing field', () => {
    expect.assertions(3);
    try {
      parseMotionBrief({ version: 1, brand: 'acme', script: '', extra: true });
    } catch (error) {
      expect(error).toBeInstanceOf(MotionStudioError);
      expect((error as MotionStudioError).code).toBe('BRIEF_INVALID');
      expect((error as Error).message).toContain('script');
    }
  });

  it('rejects more than twelve images', () => {
    const images = Array.from({ length: 13 }, (_, i) => ({ file: `${i}.jpg`, caption: 'x' }));
    expect(() => parseMotionBrief({ version: 1, brand: 'acme', script: 'Hola', images })).toThrow(/images/u);
  });

  it('refers to brief images under images/', () => {
    expect(briefImageRef('a.jpg')).toBe('images/a.jpg');
    expect(briefImageRef('images/a.jpg')).toBe('images/a.jpg');
  });
});
