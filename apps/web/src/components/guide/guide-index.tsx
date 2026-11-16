import { useT } from '../../i18n/language-context';
import type { GuideSection } from '../../guide/guide-content';

export type GuideIndexProps = {
  sections: readonly GuideSection[];
  activeId: string | null;
  onSelect: (id: string) => void;
};

export function GuideIndex({ sections, activeId, onSelect }: GuideIndexProps) {
  const t = useT();

  return (
    <nav
      data-testid="guide-index"
      aria-label={t('guide.index.label')}
      className="glass flex min-w-0 flex-wrap items-center gap-1 rounded-[20px] p-2 min-[1100px]:sticky min-[1100px]:top-0 min-[1100px]:max-h-[calc(100dvh-7rem)] min-[1100px]:flex-col min-[1100px]:flex-nowrap min-[1100px]:items-stretch min-[1100px]:overflow-y-auto"
    >
      <p className="font-data m-0 hidden px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--cl-ink-3)] min-[1100px]:block">
        {t('guide.index.label')}
      </p>
      {sections.map((section, index) => {
        const current = section.id === activeId;
        return (
          <a
            key={section.id}
            href={`#${section.id}`}
            data-guide-link={section.id}
            aria-current={current ? 'location' : undefined}
            onClick={() => onSelect(section.id)}
            className={`focus-cl flex items-baseline gap-2.5 rounded-[12px] border px-3 py-2 text-sm font-semibold no-underline ${
              current
                ? 'border-[var(--cl-action-ring)] bg-[color-mix(in_srgb,var(--cl-action-fill)_16%,transparent)] text-[var(--cl-action-text)]'
                : 'border-transparent text-[var(--cl-ink-2)] hover:text-[var(--cl-ink)]'
            }`}
          >
            <span aria-hidden className="font-data w-4 shrink-0 text-xs opacity-70">
              {index + 1}
            </span>
            <span className="min-w-0">{section.title}</span>
          </a>
        );
      })}
    </nav>
  );
}
