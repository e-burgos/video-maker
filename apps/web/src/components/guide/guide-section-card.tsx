import { useT } from '../../i18n/language-context';
import type { GuideSection } from '../../guide/guide-content';
import { ProducerMarkdown } from '../producer-message-list';

export type GuideSectionCardProps = {
  section: GuideSection;
  position: number;
  total: number;
};

export function GuideSectionCard({ section, position, total }: GuideSectionCardProps) {
  const t = useT();

  return (
    <article
      id={section.id}
      data-testid="guide-section"
      data-guide-section={section.id}
      className="glass flex scroll-mt-3 flex-col gap-3 rounded-[20px] p-5 text-[var(--cl-ink)] [&_code]:text-[var(--cl-ink)] [&_pre]:bg-[var(--tucu-glass-sub-bg)] [&_pre]:text-[var(--cl-ink)]"
    >
      <p className="font-data m-0 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--cl-ink-3)]">
        {t('guide.step', { current: position, total })}
      </p>
      <h2 className="m-0 text-lg font-bold tracking-tight text-[var(--cl-ink)]">{section.title}</h2>
      <ProducerMarkdown text={section.body} />
    </article>
  );
}
