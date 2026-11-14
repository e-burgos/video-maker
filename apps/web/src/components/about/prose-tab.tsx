import type { ReactNode } from 'react';

import type { ProseContent } from '../../content/about/about-content';
import { LearnSectionHeading } from '../learn/learn-section-heading';
import { PANEL_CLASS, PANEL_HEADING_CLASS } from '../ui/cl-controls';
import { ContentBlocksView } from './content-blocks-view';

export type ProseTabProps = {
  testId: string;
  content: ProseContent;
  footer?: ReactNode;
};

export function ProseTab({ testId, content, footer }: ProseTabProps) {
  return (
    <div data-testid={testId} className="flex min-w-0 flex-col gap-4">
      <LearnSectionHeading title={content.title} lede={content.lede} />
      {content.sections.map((section) => (
        <section key={section.id} data-testid={`${testId}-${section.id}`} className={`${PANEL_CLASS} max-w-4xl`}>
          <h3 className={PANEL_HEADING_CLASS}>{section.title}</h3>
          <ContentBlocksView blocks={section.blocks} />
        </section>
      ))}
      {footer}
    </div>
  );
}
