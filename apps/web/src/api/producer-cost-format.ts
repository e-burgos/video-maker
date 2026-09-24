import type { Language } from '../i18n/language';
import type { TranslateFn } from '../i18n/language-context';

const COST_LOCALE_BY_LANGUAGE: Readonly<Record<Language, string>> = {
  en: 'en-US',
  es: 'es-AR',
};

export function formatProducerCostAmount(costUsd: number, language: Language): string {
  return new Intl.NumberFormat(COST_LOCALE_BY_LANGUAGE[language], {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(costUsd);
}

export function producerCostLabel(t: TranslateFn, language: Language, costUsd: number): string {
  return t('producer.turnCost', { amount: formatProducerCostAmount(costUsd, language) });
}
