import type { TranslateFn } from '../i18n/language-context';
import type { TranslationKey } from '../i18n/messages-en';
import type { ProducerModelOption } from './render-api-types';

const KNOWN_MODEL_IDS = ['sonnet', 'opus', 'haiku'] as const;

type KnownModelId = (typeof KNOWN_MODEL_IDS)[number];

function isKnownModelId(id: string): id is KnownModelId {
  return (KNOWN_MODEL_IDS as readonly string[]).includes(id);
}

export function translateProducerModel(t: TranslateFn, option: ProducerModelOption): ProducerModelOption {
  if (!isKnownModelId(option.id)) {
    return option;
  }
  return {
    id: option.id,
    label: t(`producer.model.${option.id}.label` as TranslationKey),
    description: t(`producer.model.${option.id}.description` as TranslationKey),
  };
}
