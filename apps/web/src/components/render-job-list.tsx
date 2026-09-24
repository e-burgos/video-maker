import { useRenderApi } from '../api/render-api-context';
import { useAsyncResource } from '../hooks/use-async-resource';
import { useT } from '../i18n/language-context';
import { ErrorNotice } from './error-notice';

export type RenderJobListProps = {
  slug: string;
  onSelect: (jobId: string) => void;
};

export function RenderJobList({ slug, onSelect }: RenderJobListProps) {
  const client = useRenderApi();
  const listing = useAsyncResource(() => client.listRenderJobs(slug), `jobs:${slug}`);
  const t = useT();

  if (listing.status === 'loading') {
    return <p className="text-sm text-slate-400">{t('renderJobs.loading')}</p>;
  }

  if (listing.status === 'error' && listing.error !== null) {
    return <ErrorNotice error={listing.error} onRetry={listing.reload} />;
  }

  const jobs = listing.data?.jobs ?? [];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={listing.reload}
          disabled={listing.isRefreshing}
          className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 disabled:opacity-40"
        >
          {listing.isRefreshing ? t('renderJobs.refreshing') : t('renderJobs.refresh')}
        </button>
      </div>

      {jobs.length === 0 ? (
        <p className="text-sm text-slate-400">{t('renderJobs.empty')}</p>
      ) : (
        <table className="w-full text-left text-sm text-slate-300">
          <thead>
            <tr className="text-xs uppercase text-slate-500">
              <th>{t('renderJobs.id')}</th>
              <th>{t('renderJobs.state')}</th>
              <th>{t('renderJobs.stage')}</th>
              <th>{t('renderJobs.error')}</th>
              <th>{t('renderJobs.created')}</th>
              <th>{t('renderJobs.started')}</th>
              <th>{t('renderJobs.finished')}</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id}>
                <td>
                  <button
                    type="button"
                    onClick={() => onSelect(job.id)}
                    className="font-mono text-xs text-sky-300 underline"
                  >
                    {job.id}
                  </button>
                </td>
                <td>{job.state}</td>
                <td>{job.stage ?? '—'}</td>
                <td>
                  {job.errorCode === null
                    ? '—'
                    : job.errorCode === 'JOB_INTERRUPTED'
                      ? t('job.interrupted')
                      : job.errorCode}
                </td>
                <td>{job.createdAt}</td>
                <td>{job.startedAt ?? '—'}</td>
                <td>{job.finishedAt ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
