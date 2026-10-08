import type { BrandEditor } from '../hooks/use-brand-editor';
import { useT } from '../i18n/language-context';
import { ErrorNotice } from './error-notice';
import { Button } from './ui/button';

export type BrandSaveBarProps = {
  editor: BrandEditor;
  dirty: boolean;
  onSave: () => void;
  testId: string;
  invalidMessage?: string | null;
};

export function BrandSaveStatus({ editor }: { editor: BrandEditor }) {
  const t = useT();
  if (editor.saveState === 'saving') {
    return (
      <span data-testid="brand-save-status" className="text-xs text-ink-faint">
        {t('brands.save.saving')}
      </span>
    );
  }
  if (editor.saveState === 'saved') {
    return (
      <span data-testid="brand-save-status" className="text-xs text-success">
        {t('brands.save.saved')}
      </span>
    );
  }
  if (editor.saveState === 'error') {
    return (
      <span data-testid="brand-save-status" className="text-xs text-danger">
        {t('brands.save.failed')}
      </span>
    );
  }
  return null;
}

export function BrandSaveBar({ editor, dirty, onSave, testId, invalidMessage = null }: BrandSaveBarProps) {
  const t = useT();

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          data-testid={testId}
          disabled={editor.readOnly || !dirty || invalidMessage !== null || editor.saveState === 'saving'}
          onClick={onSave}
        >
          {t('brands.save')}
        </Button>
        <BrandSaveStatus editor={editor} />
        {invalidMessage !== null && <span className="text-xs text-warning">{invalidMessage}</span>}
      </div>
      {editor.saveError !== null && <ErrorNotice error={editor.saveError} />}
    </div>
  );
}
