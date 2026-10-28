import { describe, expect, it } from 'vitest';

import { humanizeSlug, projectDisplayName } from './humanize-slug';

describe('humanizeSlug', () => {
  it('turns hyphens into spaces and capitalizes only the first letter', () => {
    expect(humanizeSlug('display-ads-analiticas')).toBe('Display ads analiticas');
  });

  it('capitalizes a single-word slug', () => {
    expect(humanizeSlug('demo')).toBe('Demo');
  });

  it('leaves an empty slug as-is', () => {
    expect(humanizeSlug('')).toBe('');
  });

  it('ignores stray leading or trailing hyphens', () => {
    expect(humanizeSlug('-demo-01-')).toBe('Demo 01');
  });
});
