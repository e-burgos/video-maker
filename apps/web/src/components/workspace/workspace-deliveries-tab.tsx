import { StateBadge } from '@e-burgos/tucu-ui';

import { artifactUrl } from '../../api/artifact-url';
import { renderDeliveriesNewestFirst } from '../../api/workspace-panel';
import type { AsyncResource } from '../../hooks/use-async-resource';
import { useT } from '../../i18n/language-context';
import { ErrorNotice } from '../error-notice';
import { RenderReviewPanel } from '../render-review-panel';
import { SECONDARY_BUTTON_SMALL_CLASS } from '../ui/cl-controls';
import { YouTubePublishSection } from '../youtube-publish-section';
import type { GeneratedListing, RenderJobListing } from '../../api/render-api-types';

export type WorkspaceDeliveriesTabProps = {
  slug: string;
  jobs: AsyncResource<RenderJobListing>;
  generated: GeneratedListing | null;
};

export function WorkspaceDeliveriesTab({ slug, jobs, generated }: WorkspaceDeliveriesTabProps) {
  const t = useT();

  if (jobs.status === 'loading') {
    return <p className="text-sm text-[var(--cl-ink-2)]">{t('renderJobs.loading')}</p>;
  }

  if (jobs.status === 'error' && jobs.error !== null) {
    return <ErrorNotice surface="glass" error={jobs.error} onRetry={jobs.reload} />;
  }

  const deliveries = renderDeliveriesNewestFirst(jobs.data, generated);

  return (
    <div className="flex flex-col gap-4">
      {deliveries.length === 0 ? (
        <p data-testid="workspace-deliveries-empty" className="text-sm text-[var(--cl-ink-2)]">
          {t('workspace.deliveries.empty')}
        </p>
      ) : (
        <ul data-testid="workspace-deliveries" className="space-y-3">
          {deliveries.map((delivery) => (
            <li key={delivery.path} className="glass-sub space-y-2 rounded-[14px] p-2.5">
              <div className="aspect-video w-full overflow-hidden rounded-[10px] bg-[#0b0d14]">
                <video
                  src={artifactUrl(slug, delivery.path)}
                  controls
                  preload="metadata"
                  className="size-full bg-[#0b0d14] object-contain"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <StateBadge tone="green" dot size="sm">
                    {t('workspace.deliveries.ready')}
                  </StateBadge>
                  <span className="font-data truncate text-[11px] text-[var(--cl-ink-2)]">
                    {t('workspace.deliveries.finishedAt', { date: delivery.finishedAt })}
                  </span>
                </div>
                <a href={artifactUrl(slug, delivery.path)} className={SECONDARY_BUTTON_SMALL_CLASS}>
                  {t('renderJob.download')}
                </a>
              </div>
              {delivery.job === null && (
                <div className="rounded-[10px] bg-[var(--color-surface)] p-2 text-slate-100">
                  <RenderReviewPanel slug={slug} file={delivery.path} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <YouTubePublishSection slug={slug} />
    </div>
  );
}
