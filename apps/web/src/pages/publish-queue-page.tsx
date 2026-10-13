import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  PUBLISH_QUEUE_POLL_INTERVAL_MS,
  PUBLISH_QUEUE_STATUS_LABEL,
  PUBLISH_QUEUE_STATUS_TONE,
  formatClockTime,
  moveTargetIndex,
} from '../api/publish-queue-view';
import { useRenderApi } from '../api/render-api-context';
import { ErrorNotice } from '../components/error-notice';
import { Modal } from '../components/modal';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { useApiAction } from '../hooks/use-api-action';
import { usePolledResource } from '../hooks/use-polled-resource';
import { useLanguage, useT } from '../i18n/language-context';
import type { Language } from '../i18n/language';
import type { PublishQueue, PublishQueueItem } from '../api/publish-queue-types';

type T = ReturnType<typeof useT>;

function ItemStatus({ item, language, t }: { item: PublishQueueItem; language: Language; t: T }) {
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="publish-queue-status">
      <Badge tone={PUBLISH_QUEUE_STATUS_TONE[item.status]}>{t(PUBLISH_QUEUE_STATUS_LABEL[item.status])}</Badge>
      {item.status === 'queued' && item.nextAttemptAt !== null && (
        <span className="text-xs text-ink-faint">
          {t('publishQueue.retryAt', { time: formatClockTime(item.nextAttemptAt, language) })}
        </span>
      )}
      {item.status === 'failed' && item.lastError !== null && (
        <span className="text-xs text-danger">{item.lastError.message}</span>
      )}
      {(item.status === 'published' || item.status === 'already-published') && item.url !== null && (
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer noopener"
          className="text-xs text-accent underline hover:text-accent-strong"
        >
          {t('publishQueue.openLink')}
        </a>
      )}
    </div>
  );
}

type RowActions = {
  busy: boolean;
  onMove: (item: PublishQueueItem, direction: 'up' | 'down') => void;
  onRetry: (item: PublishQueueItem) => void;
  onRemove: (item: PublishQueueItem) => void;
};

function QueueRow({
  item,
  index,
  length,
  language,
  actions,
  t,
}: {
  item: PublishQueueItem;
  index: number;
  length: number;
  language: Language;
  actions: RowActions;
  t: T;
}) {
  const locked = item.status === 'publishing';

  return (
    <li
      data-testid="publish-queue-row"
      className="flex flex-wrap items-center justify-between gap-3 rounded-panel border border-border-subtle bg-surface-raised/40 p-3"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="w-6 pt-0.5 text-right text-sm tabular-nums text-ink-faint">{index + 1}</span>
        <div className="min-w-0 space-y-1">
          <p className="truncate text-sm text-ink">{item.metadata.title}</p>
          <p className="truncate text-xs text-ink-faint">
            <Link to={`/projects/${encodeURIComponent(item.slug)}`} className="underline hover:text-ink">
              {item.slug}
            </Link>{' '}
            · {item.file}
          </p>
          <ItemStatus item={item} language={language} t={t} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          aria-label={t('publishQueue.moveUp')}
          disabled={actions.busy || locked || moveTargetIndex(index, 'up', length) === null}
          onClick={() => actions.onMove(item, 'up')}
        >
          ↑
        </Button>
        <Button
          aria-label={t('publishQueue.moveDown')}
          disabled={actions.busy || locked || moveTargetIndex(index, 'down', length) === null}
          onClick={() => actions.onMove(item, 'down')}
        >
          ↓
        </Button>
        {item.status === 'failed' && (
          <Button disabled={actions.busy} onClick={() => actions.onRetry(item)}>
            {t('publishQueue.retry')}
          </Button>
        )}
        <Button disabled={actions.busy || locked} onClick={() => actions.onRemove(item)}>
          {t('publishQueue.remove')}
        </Button>
      </div>
    </li>
  );
}

