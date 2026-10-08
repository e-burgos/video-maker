import { describe, expect, it } from 'vitest';

import { stripSuggestionsFence } from './producer-suggestions-fence';

describe('stripSuggestionsFence', () => {
  it('removes the trailing suggestions block', () => {
    const text = 'Listo el guion.\n```suggestions\n["Dale", "Cambiar"]\n```\n';
    expect(stripSuggestionsFence(text)).toBe('Listo el guion.');
  });

  it('leaves text without a fence untouched', () => {
    expect(stripSuggestionsFence('Hola')).toBe('Hola');
  });

  it('keeps other code fences', () => {
    const text = '```json\n{}\n```';
    expect(stripSuggestionsFence(text)).toBe(text);
  });
});
