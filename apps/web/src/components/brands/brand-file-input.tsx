import { useRef } from 'react';

import { useT } from '../../i18n/language-context';

export type BrandFileInputProps = {
  label: string;
  accept: string;
  testId: string;
  busy: boolean;
  disabled?: boolean;
  onFile: (file: File) => void;
};

const FILE_INPUT_CLASS =
  'focus-cl block w-full max-w-sm text-xs text-[var(--cl-ink-2)] file:mr-3 file:h-8 file:cursor-pointer file:rounded-[10px] file:border file:border-[var(--tucu-glass-sub-line)] file:bg-transparent file:px-3 file:text-xs file:font-semibold file:text-[var(--cl-ink)] disabled:opacity-50';

export function BrandFileInput({ label, accept, testId, busy, disabled = false, onFile }: BrandFileInputProps) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        aria-label={label}
        data-testid={testId}
        disabled={disabled || busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file !== undefined) {
            onFile(file);
          }
          if (inputRef.current !== null) {
            inputRef.current.value = '';
          }
        }}
        className={FILE_INPUT_CLASS}
      />
      {busy && <span className="text-xs text-[var(--cl-ink-2)]">{t('brands.uploading')}</span>}
    </div>
  );
}
