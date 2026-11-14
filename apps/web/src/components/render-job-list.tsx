import { StateBadge } from '@e-burgos/tucu-ui';

import { INTERRUPTED_JOB_CODE, renderJobTone } from '../api/render-job-tone';
import { renderJobDeliverableUrl, renderJobSampleUrl } from '../api/render-job-artifact';
import { useRenderApi } from '../api/render-api-context';
import { useAsyncResource } from '../hooks/use-async-resource';
import { useT } from '../i18n/language-context';
import type { TranslateFn } from '../i18n/language-context';
import type { RenderJobSummary } from '../api/render-api-types';
import { ErrorNotice } from './error-notice';
import { SECONDARY_BUTTON_SMALL_CLASS } from './ui/cl-controls';
import { EmptyState, LoadingState } from './ui/status-states';

export type RenderJobListProps = {
  slug: string;
  onSelect: (jobId: string) => void;
};

function errorLabel(job: RenderJobSummary, t: TranslateFn): string | null {
  if (job.errorCode === null) {
    return null;
  }
  return job.errorCode === INTERRUPTED_JOB_CODE ? t('job.interrupted') : job.errorCode;
}

function downloadUrl(slug: string, job: RenderJobSummary): string {
  return job.sample ? renderJobSampleUrl(slug, job.id) : renderJobDeliverableUrl(slug, job.id);
}

function TimestampField({ label, value }: { label: string; value: string | null }) {
  return (
    <span className="flex items-baseline gap-1">
      <span className="text-[var(--cl-ink-3)]">{label}</span>
      <span>{value ?? '—'}</span>
    </span>
  );
}

function RenderJobRow({ slug, job, onSelect }: { slug: string; job: RenderJobSummary; onSelect: (jobId: string) => void }) {
  const t = useT();
  const error = errorLabel(job, t);

  return (
    <li data-testid="render-job-row" data-job-state={job.state} className="glass-sub flex flex-col gap-2 rounded-[12px] p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onSelect(job.id)}
          className="focus-cl font-data truncate rounded-md text-xs font-semibold text-[var(--cl-action-text)] underline"
        >
          {job.id}
        </button>
        <StateBadge tone={renderJobTone(job.state, job.errorCode)} dot size="sm">
          {job.state}
        </StateBadge>
        <span className="font-data text-xs text-[var(--cl-ink-2)]">{job.stage ?? '—'}</span>
        {error !== null && <span className="font-data text-xs text-[var(--tucu-state-red-ink)]">{error}</span>}
        {job.kind === 'render' && job.state === 'succeeded' && (
          <a
            href={downloadUrl(slug, job)}
            data-testid="render-job-download"
            className={`${SECONDARY_BUTTON_SMALL_CLASS} ml-auto no-underline`}
          >
            {t('renderJob.download')}
          </a>
        )}
      </div>
      <div className="font-data flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-[var(--cl-ink-2)]">
        <TimestampField label={t('renderJobs.created')} value={job.createdAt} />
        <TimestampField label={t('renderJobs.started')} value={job.startedAt} />
        <TimestampField label={t('renderJobs.finished')} value={job.finishedAt} />
      </div>
    </li>
  );
}

export function RenderJobList({ slug, onSelect }: RenderJobListProps) {
  const client = useRenderApi();
  const listing = useAsyncResource(() => client.listRenderJobs(slug), `jobs:${slug}`);
  const t = useT();

  if (listing.status === 'loading') {
    return <LoadingState message={t('renderJobs.loading')} />;
  }

  if (listing.status === 'error' && listing.error !== null) {
    return <ErrorNotice error={listing.error} onRetry={listing.reload} />;
  }

  const jobs = listing.data?.jobs ?? [];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={listing.reload}
          disabled={listing.isRefreshing}
          className={SECONDARY_BUTTON_SMALL_CLASS}
        >
          {listing.isRefreshing ? t('renderJobs.refreshing') : t('renderJobs.refresh')}
        </button>
      </div>

      {jobs.length === 0 ? (
        <EmptyState message={t('renderJobs.empty')} />
      ) : (
        <ul data-testid="render-job-list" className="m-0 flex list-none flex-col gap-2 p-0">
          {jobs.map((job) => (
            <RenderJobRow key={job.id} slug={slug} job={job} onSelect={onSelect} />
          ))}
        </ul>
      )}
    </div>
  );
}
