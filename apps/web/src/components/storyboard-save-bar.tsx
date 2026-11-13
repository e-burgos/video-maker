import { StateBadge } from '@e-burgos/tucu-ui';
import type { StoryboardDocument } from '@video-maker/timeline-core';

import { useRenderApi } from '../api/render-api-context';
import { storyboardIssues } from '../api/storyboard-edit/storyboard-document';
import { useApiAction } from '../hooks/use-api-action';
import { useT } from '../i18n/language-context';
import { ErrorNotice } from './error-notice';
import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from './ui/cl-controls';

export type StoryboardSaveBarProps = {
  slug: string;
  storyboard: StoryboardDocument;
  dirty: boolean;
  onSaved: (saved: StoryboardDocument) => void;
  onDiscard?: () => void;
};

export function StoryboardSaveBar({ slug, storyboard, dirty, onSaved, onDiscard }: StoryboardSaveBarProps) {
  const client = useRenderApi();
  const saveAction = useApiAction(() => client.putStoryboard(slug, storyboard));
  const t = useT();

  async function save() {
    const result = await saveAction.run();
    if (result !== null) {
      onSaved(storyboard);
    }
  }

  const issues = storyboardIssues(storyboard);
  const pending = saveAction.status === 'pending';
  const disabled = issues.length > 0 || !dirty || pending;

  return (
    <div
      role="region"
      aria-label={t('storyboardSave.label')}
      data-testid="storyboard-save-bar"
      data-storyboard-dirty={dirty}
      className="glass-thick sticky bottom-0 z-20 mt-auto flex flex-col gap-2 rounded-[16px] px-4 py-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StateBadge tone={dirty ? 'orange' : 'green'} dot size="sm">
          {dirty ? t('edit.unsaved') : t('edit.saved')}
        </StateBadge>
        <div className="flex flex-wrap items-center gap-2">
          {onDiscard !== undefined && (
            <button
              type="button"
              data-testid="storyboard-discard"
              disabled={!dirty || pending}
              onClick={onDiscard}
              className={SECONDARY_BUTTON_CLASS}
            >
              {t('storyboardSave.discard')}
            </button>
          )}
          <button
            type="button"
            disabled={disabled}
            onClick={() => void save()}
            className={PRIMARY_BUTTON_CLASS}
          >
            {pending ? t('storyboardSave.saving') : t('storyboardSave.save')}
          </button>
        </div>
      </div>

      {issues.length > 0 && (
        <ul
          data-testid="storyboard-issues"
          className="font-data m-0 list-none flex flex-col gap-0.5 p-0 text-xs text-[var(--tucu-state-orange-ink)]"
        >
          {issues.map((issue) => (
            <li key={`${issue.path}:${issue.message}`}>
              {issue.path} — {issue.message}
            </li>
          ))}
        </ul>
      )}

      {saveAction.error !== null && <ErrorNotice surface="glass" error={saveAction.error} />}
    </div>
  );
}
