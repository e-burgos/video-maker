import { describe, expect, it } from 'vitest';

import { formatProducerCostAmount, producerCostLabel } from './producer-cost-format';
import { translate } from '../i18n/translate';
import { MESSAGES_EN } from '../i18n/messages-en';
import { MESSAGES_ES } from '../i18n/messages-es';

describe('formatProducerCostAmount', () => {
  it('uses a period as the decimal separator in English', () => {
    expect(formatProducerCostAmount(0.0123, 'en')).toBe('0.012');
  });

  it('uses a comma as the decimal separator in Spanish', () => {
    expect(formatProducerCostAmount(0.0123, 'es')).toBe('0,012');
  });

  it('always renders exactly three decimal digits', () => {
    expect(formatProducerCostAmount(0.1, 'en')).toBe('0.100');
    expect(formatProducerCostAmount(0.1, 'es')).toBe('0,100');
  });
});

describe('producerCostLabel', () => {
  const tEn = (key: Parameters<typeof translate>[1], params?: Parameters<typeof translate>[2]) =>
    translate(MESSAGES_EN, key, params);
  const tEs = (key: Parameters<typeof translate>[1], params?: Parameters<typeof translate>[2]) =>
    translate(MESSAGES_ES, key, params);

  it('formats the English cost label with a period', () => {
    expect(producerCostLabel(tEn, 'en', 0.012)).toBe('≈ US$ 0.012');
  });

  it('formats the Spanish cost label with a comma', () => {
    expect(producerCostLabel(tEs, 'es', 0.012)).toBe('≈ US$ 0,012');
  });
});
