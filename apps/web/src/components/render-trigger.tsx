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
import { useToolbarAction } from './shell/use-toolbar-action';
import { WARNING_LIST_CLASS } from './ui/cl-controls';

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
  const pending = createAction.status === 'pending';

  useToolbarAction({
    label: pending ? t('render.starting') : t('render.start'),
    onClick: () => void trigger(),
    disabled: !canStartRender(state) || pending,
    loading: pending,
  });

  return (
    <div className="flex flex-col gap-2">
      {reasons.length > 0 && (
        <ul data-testid="render-blockers" className={WARNING_LIST_CLASS}>
          {reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}

      {lastJobId !== null && (
        <p role="status" className="m-0 text-sm text-[var(--cl-ink-2)]">
          {t('render.started', { jobId: lastJobId })}
        </p>
      )}

      {createAction.error !== null && <ErrorNotice error={createAction.error} />}
    </div>
  );
}
