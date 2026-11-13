import type { BrandSummary } from '../../api/brand-types';
import { useT } from '../../i18n/language-context';
import type { TranslationKey } from '../../i18n/messages-en';
import { BrandCard } from './brand-card';

export type BrandGroupProps = {
  testId: string;
  headingKey: TranslationKey;
  brands: readonly BrandSummary[];
  onDuplicate: (brand: BrandSummary) => void;
  onDelete: (brand: BrandSummary) => void;
};

export function BrandGroup({ testId, headingKey, brands, onDuplicate, onDelete }: BrandGroupProps) {
  const t = useT();

  return (
    <section data-testid={testId} className="flex flex-col gap-3">
      <h2 className="m-0 text-xs font-bold uppercase tracking-wide text-[var(--cl-ink-2)]">{t(headingKey)}</h2>
      <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 min-[1280px]:grid-cols-3">
        {brands.map((brand) => (
          <li key={brand.id} className="min-w-0">
            <BrandCard brand={brand} onDuplicate={onDuplicate} onDelete={onDelete} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function NewBrandTile({ onClick }: { onClick: () => void }) {
  const t = useT();

  return (
    <button
      type="button"
      data-testid="brand-create"
      onClick={onClick}
      className="focus-cl flex min-h-16 items-center justify-center rounded-[14px] border border-dashed border-[var(--cl-ink-3)] px-4 py-3 text-sm font-semibold text-[var(--cl-action-text)] hover:border-[var(--cl-action-fill)]"
    >
      {t('brands.create.tile')}
    </button>
  );
}
