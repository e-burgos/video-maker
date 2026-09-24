import { describe, expect, it } from 'vitest';

import { translate } from '../i18n/translate';
import type { TranslationParams } from '../i18n/translate';
import { MESSAGES_EN } from '../i18n/messages-en';
import type { TranslationKey } from '../i18n/messages-en';
import {
  producerEngineActiveLabel,
  producerEngineLabel,
  producerEngineLabelKey,
} from './producer-engine-i18n';

const t = (key: TranslationKey, params?: TranslationParams) => translate(MESSAGES_EN, key, params);

describe('producerEngineLabelKey', () => {
  it('maps each engine id to its settings label key', () => {
    expect(producerEngineLabelKey('claude-cli')).toBe('settings.engine.claudeCli');
    expect(producerEngineLabelKey('openrouter')).toBe('settings.engine.openrouter');
  });
});

describe('producerEngineLabel', () => {
  it('translates the engine id with the function it is given', () => {
    expect(producerEngineLabel(t, 'claude-cli')).toBe('Claude');
    expect(producerEngineLabel(t, 'openrouter')).toBe('OpenRouter');
  });
});

describe('producerEngineActiveLabel', () => {
  it('phrases which engine answers the conversation', () => {
    expect(producerEngineActiveLabel(t, 'claude-cli')).toBe('with Claude');
    expect(producerEngineActiveLabel(t, 'openrouter')).toBe('with OpenRouter');
  });
});
