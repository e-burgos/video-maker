import { useCallback, useEffect, useRef, useState } from 'react';

import { REFERENCE_STAGE_KEY, referenceNameFor } from '../api/reference-format';
import { RenderApiError } from '../api/render-api-error';
import { useRenderApi } from '../api/render-api-context';
import { useApiAction } from '../hooks/use-api-action';
import { useAsyncResource } from '../hooks/use-async-resource';
import { useRenderJobPoll } from '../hooks/use-render-job-poll';
import { useT } from '../i18n/language-context';
import { ErrorNotice } from './error-notice';
import { SECONDARY_BUTTON_SMALL_CLASS } from './ui/cl-controls';
import { ReferenceBriefView } from './reference-brief-view';
import type { ReferenceBrief } from '../api/reference-types';

export type ReferenceAnalysisProps = {
  slug: string;
  assetPath: string;
};

export function ReferenceAnalysis({ slug, assetPath }: ReferenceAnalysisProps) {
  const client = useRenderApi();
  const t = useT();
  const name = referenceNameFor(assetPath);
  const loadBrief = useCallback(async (): Promise<ReferenceBrief | null> => {
    try {
      return await client.getReference(slug, name);
    } catch (cause) {
      if (
        cause instanceof RenderApiError &&
        cause.code === 'REFERENCE_NOT_FOUND'
      ) {
        return null;
      }
      throw cause;
    }
  }, [client, slug, name]);
  const brief = useAsyncResource<ReferenceBrief | null>(
    loadBrief,
    `reference:${slug}:${name}`,
  );
  const start = useApiAction(() => client.createReferenceJob(slug, assetPath));
  const [jobId, setJobId] = useState<string | null>(null);
  const poll = useRenderJobPoll(jobId, (id) => client.getRenderJob(id));
  const reloadedForRef = useRef<string | null>(null);

  const reloadBrief = brief.reload;
  useEffect(() => {
    if (
      poll.job !== null &&
      poll.stopReason === 'terminal' &&
      reloadedForRef.current !== poll.job.id
    ) {
      reloadedForRef.current = poll.job.id;
      reloadBrief();
    }
  }, [poll.job, poll.stopReason, reloadBrief]);

  async function analyze(): Promise<void> {
    const job = await start.run();
    if (job !== null) {
      setJobId(job.id);
    }
  }

  const analyzing = start.status === 'pending' || poll.polling;
  const job = poll.job;
  const stage =
    job !== null && job.kind === 'reference' && job.progress !== null
      ? job.progress.stage
      : null;
  const failedJob = job !== null && job.state === 'failed' ? job : null;
  const actionLabel = analyzing
    ? t('reference.analyzing')
    : brief.data === null
      ? t('reference.analyze')
      : t('reference.reanalyze');

  return (
    <section
      data-testid="reference-analysis"
      className="min-w-0 space-y-3 border-t border-[var(--tucu-glass-sub-line)] pt-2"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-medium text-[var(--cl-ink)]">
          {t('reference.heading')}
        </h3>
        <button
          type="button"
          data-testid="reference-analyze"
          disabled={analyzing}
          onClick={() => void analyze()}
          className={`ml-auto ${SECONDARY_BUTTON_SMALL_CLASS}`}
        >
          {actionLabel}
        </button>
      </div>

      {analyzing && stage !== null && (
        <p
          role="status"
          data-testid="reference-progress"
          data-stage={stage}
          className="text-xs text-[var(--cl-ink-2)]"
        >
          {t(REFERENCE_STAGE_KEY[stage])}
        </p>
      )}
      {brief.status === 'loading' && brief.data === null && (
        <p className="text-xs text-[var(--cl-ink-2)]">
          {t('reference.loading')}
        </p>
      )}
      {brief.status === 'error' && brief.error !== null && (
        <ErrorNotice
          surface="glass"
          error={brief.error}
          onRetry={brief.reload}
        />
      )}
      {start.error !== null && (
        <ErrorNotice surface="glass" error={start.error} />
      )}
      {failedJob !== null && failedJob.error !== null && (
        <ErrorNotice
          surface="glass"
          error={
            new RenderApiError(
              failedJob.error.code,
              failedJob.error.message,
              null,
              failedJob.error,
            )
          }
        />
      )}
      {brief.status === 'ready' && brief.data === null && !analyzing && (
        <p className="text-xs text-[var(--cl-ink-2)]">{t('reference.empty')}</p>
      )}
      {brief.data !== null && (
        <ReferenceBriefView slug={slug} brief={brief.data} />
      )}
    </section>
  );
}
