import type { Language } from '../i18n/language';

const LOCALE_BY_LANGUAGE: Readonly<Record<Language, string>> = {
  es: 'es-AR',
  en: 'en-US',
};

export function formatUpdatedAt(modifiedAtMs: number, language: Language): string {
  return new Intl.DateTimeFormat(LOCALE_BY_LANGUAGE[language], {
    day: 'numeric',
    month: 'short',
  }).format(new Date(modifiedAtMs));
}

export function formatDateTime(timestampMs: number, language: Language): string {
  return new Intl.DateTimeFormat(LOCALE_BY_LANGUAGE[language], {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestampMs));
}
