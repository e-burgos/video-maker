import { describe, expect, it } from 'vitest';

import { isValidProjectSlug } from './project-slug';

describe('isValidProjectSlug', () => {
  it('accepts a kebab-case single segment and rejects dots, slashes, uppercase and spaces', () => {
    for (const value of ['smoke-ingest', 'a', 'a1-b2', 'acme-launch-02']) {
      expect(isValidProjectSlug(value)).toBe(true);
    }

    for (const value of ['.', '..', 'a/b', 'A-b', 'a b', '-a', 'a-', 'a--b', '']) {
      expect(isValidProjectSlug(value)).toBe(false);
    }
  });
});
