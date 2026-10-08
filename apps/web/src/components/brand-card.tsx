import { Link } from 'react-router-dom';

import { PALETTE_KEYS, brandFileUrl } from '../api/brand-files';
import type { BrandSummary } from '../api/brand-types';
import { useT } from '../i18n/language-context';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card } from './ui/card';

export type BrandCardProps = {
  brand: BrandSummary;
  onDuplicate: (brand: BrandSummary) => void;
  onDelete: (brand: BrandSummary) => void;
};

export function BrandCard({ brand, onDuplicate, onDelete }: BrandCardProps) {
  const t = useT();
  const builtIn = brand.source === 'built-in';

  return (
    <Card data-testid={`brand-card-${brand.id}`} className="flex h-full flex-col gap-3 p-4">
      <div className="flex h-20 items-center justify-center rounded-md bg-slate-950 p-3">
        {brand.logo === null ? (
          <span className="text-sm text-ink-faint">{brand.name}</span>
        ) : (
          <img
            src={brandFileUrl(brand.id, brand.logo)}
            alt={t('brands.card.logoAlt', { name: brand.name })}
            className="max-h-full max-w-full object-contain"
          />
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <h2 className="truncate text-sm font-medium text-ink">{brand.name}</h2>
        <Badge tone={builtIn ? 'neutral' : 'accent'} data-testid={`brand-source-${brand.id}`}>
          {builtIn ? t('brands.source.builtIn') : t('brands.source.user')}
        </Badge>
      </div>
      {brand.palette !== null && (
        <ul className="flex gap-1.5" aria-label={t('brands.card.palette')}>
          {PALETTE_KEYS.map((key) => (
            <li
              key={key}
              title={brand.palette?.[key]}
              data-testid={`brand-swatch-${brand.id}-${key}`}
              className="h-6 w-6 rounded-full border border-border-strong"
              style={{ backgroundColor: brand.palette?.[key] }}
            />
          ))}
        </ul>
      )}
      <div className="mt-auto flex flex-wrap gap-2 pt-2">
        <Link
          to={`/brands/${encodeURIComponent(brand.id)}`}
          data-testid={`brand-open-${brand.id}`}
          className="rounded-control border border-accent-soft/50 bg-accent-soft/10 px-3 py-1.5 text-sm text-accent-strong hover:border-accent-soft/70"
        >
          {builtIn ? t('brands.card.view') : t('brands.card.edit')}
        </Link>
        <Button data-testid={`brand-duplicate-${brand.id}`} onClick={() => onDuplicate(brand)}>
          {t('brands.duplicate')}
        </Button>
        {!builtIn && (
          <Button data-testid={`brand-delete-${brand.id}`} onClick={() => onDelete(brand)}>
            {t('brands.delete')}
          </Button>
        )}
      </div>
    </Card>
  );
}
