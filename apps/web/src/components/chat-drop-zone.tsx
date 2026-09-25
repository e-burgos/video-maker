import { useRef } from 'react';

import { useT } from '../i18n/language-context';
import { Button } from './ui/button';

export type ChatDropZoneProps = {
  onFiles: (files: FileList) => void;
  disabled?: boolean;
};

export function ChatDropZone({ onFiles, disabled = false }: ChatDropZoneProps) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      data-testid="chat-drop-zone"
      className="flex items-center justify-between gap-2 rounded-panel border border-dashed border-border-strong px-4 py-3 text-xs text-ink-faint"
    >
      <span className="flex items-center gap-2">
        <span aria-hidden="true">↳</span>
        <span>{t('workspace.dropZone.hint')}</span>
      </span>

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
      <Button
        variant="secondary"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        {t('workspace.attach')}
      </Button>
    </div>
  );
}
