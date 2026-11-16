import type { PublishQueue } from '../../api/publish-queue-types';
import { useT } from '../../i18n/language-context';
import { PANEL_CLASS } from '../ui/cl-controls';

function StatTile({ value, label, testId }: { value: string; label: string; testId: string }) {
  return (
    <div data-testid={testId} className={`${PANEL_CLASS} gap-1 shadow-[var(--tucu-shadow-panel)]`}>
      <p className="font-data m-0 text-2xl font-bold text-[var(--cl-ink)]">{value}</p>
      <p className="m-0 text-xs text-[var(--cl-ink-2)]">{label}</p>
    </div>
  );
}

export function PublishQueueStats({ queue }: { queue: PublishQueue }) {
  const t = useT();
  const pending = queue.items.filter((item) => item.status === 'queued' || item.status === 'publishing').length;
  const failed = queue.items.filter((item) => item.status === 'failed').length;

  return (
    <div data-testid="publish-queue-header" className="grid gap-3 sm:grid-cols-3">
      <StatTile
        testId="publish-queue-stat-last24h"
        value={`${queue.publishedLast24h} / ${queue.settings.dailyLimit}`}
        label={t('publishQueue.stats.last24h')}
      />
      <StatTile testId="publish-queue-stat-queued" value={String(pending)} label={t('publishQueue.stats.queued')} />
      <StatTile testId="publish-queue-stat-failed" value={String(failed)} label={t('publishQueue.stats.failed')} />
    </div>
  );
}
