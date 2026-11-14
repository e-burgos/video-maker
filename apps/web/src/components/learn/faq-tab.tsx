import type { FaqContent } from '../../content/learn/learn-content';
import { ProducerMarkdown } from '../producer-message-list';
import { LearnSectionHeading } from './learn-section-heading';

export type FaqTabProps = {
  content: FaqContent;
};

export function FaqTab({ content }: FaqTabProps) {
  return (
    <>
      <LearnSectionHeading title={content.title} />
      <div data-testid="learn-faq" className="flex max-w-4xl flex-col gap-2">
        {content.entries.map((entry) => (
          <details
            key={entry.id}
            data-testid="learn-faq-item"
            data-faq-id={entry.id}
            className="glass-sub group rounded-[16px] px-4 py-3 text-[var(--cl-ink)] [&_code]:text-[var(--cl-ink)]"
          >
            <summary className="focus-cl cursor-pointer list-none rounded text-[15px] font-semibold text-[var(--cl-ink)] [&::-webkit-details-marker]:hidden">
              {entry.question}
            </summary>
            <div className="pt-3 text-sm text-[var(--cl-ink-2)]">
              <ProducerMarkdown text={entry.answer} />
            </div>
          </details>
        ))}
      </div>
    </>
  );
}
