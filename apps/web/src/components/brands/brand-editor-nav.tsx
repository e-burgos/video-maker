import { useT } from '../../i18n/language-context';
import type { DirtySections } from './brand-draft';
import { BRAND_SECTIONS, isDraftSection } from './brand-sections';
import type { BrandSectionId } from './brand-sections';

export type BrandEditorNavProps = {
  active: BrandSectionId;
  dirtyBySection: DirtySections;
  onSelect: (id: BrandSectionId) => void;
};

export function BrandEditorNav({ active, dirtyBySection, onSelect }: BrandEditorNavProps) {
  const t = useT();

  return (
    <nav
      aria-label={t('brands.sections')}
      className="glass flex min-w-0 flex-row flex-wrap gap-1 rounded-[20px] p-2 min-[1280px]:flex-col min-[1280px]:flex-nowrap"
    >
      {BRAND_SECTIONS.map((section) => {
        const selected = section.id === active;
        const changed = isDraftSection(section.id) && dirtyBySection[section.id];
        return (
          <button
            key={section.id}
            type="button"
            data-testid={`brand-nav-${section.id}`}
            data-changed={changed}
            aria-current={selected ? 'page' : undefined}
            onClick={() => onSelect(section.id)}
            className={`focus-cl flex items-center justify-between gap-2 rounded-[12px] border px-3 py-2 text-left text-sm font-semibold ${
              selected
                ? 'border-[var(--cl-action-ring)] bg-[color-mix(in_srgb,var(--cl-action-fill)_16%,transparent)] text-[var(--cl-action-text)]'
                : 'border-transparent text-[var(--cl-ink-2)] hover:text-[var(--cl-ink)]'
            }`}
          >
            {t(section.labelKey)}
            {changed && (
              <>
                <span aria-hidden className="size-2 shrink-0 rounded-full bg-[var(--tucu-state-orange-ink)]" />
                <span className="sr-only">{t('brands.section.changed')}</span>
              </>
            )}
          </button>
        );
      })}
    </nav>
  );
}
