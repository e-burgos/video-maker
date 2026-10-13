import type { Language } from '../i18n/language';
import type { TranslationKey } from '../i18n/messages-en';
import type { BadgeTone } from '../components/ui/badge';
import type { PublishQueueStatus } from './publish-queue-types';

export const PUBLISH_QUEUE_POLL_INTERVAL_MS = 10_000;

export const PUBLISH_QUEUE_STATUS_LABEL: Readonly<Record<PublishQueueStatus, TranslationKey>> = {
  queued: 'publishQueue.status.queued',
  publishing: 'publishQueue.status.publishing',
  published: 'publishQueue.status.published',
  'already-published': 'publishQueue.status.alreadyPublished',
  failed: 'publishQueue.status.failed',
};

export const PUBLISH_QUEUE_STATUS_TONE: Readonly<Record<PublishQueueStatus, BadgeTone>> = {
  queued: 'neutral',
  publishing: 'warning',
  published: 'success',
  'already-published': 'accent',
  failed: 'danger',
};

const LOCALE_BY_LANGUAGE: Readonly<Record<Language, string>> = { en: 'en-US', es: 'es-AR' };

export function formatClockTime(iso: string, language: Language): string {
  return new Intl.DateTimeFormat(LOCALE_BY_LANGUAGE[language], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

export function moveTargetIndex(index: number, direction: 'up' | 'down', length: number): number | null {
  const target = direction === 'up' ? index - 1 : index + 1;
  return target < 0 || target >= length ? null : target;
}
