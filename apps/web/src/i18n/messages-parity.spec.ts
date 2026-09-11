import { describe, expect, it } from 'vitest';

import { MESSAGES_EN } from './messages-en';
import { MESSAGES_ES } from './messages-es';
import { LANGUAGES } from './language';

const PLURAL_SUFFIXES = ['.one', '.other'];

describe('translation catalogs', () => {
  it('covers in spanish every key the english catalog declares', () => {
    const missing = Object.keys(MESSAGES_EN).filter(
      (key) => !Object.prototype.hasOwnProperty.call(MESSAGES_ES, key),
    );

    expect(missing).toEqual([]);
  });

  it('declares no spanish key the english catalog does not have', () => {
    const extra = Object.keys(MESSAGES_ES).filter(
      (key) => !Object.prototype.hasOwnProperty.call(MESSAGES_EN, key),
    );

    expect(extra).toEqual([]);
  });

  it('leaves no translation empty in either language', () => {
    const empty = [...Object.entries(MESSAGES_EN), ...Object.entries(MESSAGES_ES)]
      .filter(([, value]) => value.trim() === '')
      .map(([key]) => key);

    expect(empty).toEqual([]);
  });

  it('keeps the same named placeholders in both languages', () => {
    const names = (template: string): string[] =>
      [...template.matchAll(/\{([a-zA-Z][a-zA-Z0-9]*)\}/gu)].map((match) => match[1] as string).sort();

    const diverging = Object.keys(MESSAGES_EN).filter((key) => {
      const typed = key as keyof typeof MESSAGES_EN;
      return names(MESSAGES_EN[typed]).join(',') !== names(MESSAGES_ES[typed]).join(',');
    });

    expect(diverging).toEqual([]);
  });

  it('declares both variants of every plural key', () => {
    const bases = new Set(
      Object.keys(MESSAGES_EN)
        .filter((key) => PLURAL_SUFFIXES.some((suffix) => key.endsWith(suffix)))
        .map((key) => key.slice(0, key.lastIndexOf('.'))),
    );

    const incomplete = [...bases].filter((base) =>
      PLURAL_SUFFIXES.some(
        (suffix) => !Object.prototype.hasOwnProperty.call(MESSAGES_EN, `${base}${suffix}`),
      ),
    );

    expect(incomplete).toEqual([]);
  });

  it('names every supported language in every catalog', () => {
    for (const language of LANGUAGES) {
      expect(MESSAGES_EN[`language.name.${language}`]).toBeTruthy();
      expect(MESSAGES_ES[`language.name.${language}`]).toBeTruthy();
    }
  });
});
