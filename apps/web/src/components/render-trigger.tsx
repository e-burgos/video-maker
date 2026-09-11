import { useState } from 'react';

import { useRenderApi } from '../api/render-api-context';
import { issueSeverity } from '../api/timeline-edit/issue-severity';
import { canStartRender } from '../api/timeline-edit/timeline-edit-state';
import type { TimelineEditState } from '../api/timeline-edit/timeline-edit-state';
import { useApiAction } from '../hooks/use-api-action';
import type { RenderJob } from '../api/render-api-types';
import { useT } from '../i18n/language-context';
import type { TranslateFn } from '../i18n/language-context';
import { ErrorNotice } from './error-notice';

export type RenderTriggerProps = {
  slug: string;
  state: TimelineEditState;
  onCreated: (job: RenderJob) => void;
};

function blockingReasons(state: TimelineEditState, t: TranslateFn): string[] {
  const reasons: string[] = [];
  if (state.dirty) {
    reasons.push(t('render.saveFirst'));
  }
  state.issues
    .filter((issue) => issueSeverity(issue.code) === 'render-blocking')
    .forEach((issue) => reasons.push(issue.code));
  return reasons;
}

export function RenderTrigger({ slug, state, onCreated }: RenderTriggerProps) {
  const client = useRenderApi();
  const createAction = useApiAction(() => client.createRenderJob(slug));
  const [lastJobId, setLastJobId] = useState<string | null>(null);
  const t = useT();

  async function trigger() {
    const job = await createAction.run();
    if (job !== null) {
      setLastJobId(job.id);
      onCreated(job);
    }
  }

  const reasons = blockingReasons(state, t);
  const disabled = !canStartRender(state) || createAction.status === 'pending';

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => void trigger()}
        className="rounded-md border border-sky-500/50 bg-sky-500/10 px-3 py-1.5 text-sm text-sky-100 disabled:opacity-40"
      >
        {createAction.status === 'pending' ? t('render.starting') : t('render.start')}
      </button>

      {reasons.length > 0 && (
        <ul className="space-y-0.5 font-mono text-xs text-amber-300">
          {reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}

      {lastJobId !== null && (
        <p role="status" className="text-sm text-slate-400">
          {t('render.started', { jobId: lastJobId })}
        </p>
      )}

      {createAction.error !== null && <ErrorNotice error={createAction.error} />}
    </div>
  );
}
