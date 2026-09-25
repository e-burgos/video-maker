import { describe, expect, it } from 'vitest';

import { translate } from '../i18n/translate';
import type { TranslationParams } from '../i18n/translate';
import { MESSAGES_EN } from '../i18n/messages-en';
import type { TranslationKey } from '../i18n/messages-en';
import { MESSAGES_ES } from '../i18n/messages-es';
import { translateVoiceDescription, voiceQualityKey } from './voice-i18n';
import type { VoiceModel } from './render-api-types';

function tEn(key: TranslationKey, params?: TranslationParams): string {
  return translate(MESSAGES_EN, key, params);
}

function tEs(key: TranslationKey, params?: TranslationParams): string {
  return translate(MESSAGES_ES, key, params);
}

const DANIELA: VoiceModel = {
  id: 'es_AR-daniela-high',
  directory: 'es_AR',
  fileName: 'es_AR-daniela-high.onnx',
  isDefault: true,
  language: { code: 'es-AR', region: 'AR' },
  quality: 'high',
  label: 'Daniela · Spanish (Argentina) · High quality',
  description: 'Neural voice trained on the "daniela" dataset. Spanish as spoken in Argentina.',
  previewUrl: '/voices/es_AR-daniela-high/preview',
};

describe('voiceQualityKey', () => {
  it('maps every known quality to a translation key', () => {
    expect(voiceQualityKey('high')).toBe('voiceQuality.high');
    expect(voiceQualityKey('medium')).toBe('voiceQuality.medium');
  });

  it('is null for an unknown quality, instead of inventing one', () => {
    expect(voiceQualityKey(null)).toBeNull();
  });
});

describe('translateVoiceDescription', () => {
  it('leaves the english description untouched in an english UI', () => {
    expect(translateVoiceDescription(DANIELA, 'en', tEn)).toBe(DANIELA.description);
  });

  it('reconstructs a spanish sentence from the structured language and quality fields', () => {
    const result = translateVoiceDescription(DANIELA, 'es', tEs);

    expect(result).toContain('Voz neuronal');
    expect(result).not.toContain('trained on the "daniela" dataset');
  });

  it('falls back to the raw description when the language code cannot be resolved', () => {
    const unresolvable: VoiceModel = { ...DANIELA, language: { code: 'zz-not-a-real-code', region: null } };

    expect(translateVoiceDescription(unresolvable, 'es', tEs)).toBe(unresolvable.description);
  });

  it('names the quality as unspecified rather than omitting it when the model has none', () => {
    const noQuality: VoiceModel = { ...DANIELA, quality: null };

    expect(translateVoiceDescription(noQuality, 'es', tEs)).toContain('calidad no especificada');
  });
});
