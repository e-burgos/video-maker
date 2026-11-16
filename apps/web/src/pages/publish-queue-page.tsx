import { useCallback, useState } from 'react';

import { PUBLISH_QUEUE_POLL_INTERVAL_MS, filterQueueItems } from '../api/publish-queue-view';
import type { PublishQueueFilter } from '../api/publish-queue-view';
import { useRenderApi } from '../api/render-api-context';
import { ErrorNotice } from '../components/error-notice';
import { PublishQueueList } from '../components/publish/publish-queue-list';
import { PublishQueueRemoveModal } from '../components/publish/publish-queue-remove-modal';
import type { PublishQueueRowActions } from '../components/publish/publish-queue-row';
import { PublishQueueStats } from '../components/publish/publish-queue-stats';
import { PublishQueueToolbar } from '../components/publish/publish-queue-toolbar';
import { useApiAction } from '../hooks/use-api-action';
import { usePolledResource } from '../hooks/use-polled-resource';
import { useLanguage, useT } from '../i18n/language-context';
import type { PublishQueue, PublishQueueItem } from '../api/publish-queue-types';
import { LoadingState } from '../components/ui/status-states';

export function PublishQueuePage() {
  const client = useRenderApi();
  const t = useT();
  const { language } = useLanguage();
  const load = useCallback(() => client.getPublishQueue(), [client]);
  const queue = usePolledResource<PublishQueue>(load, 'publish-queue', PUBLISH_QUEUE_POLL_INTERVAL_MS);
  const [removing, setRemoving] = useState<PublishQueueItem | null>(null);
  const [filter, setFilter] = useState<PublishQueueFilter>('queue');

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
    const visible = filterQueueItems(items, filter);
    const neighbour = visible[visible.indexOf(item) + (direction === 'up' ? -1 : 1)];
    const target = neighbour === undefined ? null : items.indexOf(neighbour);
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

  const actions: PublishQueueRowActions = { busy, onMove: move, onRetry: retry, onRemove: setRemoving };
  const actionError = updateSettings.error ?? updateItem.error ?? removeItem.error;

  return (
    <section data-testid="publish-queue-page" className="flex flex-col gap-3">
      {queue.status === 'loading' && queue.data === null && (
        <LoadingState message={t('publishQueue.loading')} />
      )}

      {queue.status === 'error' && queue.error !== null && (
        <ErrorNotice error={queue.error} onRetry={queue.reload} />
      )}

      {actionError !== null && <ErrorNotice error={actionError} />}

      {queue.data !== null && (
        <>
          <PublishQueueToolbar
            paused={queue.data.settings.paused}
            busy={busy}
            onTogglePause={() => void changeSettings({ paused: !queue.data?.settings.paused })}
          />
          <PublishQueueStats queue={queue.data} />
          <PublishQueueList
            queue={queue.data}
            filter={filter}
            language={language}
            actions={actions}
            onFilterChange={setFilter}
            onSaveLimit={(dailyLimit) => void changeSettings({ dailyLimit })}
          />
        </>
      )}

      {removing !== null && (
        <PublishQueueRemoveModal
          item={removing}
          pending={removeItem.status === 'pending'}
          onCancel={() => setRemoving(null)}
          onConfirm={() => void confirmRemove()}
        />
      )}
    </section>
  );
}
