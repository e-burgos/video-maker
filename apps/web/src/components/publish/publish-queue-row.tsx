import { Link } from 'react-router-dom';

import { moveTargetIndex } from '../../api/publish-queue-view';
import type { PublishQueueItem } from '../../api/publish-queue-types';
import type { Language } from '../../i18n/language';
import { useT } from '../../i18n/language-context';
import { SECONDARY_BUTTON_SMALL_CLASS } from '../ui/cl-controls';
import { OverflowMenu } from '../ui/overflow-menu';
import { PublishQueueItemStatus } from './publish-queue-item-status';
import { PublishQueueThumbnail } from './publish-queue-thumbnail';

export type PublishQueueRowActions = {
  busy: boolean;
  onMove: (item: PublishQueueItem, direction: 'up' | 'down') => void;
  onRetry: (item: PublishQueueItem) => void;
  onRemove: (item: PublishQueueItem) => void;
};

export type PublishQueueRowProps = {
  item: PublishQueueItem;
  index: number;
  length: number;
  language: Language;
  actions: PublishQueueRowActions;
};

const ICON_BUTTON_CLASS = `${SECONDARY_BUTTON_SMALL_CLASS} !px-0 size-8`;

export function PublishQueueRow({ item, index, length, language, actions }: PublishQueueRowProps) {
  const t = useT();
  const locked = item.status === 'publishing';

  return (
    <li
      data-testid="publish-queue-row"
      className="glass-sub flex flex-wrap items-center justify-between gap-3 rounded-[14px] p-3"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="font-data w-5 shrink-0 text-right text-sm text-[var(--cl-ink-3)]">{index + 1}</span>
        <PublishQueueThumbnail item={item} />
        <div className="min-w-0 flex flex-col gap-1">
          <p className="m-0 truncate text-sm font-bold text-[var(--cl-ink)]">{item.metadata.title}</p>
          <p className="font-data m-0 truncate text-[11px] text-[var(--cl-ink-3)]">
            <Link
              to={`/projects/${encodeURIComponent(item.slug)}`}
              className="focus-cl rounded underline hover:text-[var(--cl-ink)]"
            >
              {item.slug}
            </Link>{' '}
            · {item.file}
          </p>
          <PublishQueueItemStatus item={item} language={language} />
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {item.status === 'failed' && (
          <button
            type="button"
            disabled={actions.busy}
            onClick={() => actions.onRetry(item)}
            className={SECONDARY_BUTTON_SMALL_CLASS}
          >
            {t('publishQueue.retry')}
          </button>
        )}
        <button
          type="button"
          aria-label={t('publishQueue.moveUp')}
          disabled={actions.busy || locked || moveTargetIndex(index, 'up', length) === null}
          onClick={() => actions.onMove(item, 'up')}
          className={ICON_BUTTON_CLASS}
        >
          ↑
        </button>
        <button
          type="button"
          aria-label={t('publishQueue.moveDown')}
          disabled={actions.busy || locked || moveTargetIndex(index, 'down', length) === null}
          onClick={() => actions.onMove(item, 'down')}
          className={ICON_BUTTON_CLASS}
        >
          ↓
        </button>
        {!locked && (
          <OverflowMenu
            triggerLabel={t('publishQueue.menu', { title: item.metadata.title })}
            triggerTestId="publish-queue-menu"
            menuTestId="publish-queue-menu-list"
            items={[
              {
                id: 'remove',
                label: t('publishQueue.remove'),
                testId: 'publish-queue-remove',
                tone: 'danger',
                onSelect: () => actions.onRemove(item),
              },
            ]}
          />
        )}
      </div>
    </li>
  );
}
