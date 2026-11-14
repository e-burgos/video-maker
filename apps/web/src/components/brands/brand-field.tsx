import type { ReactNode } from 'react';

import { BRAND_SMALL_HINT_CLASS } from './brand-controls';
import { FIELD_LABEL_CLASS } from '../ui/cl-controls';

export type BrandFieldProps = {
  label: string;
  hint?: string;
  children: ReactNode;
};

export function BrandField({ label, hint, children }: BrandFieldProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label className="flex min-w-0 flex-col gap-1">
        <span className={FIELD_LABEL_CLASS}>{label}</span>
        {children}
      </label>
      {hint !== undefined && <p className={BRAND_SMALL_HINT_CLASS}>{hint}</p>}
    </div>
  );
}
