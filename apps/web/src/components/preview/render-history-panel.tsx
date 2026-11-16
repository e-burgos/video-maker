import { useState } from 'react';

import { canStartRender } from '../../api/timeline-edit/timeline-edit-state';
import type { TimelineEditState } from '../../api/timeline-edit/timeline-edit-state';
import { useT } from '../../i18n/language-context';
import { RenderJobList } from '../render-job-list';
import { RenderJobPanel } from '../render-job-panel';
import { RenderTrigger } from '../render-trigger';
import { SampleTrigger } from '../sample-trigger';

export type RenderHistoryPanelProps = {
  slug: string;
  state: TimelineEditState;
};

export function RenderHistoryPanel({ slug, state }: RenderHistoryPanelProps) {
  const t = useT();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  return (
    <section data-testid="render-history" className="glass flex min-w-0 flex-col gap-3 rounded-[20px] p-4">
      <h2 className="m-0 text-[15px] font-bold text-[var(--cl-ink)]">{t('preview.history.heading')}</h2>
      <RenderTrigger slug={slug} state={state} onCreated={(job) => setSelectedJobId(job.id)} />
      <SampleTrigger slug={slug} kind="render" disabled={!canStartRender(state)} />
      <RenderJobList slug={slug} onSelect={setSelectedJobId} />
      <RenderJobPanel slug={slug} jobId={selectedJobId} onRetried={(job) => setSelectedJobId(job.id)} />
    </section>
  );
}
