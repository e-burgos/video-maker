import { SegmentedControl } from '@e-burgos/tucu-ui';
import { useState } from 'react';

import type { HowItWorksContent } from '../../content/learn/learn-content';
import { useT } from '../../i18n/language-context';
import { LearnSectionHeading } from './learn-section-heading';
import { PathWalkthrough } from './path-walkthrough';
import { PipelineStages } from './pipeline-stages';
import { WhereRunsTable } from './where-runs-table';

export type HowItWorksTabProps = {
  content: HowItWorksContent;
};

export function HowItWorksTab({ content }: HowItWorksTabProps) {
  const t = useT();
  const [pathId, setPathId] = useState(content.paths[0]?.id ?? '');
  const path = content.paths.find((candidate) => candidate.id === pathId) ?? content.paths[0];

  return (
    <>
      <LearnSectionHeading title={content.title} lede={content.lede} />
      <section className="flex flex-col gap-3" aria-label={content.pipelineTitle}>
        <LearnSectionHeading title={content.pipelineTitle} />
        <PipelineStages stages={content.stages} />
      </section>
      <section className="flex flex-col gap-3" aria-label={content.pathsTitle}>
        <LearnSectionHeading title={content.pathsTitle} lede={content.pathsLede} />
        <div className="glass-thin max-w-full self-start overflow-x-auto rounded-[12px] p-[3px]">
          <SegmentedControl
            size="sm"
            aria-label={t('learn.paths.label')}
            options={content.paths.map((candidate) => ({
              value: candidate.id,
              'data-testid': `learn-path-${candidate.id}`,
              label: candidate.tabLabel,
            }))}
            value={path?.id ?? ''}
            onChange={setPathId}
          />
        </div>
        {path !== undefined && <PathWalkthrough key={path.id} path={path} />}
      </section>
      <section className="flex flex-col gap-3" aria-label={content.whereTitle}>
        <LearnSectionHeading title={content.whereTitle} />
        <WhereRunsTable headers={content.whereHeaders} rows={content.whereRows} />
      </section>
    </>
  );
}
