import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_LANGUAGE,
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
  it('honours a stored choice, whichever language it is', () => {
    expect(preferredLanguage('es')).toBe('es');
    expect(preferredLanguage('en')).toBe('en');
  });

  it('defaults to spanish when nothing was stored, regardless of the browser locale', () => {
    expect(preferredLanguage(null)).toBe(DEFAULT_LANGUAGE);
    expect(preferredLanguage(null)).toBe('es');
  });

  it('defaults to spanish for a stored value the studio does not ship', () => {
    expect(preferredLanguage('fr')).toBe('es');
    expect(preferredLanguage('pt-BR')).toBe('es');
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
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');

    expect(detectLanguage()).toBe('en');
  });

  it('opens in spanish with nothing stored, even on an english browser (dev request: spanish by default)', () => {
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['en-US']);

    expect(detectLanguage()).toBe('es');
  });

  it('opens in spanish with nothing stored on a spanish browser too', () => {
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['es-AR', 'en-US']);

    expect(detectLanguage()).toBe('es');
  });
});

describe('languageNameKey', () => {
  it('names the key that spells out each language', () => {
    expect(languageNameKey('en')).toBe('language.name.en');
    expect(languageNameKey('es')).toBe('language.name.es');
  });
});
