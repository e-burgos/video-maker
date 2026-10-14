import type { VoiceModel, VoiceQuality } from './render-api-types';
import type { TranslateFn } from '../i18n/language-context';
import type { TranslationKey } from '../i18n/messages-en';

export function voiceQualityKey(quality: VoiceQuality | null): TranslationKey | null {
  return quality === null ? null : (`voiceQuality.${quality}` as TranslationKey);
}

function languageDisplayName(code: string, uiLanguage: string): string | null {
  try {
    return new Intl.DisplayNames([uiLanguage], { type: 'language' }).of(code) ?? null;
  } catch {
    return null;
  }
}

function regionDisplayName(region: string | null, uiLanguage: string): string | null {
  if (region === null) {
    return null;
  }
  try {
    return new Intl.DisplayNames([uiLanguage], { type: 'region' }).of(region) ?? null;
  } catch {
    return null;
  }
}

export function translateVoiceDescription(
  voice: VoiceModel,
  uiLanguage: string,
  t: TranslateFn,
): string {
  if (uiLanguage === 'en' || voice.engine === 'elevenlabs') {
    return voice.description;
  }

  const languageName = languageDisplayName(voice.language.code, uiLanguage);
  if (languageName === null) {
    return voice.description;
  }

  const region = regionDisplayName(voice.language.region, uiLanguage);
  const qualityKey = voiceQualityKey(voice.quality ?? null);
  const quality = qualityKey === null ? t('voicePicker.qualityUnknown') : t(qualityKey);

  return t('voicePicker.descriptionTemplate', {
    language: region === null ? languageName : `${languageName} (${region})`,
    quality,
  });
}
