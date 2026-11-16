import { describe, expect, it } from 'vitest';

import { splitBackticks } from './inline-parts';

describe('splitBackticks', () => {
  it('turns backtick spans into code parts', () => {
    expect(splitBackticks('El CLI `claude` de Anthropic')).toEqual(['El CLI ', { code: 'claude' }, ' de Anthropic']);
  });

  it('keeps plain text as a single part', () => {
    expect(splitBackticks('sin código')).toEqual(['sin código']);
  });

  it('returns nothing for empty text', () => {
    expect(splitBackticks('')).toEqual([]);
  });
});
