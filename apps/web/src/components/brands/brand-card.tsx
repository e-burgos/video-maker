import { StateBadge } from '@e-burgos/tucu-ui';
import { Link } from 'react-router-dom';

import { PALETTE_KEYS, brandFileUrl } from '../../api/brand-files';
import type { BrandSummary } from '../../api/brand-types';
import { useT } from '../../i18n/language-context';
import { OPAQUE_MEDIA_FRAME_CLASS, PRIMARY_BUTTON_SMALL_CLASS, SECONDARY_BUTTON_SMALL_CLASS } from '../ui/cl-controls';
import { OverflowMenu } from '../ui/overflow-menu';

export type BrandCardProps = {
  brand: BrandSummary;
  onDuplicate: (brand: BrandSummary) => void;
  onDelete: (brand: BrandSummary) => void;
};

export function BrandCard({ brand, onDuplicate, onDelete }: BrandCardProps) {
  const t = useT();
  const builtIn = brand.source === 'built-in';

  return (
    <div
      data-testid={`brand-card-${brand.id}`}
      className="glass-sub relative flex h-full min-w-0 flex-col gap-3 rounded-[14px] p-3 hover:border-[var(--cl-ink-3)]"
    >
      <div className={`${OPAQUE_MEDIA_FRAME_CLASS} flex h-28 items-center justify-center p-3`}>
        {brand.logo === null ? (
          <span className="truncate text-sm font-bold text-white/80">{brand.name}</span>
        ) : (
          <img
            src={brandFileUrl(brand.id, brand.logo)}
            alt={t('brands.card.logoAlt', { name: brand.name })}
            className="max-h-full max-w-full object-contain"
          />
        )}
      </div>
      <div className="flex min-w-0 items-center justify-between gap-2">
        <h2 className="m-0 min-w-0 truncate text-[15px] font-bold text-[var(--cl-ink)]">{brand.name}</h2>
        <StateBadge tone={builtIn ? 'neutral' : 'teal'} size="sm" data-testid={`brand-source-${brand.id}`}>
          {builtIn ? t('brands.source.builtIn') : t('brands.source.user')}
        </StateBadge>
      </div>
      {brand.palette !== null && (
        <ul className="m-0 flex list-none gap-1.5 p-0" aria-label={t('brands.card.palette')}>
          {PALETTE_KEYS.map((key) => (
            <li
              key={key}
              title={brand.palette?.[key]}
              data-testid={`brand-swatch-${brand.id}-${key}`}
              className="size-6 rounded-full border border-[var(--tucu-glass-sub-line)]"
              style={{ backgroundColor: brand.palette?.[key] }}
            />
          ))}
        </ul>
      )}
      <div className="mt-auto flex items-center gap-2 pt-1">
        <Link
          to={`/brands/${encodeURIComponent(brand.id)}`}
          data-testid={`brand-open-${brand.id}`}
          className={PRIMARY_BUTTON_SMALL_CLASS}
        >
          {builtIn ? t('brands.card.view') : t('brands.card.edit')}
        </Link>
        <button
          type="button"
          data-testid={`brand-duplicate-${brand.id}`}
          className={SECONDARY_BUTTON_SMALL_CLASS}
          onClick={() => onDuplicate(brand)}
        >
          {t('brands.duplicate')}
        </button>
        {!builtIn && (
          <OverflowMenu
            className="ml-auto"
            triggerLabel={t('brands.card.menu', { name: brand.name })}
            triggerTestId={`brand-menu-${brand.id}`}
            menuTestId={`brand-menu-list-${brand.id}`}
            items={[
              {
                id: 'delete',
                label: t('brands.delete'),
                testId: `brand-delete-${brand.id}`,
                tone: 'danger',
                onSelect: () => onDelete(brand),
              },
            ]}
          />
        )}
      </div>
    </div>
  );
}
