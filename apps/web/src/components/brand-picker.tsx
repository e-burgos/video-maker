import { useId } from 'react';
import { Link } from 'react-router-dom';

import { PALETTE_KEYS, brandFileUrl } from '../api/brand-files';
import type { BrandSummary } from '../api/brand-types';
import { useT } from '../i18n/language-context';

export type BrandPickerProps = {
  brands: readonly BrandSummary[];
  value: string | null;
  onChange: (brandId: string | null) => void;
  allowNone?: boolean;
  disabled?: boolean;
  name?: string;
  labelledBy?: string;
};

const OPTION_CLASS =
  'flex cursor-pointer items-center gap-3 rounded-panel border border-border-subtle bg-surface p-2.5 text-sm has-[:checked]:border-accent has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60';

function BrandThumbnail({ brand }: { brand: BrandSummary }) {
  const t = useT();
  return (
    <span className="flex h-10 w-14 shrink-0 items-center justify-center rounded-md bg-slate-950 p-1">
      {brand.logo === null ? (
        <span className="truncate text-[10px] text-ink-faint">{brand.name}</span>
      ) : (
        <img
          src={brandFileUrl(brand.id, brand.logo)}
          alt={t('brandPicker.logoAlt', { name: brand.name })}
          className="max-h-full max-w-full object-contain"
        />
      )}
    </span>
  );
}

function BrandSwatches({ brand }: { brand: BrandSummary }) {
  if (brand.palette === null) {
    return null;
  }
  const palette = brand.palette;
  return (
    <span className="flex gap-1" aria-hidden="true">
      {PALETTE_KEYS.map((key) => (
        <span
          key={key}
          data-testid={`brand-picker-swatch-${brand.id}-${key}`}
          className="h-3.5 w-3.5 rounded-full border border-border-strong"
          style={{ backgroundColor: palette[key] }}
        />
      ))}
    </span>
  );
}

export function BrandPicker({
  brands,
  value,
  onChange,
  allowNone = false,
  disabled = false,
  name,
  labelledBy,
}: BrandPickerProps) {
  const t = useT();
  const groupName = useId();
  const radioName = name ?? groupName;

  return (
    <div className="space-y-2" data-testid="brand-picker">
      <div role="radiogroup" aria-labelledby={labelledBy} className="grid gap-2 sm:grid-cols-2">
        {allowNone && (
          <label className={OPTION_CLASS}>
            <input
              type="radio"
              name={radioName}
              checked={value === null}
              disabled={disabled}
              onChange={() => onChange(null)}
              aria-label={t('brandPicker.none')}
            />
            <span className="text-ink">{t('brandPicker.none')}</span>
          </label>
        )}
        {brands.map((brand) => (
          <label key={brand.id} className={OPTION_CLASS} data-testid={`brand-picker-option-${brand.id}`}>
            <input
              type="radio"
              name={radioName}
              checked={value === brand.id}
              disabled={disabled}
              onChange={() => onChange(brand.id)}
              aria-label={brand.name}
            />
            <BrandThumbnail brand={brand} />
            <span className="min-w-0 flex-1 space-y-1">
              <span className="block truncate font-medium text-ink">{brand.name}</span>
              <BrandSwatches brand={brand} />
            </span>
          </label>
        ))}
      </div>
      {brands.length === 0 && <p className="text-xs text-ink-faint">{t('brandPicker.empty')}</p>}
      <Link to="/brands" data-testid="brand-picker-manage" className="inline-block text-xs text-accent-strong hover:underline">
        {t('brandPicker.manage')}
      </Link>
    </div>
  );
}
