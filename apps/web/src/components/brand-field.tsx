import type { ReactNode } from 'react';

export const BRAND_INPUT_CLASS =
  'w-full rounded-control border border-border-strong bg-surface px-3 py-1.5 text-sm text-ink placeholder:text-ink-faint disabled:opacity-50';

export type BrandFieldProps = {
  label: string;
  hint?: string;
  children: ReactNode;
};

export function BrandField({ label, hint, children }: BrandFieldProps) {
  return (
    <div className="space-y-1">
      <label className="block space-y-1">
        <span className="text-xs font-medium text-ink-muted">{label}</span>
        {children}
      </label>
      {hint !== undefined && <p className="text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}
