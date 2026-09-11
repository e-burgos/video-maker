import type { StoryboardDocument } from '@video-maker/timeline-core';

import { useRenderApi } from '../api/render-api-context';
import { storyboardIssues } from '../api/storyboard-edit/storyboard-document';
import { useApiAction } from '../hooks/use-api-action';
import { useT } from '../i18n/language-context';
import { ErrorNotice } from './error-notice';

export type StoryboardSaveBarProps = {
  slug: string;
  storyboard: StoryboardDocument;
  dirty: boolean;
  onSaved: (saved: StoryboardDocument) => void;
};

export function StoryboardSaveBar({ slug, storyboard, dirty, onSaved }: StoryboardSaveBarProps) {
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
  const disabled = issues.length > 0 || !dirty || saveAction.status === 'pending';

  return (
    <div
      data-testid="storyboard-save-bar"
      data-storyboard-dirty={dirty}
      className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/40 p-4"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={disabled}
          onClick={() => void save()}
          className="rounded-md border border-emerald-500/50 bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-100 disabled:opacity-40"
        >
          {saveAction.status === 'pending' ? t('storyboardSave.saving') : t('storyboardSave.save')}
        </button>
        <span className="text-sm text-slate-400">
          {dirty ? t('edit.unsaved') : t('edit.saved')}
        </span>
      </div>

      {issues.length > 0 && (
        <ul data-testid="storyboard-issues" className="space-y-0.5 font-mono text-xs text-amber-300">
          {issues.map((issue) => (
            <li key={`${issue.path}:${issue.message}`}>
              {issue.path} — {issue.message}
            </li>
          ))}
        </ul>
      )}

      {saveAction.error !== null && <ErrorNotice error={saveAction.error} />}
    </div>
  );
}
