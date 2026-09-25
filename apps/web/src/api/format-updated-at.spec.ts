import { describe, expect, it } from 'vitest';

import { formatUpdatedAt } from './format-updated-at';

describe('formatUpdatedAt', () => {
  const REFERENCE_MS = Date.UTC(2026, 8, 24, 12, 0, 0);

  it('formats a short day and month in spanish', () => {
    expect(formatUpdatedAt(REFERENCE_MS, 'es')).toMatch(/24/u);
  });

  it('formats a short day and month in english', () => {
    expect(formatUpdatedAt(REFERENCE_MS, 'en')).toMatch(/24/u);
  });
});