function QueueHeader({
  queue,
  language,
  busy,
  onTogglePause,
  onSaveLimit,
  t,
}: {
  queue: PublishQueue;
  language: Language;
  busy: boolean;
  onTogglePause: () => void;
  onSaveLimit: (limit: number) => void;
  t: T;
}) {
  const [limitDraft, setLimitDraft] = useState(String(queue.settings.dailyLimit));

  useEffect(() => {
    setLimitDraft(String(queue.settings.dailyLimit));
  }, [queue.settings.dailyLimit]);

  const parsedLimit = Number(limitDraft);
  const limitValid = Number.isInteger(parsedLimit) && parsedLimit >= 1 && parsedLimit <= 100;
  const limitChanged = parsedLimit !== queue.settings.dailyLimit;

  return (
    <div
      data-testid="publish-queue-header"
      className="space-y-3 rounded-panel border border-border-subtle bg-surface-raised/40 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge tone={queue.settings.paused ? 'warning' : 'success'} data-testid="publish-queue-state">
            {queue.settings.paused ? t('publishQueue.state.paused') : t('publishQueue.state.active')}
          </Badge>
          <span className="text-sm text-ink-muted">
            {t('publishQueue.last24h', { count: queue.publishedLast24h, limit: queue.settings.dailyLimit })}
          </span>
        </div>
        <Button variant="primary" disabled={busy} onClick={onTogglePause}>
          {queue.settings.paused ? t('publishQueue.resume') : t('publishQueue.pause')}
        </Button>
      </div>
      {queue.nextAttemptAt !== null && (
        <p data-testid="publish-queue-next-attempt" className="text-xs text-ink-faint">
          {t('publishQueue.nextAttempt', { time: formatClockTime(queue.nextAttemptAt, language) })}
        </p>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label htmlFor="publish-queue-limit" className="block text-xs text-ink-muted">
            {t('publishQueue.dailyLimit')}
          </label>
          <input
            id="publish-queue-limit"
            type="number"
            min={1}
            max={100}
            value={limitDraft}
            onChange={(event) => setLimitDraft(event.target.value)}
            className="w-24 rounded-control border border-border-strong bg-surface px-2 py-1 text-sm text-ink"
          />
        </div>
        <Button disabled={busy || !limitValid || !limitChanged} onClick={() => onSaveLimit(parsedLimit)}>
          {t('publishQueue.saveLimit')}
        </Button>
      </div>
    </div>
  );
}

export function PublishQueuePage() {
  const client = useRenderApi();
  const t = useT();
  const { language } = useLanguage();
  const load = useCallback(() => client.getPublishQueue(), [client]);
  const queue = usePolledResource<PublishQueue>(load, 'publish-queue', PUBLISH_QUEUE_POLL_INTERVAL_MS);
  const [removing, setRemoving] = useState<PublishQueueItem | null>(null);

  const updateSettings = useApiAction((patch: { paused?: boolean; dailyLimit?: number }) =>
    client.updatePublishQueueSettings(patch),
  );
  const updateItem = useApiAction((id: string, patch: { position?: number; status?: 'queued' }) =>
    client.updatePublishQueueItem(id, patch),
  );
  const removeItem = useApiAction((id: string) => client.removePublishQueueItem(id));

  const busy =
    updateSettings.status === 'pending' || updateItem.status === 'pending' || removeItem.status === 'pending';
  const items = queue.data?.items ?? [];

  async function changeSettings(patch: { paused?: boolean; dailyLimit?: number }) {
    if ((await updateSettings.run(patch)) !== null) {
      queue.reload();
    }
  }

  async function move(item: PublishQueueItem, direction: 'up' | 'down') {
    const target = moveTargetIndex(items.indexOf(item), direction, items.length);
    if (target !== null && (await updateItem.run(item.id, { position: target })) !== null) {
      queue.reload();
    }
  }

  async function retry(item: PublishQueueItem) {
    if ((await updateItem.run(item.id, { status: 'queued' })) !== null) {
      queue.reload();
    }
  }

  async function confirmRemove() {
    if (removing === null) {
      return;
    }
    const result = await removeItem.run(removing.id);
    setRemoving(null);
    if (result !== null) {
      queue.reload();
    }
  }

  const actions: RowActions = { busy, onMove: move, onRetry: retry, onRemove: setRemoving };
  const actionError = updateSettings.error ?? updateItem.error ?? removeItem.error;

  return (
    <section data-testid="publish-queue-page" className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-ink">{t('publishQueue.heading')}</h1>
        <p className="text-sm text-ink-muted">{t('publishQueue.description')}</p>
      </div>

      {queue.status === 'loading' && <p className="text-sm text-ink-faint">{t('publishQueue.loading')}</p>}

      {queue.status === 'error' && queue.error !== null && (
        <ErrorNotice error={queue.error} onRetry={queue.reload} />
      )}

      {actionError !== null && <ErrorNotice error={actionError} />}

      {queue.data !== null && (
        <>
          <QueueHeader
            queue={queue.data}
            language={language}
            busy={busy}
            t={t}
            onTogglePause={() => void changeSettings({ paused: !queue.data?.settings.paused })}
            onSaveLimit={(dailyLimit) => void changeSettings({ dailyLimit })}
          />

          {items.length === 0 ? (
            <p data-testid="publish-queue-empty" className="text-sm text-ink-faint">
              {t('publishQueue.empty')}
            </p>
          ) : (
            <ol className="space-y-2">
              {items.map((item, index) => (
                <QueueRow
                  key={item.id}
                  item={item}
                  index={index}
                  length={items.length}
                  language={language}
                  actions={actions}
                  t={t}
                />
              ))}
            </ol>
          )}
        </>
      )}

      {removing !== null && (
        <Modal
          title={t('publishQueue.removeTitle')}
          testId="publish-queue-remove-modal"
          onClose={() => setRemoving(null)}
          footer={
            <>
              <Button disabled={removeItem.status === 'pending'} onClick={() => setRemoving(null)}>
                {t('publishQueue.cancel')}
              </Button>
              <Button
                variant="primary"
                data-testid="publish-queue-remove-accept"
                disabled={removeItem.status === 'pending'}
                onClick={() => void confirmRemove()}
              >
                {t('publishQueue.removeConfirm')}
              </Button>
            </>
          }
        >
          <p>{t('publishQueue.removeBody', { title: removing.metadata.title })}</p>
        </Modal>
      )}
    </section>
  );
}
