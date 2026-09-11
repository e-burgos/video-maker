import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  LANGUAGE_STORAGE_KEY,
  detectLanguage,
  isLanguage,
  languageNameKey,
  navigatorLanguages,
  preferredLanguage,
  readStoredLanguage,
  storeLanguage,
} from './language';

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('isLanguage', () => {
  it('accepts only the languages the studio ships', () => {
    expect(isLanguage('en')).toBe(true);
    expect(isLanguage('es')).toBe(true);
    expect(isLanguage('pt')).toBe(false);
    expect(isLanguage('es-AR')).toBe(false);
    expect(isLanguage(null)).toBe(false);
  });
});

describe('preferredLanguage', () => {
  it('honours a stored choice over the browser', () => {
    expect(preferredLanguage('es', ['en-US'])).toBe('es');
    expect(preferredLanguage('en', ['es-AR'])).toBe('en');
  });

  it('falls to the browser when nothing was stored', () => {
    expect(preferredLanguage(null, ['es-AR', 'en-US'])).toBe('es');
    expect(preferredLanguage(null, ['en-GB'])).toBe('en');
  });

  it('reads any regional spanish as spanish', () => {
    expect(preferredLanguage(null, ['ES-ar'])).toBe('es');
    expect(preferredLanguage(null, ['es'])).toBe('es');
  });

  it('skips a language the studio does not ship and keeps looking', () => {
    expect(preferredLanguage(null, ['pt-BR', 'es-AR'])).toBe('es');
  });

  it('ends in english when neither the storage nor the browser decides', () => {
    expect(preferredLanguage(null, [])).toBe('en');
    expect(preferredLanguage('fr', ['pt-BR'])).toBe('en');
  });
});

describe('language storage', () => {
  it('persists a choice and reads it back', () => {
    storeLanguage('es');

    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('es');
    expect(readStoredLanguage()).toBe('es');
  });

  it('survives a browser that refuses local storage', () => {
    vi.spyOn(window.localStorage.__proto__, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(window.localStorage.__proto__, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });

    expect(() => storeLanguage('es')).not.toThrow();
    expect(readStoredLanguage()).toBeNull();
  });
});

describe('navigatorLanguages', () => {
  it('prefers the ordered list the browser exposes', () => {
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['es-AR', 'en-US']);

    expect(navigatorLanguages()).toEqual(['es-AR', 'en-US']);
  });

  it('falls back to the single language when the list is empty', () => {
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue([]);
    vi.spyOn(window.navigator, 'language', 'get').mockReturnValue('es-AR');

    expect(navigatorLanguages()).toEqual(['es-AR']);
  });

  it('reports nothing when the browser exposes nothing', () => {
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue([]);
    vi.spyOn(window.navigator, 'language', 'get').mockReturnValue('');

    expect(navigatorLanguages()).toEqual([]);
  });
});

describe('detectLanguage', () => {
  it('opens the studio in the stored language', () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'es');
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['en-US']);

    expect(detectLanguage()).toBe('es');
  });

  it('opens a spanish browser in spanish with nothing stored', () => {
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['es-AR', 'en-US']);

    expect(detectLanguage()).toBe('es');
  });

  it('opens in english when neither decides', () => {
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['pt-BR']);

    expect(detectLanguage()).toBe('en');
  });
});

describe('languageNameKey', () => {
  it('names the key that spells out each language', () => {
    expect(languageNameKey('en')).toBe('language.name.en');
    expect(languageNameKey('es')).toBe('language.name.es');
  });
});
