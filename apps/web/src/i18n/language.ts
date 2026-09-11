import type { TranslationKey } from './messages-en';

export const LANGUAGES = ['en', 'es'] as const;

export type Language = (typeof LANGUAGES)[number];

export const LANGUAGE_STORAGE_KEY = 'video-maker.language';

export const FALLBACK_LANGUAGE: Language = 'en';

export function isLanguage(value: string | null): value is Language {
  return value !== null && (LANGUAGES as readonly string[]).includes(value);
}

export function languageNameKey(language: Language): TranslationKey {
  return language === 'es' ? 'language.name.es' : 'language.name.en';
}

export function preferredLanguage(
  stored: string | null,
  candidates: readonly string[],
): Language {
  if (isLanguage(stored)) {
    return stored;
  }

  for (const candidate of candidates) {
    const base = candidate.toLowerCase().split('-')[0] ?? '';
    if (isLanguage(base)) {
      return base;
    }
  }

  return FALLBACK_LANGUAGE;
}

export function readStoredLanguage(): string | null {
  try {
    return window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function storeLanguage(language: Language): void {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    return;
  }
}

export function navigatorLanguages(): readonly string[] {
  const preferences = window.navigator.languages;
  if (Array.isArray(preferences) && preferences.length > 0) {
    return preferences;
  }
  const single = window.navigator.language;
  return typeof single === 'string' && single.length > 0 ? [single] : [];
}

export function detectLanguage(): Language {
  return preferredLanguage(readStoredLanguage(), navigatorLanguages());
}
