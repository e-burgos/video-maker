import { describe, expect, it } from 'vitest';

import { MESSAGES_ES } from '../i18n/messages-es';
import { translate } from '../i18n/translate';
import { translateProducerModel } from './producer-model-i18n';

describe('translateProducerModel', () => {
  it('translates label and description for a known model id', () => {
    const t = (key: Parameters<typeof translate>[1]) => translate(MESSAGES_ES, key);

    expect(translateProducerModel(t, { id: 'sonnet', label: 'Sonnet', description: 'Balanced · faster, cheaper' })).toEqual({
      id: 'sonnet',
      label: 'Sonnet',
      description: 'Equilibrado, rápido y económico',
    });
  });

  it('falls back to the service text for an id the studio does not know', () => {
    const t = (key: Parameters<typeof translate>[1]) => translate(MESSAGES_ES, key);
    const unknown = { id: 'gpt-5-mini', label: 'GPT-5 mini', description: 'Model alias configured for this server' };

    expect(translateProducerModel(t, unknown)).toBe(unknown);
  });
});
