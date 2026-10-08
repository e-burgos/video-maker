import { describe, expect, it } from 'vitest';

import { publishLanguageFromVoice } from './publish-preconditions';

describe('publishLanguageFromVoice', () => {
  it('takes the language prefix of the brand voice id', () => {
    expect(publishLanguageFromVoice('es_AR-daniela-high')).toBe('es');
    expect(publishLanguageFromVoice('en_US-amy-medium')).toBe('en');
  });

  it('falls back to es without a brand voice or with an unreadable id', () => {
    expect(publishLanguageFromVoice(null)).toBe('es');
    expect(publishLanguageFromVoice('')).toBe('es');
    expect(publishLanguageFromVoice('9999')).toBe('es');
  });
});
