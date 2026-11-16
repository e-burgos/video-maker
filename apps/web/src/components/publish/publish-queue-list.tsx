import { SegmentedControl } from '@e-burgos/tucu-ui';

import { PUBLISH_QUEUE_FILTERS, filterQueueItems, formatClockTime } from '../../api/publish-queue-view';
import type { PublishQueueFilter } from '../../api/publish-queue-view';
import type { PublishQueue, PublishQueueItem } from '../../api/publish-queue-types';
import type { Language } from '../../i18n/language';
import { useT } from '../../i18n/language-context';
import type { TranslationKey } from '../../i18n/messages-en';
import { PANEL_CLASS } from '../ui/cl-controls';
import { PublishQueueLimitForm } from './publish-queue-limit-form';
import { PublishQueueRow } from './publish-queue-row';
import type { PublishQueueRowActions } from './publish-queue-row';

const FILTER_LABEL: Readonly<Record<PublishQueueFilter, TranslationKey>> = {
  queue: 'publishQueue.filter.queue',
  published: 'publishQueue.filter.published',
  failed: 'publishQueue.filter.failed',
};

export type PublishQueueListProps = {
  queue: PublishQueue;
  filter: PublishQueueFilter;
  language: Language;
  actions: PublishQueueRowActions;
  onFilterChange: (filter: PublishQueueFilter) => void;
  onSaveLimit: (limit: number) => void;
};

export function PublishQueueList({ queue, filter, language, actions, onFilterChange, onSaveLimit }: PublishQueueListProps) {
  const t = useT();
  const visible: PublishQueueItem[] = filterQueueItems(queue.items, filter);
  const options = PUBLISH_QUEUE_FILTERS.map((value) => ({
    value,
    label: t(FILTER_LABEL[value]),
    'data-testid': `publish-queue-filter-${value}`,
  }));

  return (
    <section className={`${PANEL_CLASS} gap-4 shadow-[var(--tucu-shadow-panel)]`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="glass-thin max-w-full overflow-x-auto rounded-[10px] p-[3px]">
          <SegmentedControl
            size="xs"
            aria-label={t('publishQueue.filter.label')}
            options={options}
            value={filter}
            onChange={(next) => onFilterChange(next as PublishQueueFilter)}
          />
        </div>
        {queue.nextAttemptAt !== null && (
          <p data-testid="publish-queue-next-attempt" className="font-data m-0 text-xs text-[var(--cl-ink-2)]">
            {t('publishQueue.nextAttempt', { time: formatClockTime(queue.nextAttemptAt, language) })}
          </p>
        )}
      </div>

      {queue.items.length === 0 && (
        <p data-testid="publish-queue-empty" className="m-0 text-sm text-[var(--cl-ink-2)]">
          {t('publishQueue.empty')}
        </p>
      )}
      {queue.items.length > 0 && visible.length === 0 && (
        <p data-testid="publish-queue-empty-filter" className="m-0 text-sm text-[var(--cl-ink-2)]">
          {t('publishQueue.emptyFilter')}
        </p>
      )}

      {visible.length > 0 && (
        <ol className="m-0 flex list-none flex-col gap-2 p-0">
          {visible.map((item, index) => (
            <PublishQueueRow
              key={item.id}
              item={item}
              index={index}
              length={visible.length}
              language={language}
              actions={actions}
            />
          ))}
        </ol>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--tucu-glass-sub-line)] pt-3">
        <p className="m-0 text-xs text-[var(--cl-ink-3)]">{t('publishQueue.hint')}</p>
        <PublishQueueLimitForm dailyLimit={queue.settings.dailyLimit} busy={actions.busy} onSave={onSaveLimit} />
      </div>
    </section>
  );
}
