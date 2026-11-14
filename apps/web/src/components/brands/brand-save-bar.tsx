import { StateBadge } from '@e-burgos/tucu-ui';

import type { BrandEditor } from '../../hooks/use-brand-editor';
import { useT } from '../../i18n/language-context';
import { ErrorNotice } from '../error-notice';
import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from '../ui/cl-controls';
import { sectionLabelKey } from './brand-sections';
import type { BrandDraft } from './use-brand-draft';

export type BrandSaveBarProps = { editor: BrandEditor; draft: BrandDraft };

function BrandSaveStatus({ editor }: { editor: BrandEditor }) {
  const t = useT();
  if (editor.saveState === 'saving') {
    return (
      <span data-testid="brand-save-status" className="text-xs text-[var(--cl-ink-2)]">
        {t('brands.save.saving')}
      </span>
    );
  }
  if (editor.saveState === 'error') {
    return (
      <span data-testid="brand-save-status" className="text-xs text-[var(--tucu-state-red-ink)]">
        {t('brands.save.failed')}
      </span>
    );
  }
  return null;
}

export function BrandSaveBar({ editor, draft }: BrandSaveBarProps) {
  const t = useT();
  const saving = editor.saveState === 'saving';
  const invalidMessage = draft.invalidKey === null ? null : t(draft.invalidKey);
  const changedSections = draft.dirtySections.map((id) => t(sectionLabelKey(id))).join(', ');

  return (
    <div
      role="region"
      aria-label={t('brands.save.region')}
      data-testid="brand-save-bar"
      data-brand-dirty={draft.dirty}
      className="glass-thick sticky bottom-0 z-20 mt-auto flex flex-col gap-2 rounded-[16px] px-4 py-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <StateBadge tone={draft.dirty ? 'orange' : 'green'} dot size="sm" data-testid="brand-save-state">
            {draft.dirty ? t('edit.unsaved') : t('edit.saved')}
          </StateBadge>
          {draft.dirty && (
            <span data-testid="brand-changed-sections" className="min-w-0 text-xs text-[var(--cl-ink-2)]">
              {t('brands.save.changed', { sections: changedSections })}
            </span>
          )}
          <BrandSaveStatus editor={editor} />
          {invalidMessage !== null && (
            <span data-testid="brand-save-invalid" className="text-xs text-[var(--tucu-state-orange-ink)]">
              {invalidMessage}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="brand-discard"
            disabled={!draft.dirty || saving}
            onClick={draft.discard}
            className={SECONDARY_BUTTON_CLASS}
          >
            {t('brands.discard')}
          </button>
          <button
            type="button"
            data-testid="brand-save"
            disabled={!draft.dirty || invalidMessage !== null || saving}
            onClick={draft.save}
            className={PRIMARY_BUTTON_CLASS}
          >
            {saving ? t('brands.save.saving') : t('brands.save')}
          </button>
        </div>
      </div>
      <p className="m-0 text-xs text-[var(--cl-ink-3)]">{t('brands.save.immediateNote')}</p>
      {editor.saveError !== null && <ErrorNotice error={editor.saveError} />}
    </div>
  );
}
