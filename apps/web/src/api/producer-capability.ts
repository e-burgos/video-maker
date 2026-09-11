import type { ServiceHealth } from './render-api-types';
import type { Blocker } from './blockers';
import type { TranslationKey } from '../i18n/messages-en';

export function producerBlockers(health: ServiceHealth | null): Blocker[] {
  if (health === null) {
    return [{ key: 'producer.blocker.healthUnknown' }];
  }

  if (!health.capabilities.producer) {
    return [{ key: 'producer.blocker.unavailable' }];
  }

  return [];
}

export function canTalkToProducer(health: ServiceHealth | null): boolean {
  return producerBlockers(health).length === 0;
}

const PRODUCER_FAILURE_CODES = [
  'PRODUCER_UNAVAILABLE',
  'PRODUCER_RATE_LIMITED',
  'PRODUCER_TURN_FAILED',
  'PRODUCER_TURN_ACTIVE',
  'PRODUCER_TURN_NOT_FOUND',
  'PRODUCER_TURN_NOT_CANCELABLE',
  'PRODUCER_MESSAGE_INVALID',
  'PRODUCER_STATE_INVALID',
] as const;

type ProducerFailureCode = (typeof PRODUCER_FAILURE_CODES)[number];

function isProducerFailureCode(code: string): code is ProducerFailureCode {
  return (PRODUCER_FAILURE_CODES as readonly string[]).includes(code);
}

export function producerFailureKey(code: string): TranslationKey | null {
  return isProducerFailureCode(code) ? (`producerFailure.${code}` as TranslationKey) : null;
}
