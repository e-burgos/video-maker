import { useRenderApi } from '../api/render-api-context';
import { useApiAction } from '../hooks/use-api-action';
import { useT } from '../i18n/language-context';
import { ErrorNotice } from './error-notice';
import { SECONDARY_BUTTON_SMALL_CLASS } from './ui/cl-controls';
import type { Job } from '../api/render-api-types';

const RETRYABLE_JOB_STATES = ['failed', 'canceled'] as const;

export type JobRetryButtonProps = {
  job: Job;
  onRetried: (job: Job) => void;
  surface?: 'legacy' | 'glass';
};

export function JobRetryButton({
  job,
  onRetried,
  surface = 'legacy',
}: JobRetryButtonProps) {
  const client = useRenderApi();
  const retryAction = useApiAction((jobId: string) => client.retryJob(jobId));
  const t = useT();

  if (!(RETRYABLE_JOB_STATES as readonly string[]).includes(job.state)) {
    return null;
  }

  async function retry() {
    const retried = await retryAction.run(job.id);
    if (retried !== null) {
      onRetried(retried);
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => void retry()}
        disabled={retryAction.status === 'pending'}
        aria-label={t('job.retry')}
        className={
          surface === 'glass'
            ? SECONDARY_BUTTON_SMALL_CLASS
            : 'rounded-md border border-sky-500/50 bg-sky-500/10 px-3 py-1 text-xs text-sky-100 disabled:opacity-40'
        }
      >
        {retryAction.status === 'pending'
          ? t('job.retry.pending')
          : t('job.retry')}
      </button>

      {retryAction.error !== null && (
        <ErrorNotice surface={surface} error={retryAction.error} />
      )}
    </div>
  );
}
