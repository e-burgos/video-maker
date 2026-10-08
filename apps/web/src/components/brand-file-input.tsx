import { useRef } from 'react';

import { useT } from '../i18n/language-context';

export type BrandFileInputProps = {
  label: string;
  accept: string;
  testId: string;
  busy: boolean;
  disabled?: boolean;
  onFile: (file: File) => void;
};

export function BrandFileInput({ label, accept, testId, busy, disabled = false, onFile }: BrandFileInputProps) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex items-center gap-2">
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
        className="block w-full max-w-xs text-xs text-ink-muted file:mr-3 file:rounded-control file:border file:border-border-strong file:bg-surface-raised file:px-3 file:py-1.5 file:text-xs file:text-ink-muted disabled:opacity-40"
      />
      {busy && <span className="text-xs text-ink-faint">{t('brands.uploading')}</span>}
    </div>
  );
}
