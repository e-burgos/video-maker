const BCP47_PRIMARY_SUBTAG = /^[A-Za-z]{2,3}/u;
const WHISPER_AUTO_LANGUAGE = 'auto';

const VOICE_MODEL_LOCALE = /^([a-z]{2,3})(?:_([A-Za-z]{2,4}))?-/u;

export const DEFAULT_VOICE_LANGUAGE = 'es';

export function whisperLanguageFor(languageTag: string): string {
  const primary = BCP47_PRIMARY_SUBTAG.exec(languageTag)?.[0];
  return primary === undefined ? WHISPER_AUTO_LANGUAGE : primary.toLowerCase();
}

export function voiceLanguageFromModelId(voiceModelId: string): string {
  const match = VOICE_MODEL_LOCALE.exec(voiceModelId);
  if (match === null) {
    return DEFAULT_VOICE_LANGUAGE;
  }

  const [, language, region] = match;
  return region === undefined ? (language ?? DEFAULT_VOICE_LANGUAGE) : `${language}-${region}`;
}
