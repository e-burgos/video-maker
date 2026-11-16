import { useRef } from 'react';

import { useT } from '../i18n/language-context';
import { SECONDARY_BUTTON_SMALL_CLASS } from './ui/cl-controls';

export type ChatDropZoneProps = {
  onFiles: (files: FileList) => void;
  disabled?: boolean;
  compact?: boolean;
};

export function ChatDropZone({ onFiles, disabled = false, compact = false }: ChatDropZoneProps) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      data-testid="chat-drop-zone"
      data-compact={compact}
      className={
        compact
          ? 'contents'
          : 'flex items-center justify-between gap-2 rounded-[14px] border border-dashed border-[var(--cl-ink-3)] px-4 py-2.5 text-xs text-[var(--cl-ink-2)]'
      }
    >
      {!compact && (
        <span className="flex items-center gap-2">
          <span aria-hidden="true">↳</span>
          <span>{t('workspace.dropZone.hint')}</span>
        </span>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple
        disabled={disabled}
        aria-label={t('workspace.attach')}
        onChange={(event) => {
          if (event.target.files !== null && event.target.files.length > 0) {
            onFiles(event.target.files);
          }
          event.target.value = '';
        }}
        className="hidden"
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className={SECONDARY_BUTTON_SMALL_CLASS}
      >
        {t('workspace.attach')}
      </button>
    </div>
  );
}
