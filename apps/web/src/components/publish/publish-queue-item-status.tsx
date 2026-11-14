import { StateBadge } from '@e-burgos/tucu-ui';

import {
  PUBLISH_QUEUE_STATUS_LABEL,
  PUBLISH_QUEUE_STATUS_TONE,
  formatClockTime,
} from '../../api/publish-queue-view';
import type { Language } from '../../i18n/language';
import { useT } from '../../i18n/language-context';
import type { PublishQueueItem } from '../../api/publish-queue-types';

export function PublishQueueItemStatus({ item, language }: { item: PublishQueueItem; language: Language }) {
  const t = useT();

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="publish-queue-status">
      <StateBadge tone={PUBLISH_QUEUE_STATUS_TONE[item.status]} dot size="sm">
        {t(PUBLISH_QUEUE_STATUS_LABEL[item.status])}
      </StateBadge>
      {item.status === 'queued' && item.nextAttemptAt !== null && (
        <span className="font-data text-[11px] text-[var(--cl-ink-3)]">
          {t('publishQueue.retryAt', { time: formatClockTime(item.nextAttemptAt, language) })}
        </span>
      )}
      {item.status === 'failed' && item.lastError !== null && (
        <span className="text-xs text-[var(--tucu-state-red-ink)]">{item.lastError.message}</span>
      )}
      {(item.status === 'published' || item.status === 'already-published') && item.url !== null && (
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer noopener"
          className="focus-cl rounded text-xs text-[var(--cl-action-text)] underline hover:text-[var(--cl-action-hover)]"
        >
          {t('publishQueue.openLink')}
        </a>
      )}
    </div>
  );
}
