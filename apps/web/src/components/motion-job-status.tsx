import { StateBadge } from '@e-burgos/tucu-ui';

import type { Job } from '../api/render-api-types';
import { useT } from '../i18n/language-context';
import type { TranslationKey } from '../i18n/messages-en';
import { JobRetryButton } from './job-retry-button';

const STAGE_KEYS: Readonly<Record<string, TranslationKey>> = {
  storyboard: 'motion.job.stage.storyboard',
  plan: 'motion.job.stage.plan',
  compose: 'motion.job.stage.compose',
  render: 'motion.job.stage.render',
};

export type MotionJobStatusProps = {
  job: Job;
  onRetried: (job: Job) => void;
};

export function MotionJobStatus({ job, onRetried }: MotionJobStatusProps) {
  const t = useT();
  const progress = job.kind === 'motion' ? job.progress : null;
  const running = job.state === 'queued' || job.state === 'running';

  function stageLabel(): string {
    if (progress === null) {
      return t('motion.job.running');
    }
    if (progress.stage === 'voice') {
      return progress.totalLines === undefined
        ? t('motion.job.stage.voiceUnknown')
        : t('motion.job.stage.voice', { done: progress.linesVoiced ?? 0, total: progress.totalLines });
    }
    return t(STAGE_KEYS[progress.stage] ?? 'motion.job.running');
  }

  return (
    <div data-testid="motion-job-status" data-job-state={job.state} className="flex flex-wrap items-center gap-2">
      {running && (
        <StateBadge tone="purple" dot size="sm">
          <span data-testid="motion-job-stage" role="status">
            {stageLabel()}
          </span>
        </StateBadge>
      )}
      {job.state === 'succeeded' && (
        <StateBadge tone="green" dot size="sm">
          {t('motion.job.succeeded')}
        </StateBadge>
      )}
      {job.state === 'failed' && job.error !== null && (
        <p role="alert" className="font-data m-0 text-sm text-[var(--tucu-state-red-ink)]">
          {t('motion.job.failed', { code: job.error.code, message: job.error.message })}
        </p>
      )}
      <JobRetryButton surface="glass" job={job} onRetried={onRetried} />
    </div>
  );
}
