import { useRenderApi } from '../api/render-api-context';
import { useApiAction } from '../hooks/use-api-action';
import { canSaveTimeline } from '../api/timeline-edit/timeline-edit-state';
import type { TimelineEditAction, TimelineEditState } from '../api/timeline-edit/timeline-edit-state';
import { useT } from '../i18n/language-context';
import { ErrorNotice } from './error-notice';

export type TimelineSaveBarProps = {
  slug: string;
  state: TimelineEditState;
  dispatch: (action: TimelineEditAction) => void;
};

export function TimelineSaveBar({ slug, state, dispatch }: TimelineSaveBarProps) {
  const client = useRenderApi();
  const saveAction = useApiAction(() => client.putTimeline(slug, state.draft));
  const t = useT();

  async function save() {
    const result = await saveAction.run();
    if (result !== null) {
      dispatch({ type: 'saved', timeline: state.draft });
    }
  }

  const disabled = !canSaveTimeline(state) || saveAction.status === 'pending';

  return (
    <div data-testid="timeline-save-bar" data-timeline-dirty={state.dirty} className="flex items-center gap-3">
      <button
        type="button"
        disabled={disabled}
        onClick={() => void save()}
        className="rounded-md border border-emerald-500/50 bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-100 disabled:opacity-40"
      >
        {saveAction.status === 'pending' ? t('render.saving') : t('render.save')}
      </button>
      <span className="text-sm text-slate-400">
        {state.dirty ? t('edit.unsaved') : t('edit.saved')}
      </span>
      {saveAction.error !== null && <ErrorNotice error={saveAction.error} />}
    </div>
  );
}
