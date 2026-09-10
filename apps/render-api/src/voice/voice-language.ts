const BCP47_PRIMARY_SUBTAG = /^[A-Za-z]{2,3}/u;
const WHISPER_AUTO_LANGUAGE = 'auto';

export function whisperLanguageFor(languageTag: string): string {
  const primary = BCP47_PRIMARY_SUBTAG.exec(languageTag)?.[0];
  return primary === undefined ? WHISPER_AUTO_LANGUAGE : primary.toLowerCase();
}
