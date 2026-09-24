import { useT } from '../i18n/language-context';

export function ChatDropZonePlaceholder() {
  const t = useT();

  return (
    <div
      data-testid="chat-drop-zone"
      className="flex items-center justify-center gap-2 rounded-panel border border-dashed border-border-strong px-4 py-3 text-center text-xs text-ink-faint"
    >
      <span aria-hidden="true">↳</span>
      <span>{t('workspace.dropZone.hint')}</span>
    </div>
  );
}
