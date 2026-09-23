import { describe, expect, it } from 'vitest';

import { queryValue } from './query-value';

describe('queryValue', () => {
  it('is null on a path with no query string', () => {
    expect(queryValue('/projects/smoke/text', 'path')).toBeNull();
  });

  it('reads the named parameter', () => {
    expect(queryValue('/projects/smoke/text?path=work%2Fproducer%2Fnotes.md', 'path')).toBe(
      'work/producer/notes.md',
    );
  });

  it('reads the value among other parameters', () => {
    expect(queryValue('/projects/smoke/text?force=true&path=work/notes.txt', 'path')).toBe(
      'work/notes.txt',
    );
  });

  it('is null when the named parameter is absent', () => {
    expect(queryValue('/projects/smoke/text?force=true', 'path')).toBeNull();
  });

  it('ignores a different parameter name', () => {
    expect(queryValue('/projects/smoke/text?filepath=work/notes.txt', 'path')).toBeNull();
  });
});
