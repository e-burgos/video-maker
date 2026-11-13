import { StateBadge } from '@e-burgos/tucu-ui';

import { useRenderApi } from '../api/render-api-context';
import { useApiAction } from '../hooks/use-api-action';
import { canSaveTimeline } from '../api/timeline-edit/timeline-edit-state';
import type { TimelineEditAction, TimelineEditState } from '../api/timeline-edit/timeline-edit-state';
import { useT } from '../i18n/language-context';
import { ErrorNotice } from './error-notice';
import { SECONDARY_BUTTON_CLASS } from './ui/cl-controls';

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
    <div
      role="region"
      aria-label={t('timelineSave.label')}
      data-testid="timeline-save-bar"
      data-timeline-dirty={state.dirty}
      className="glass-thick sticky bottom-0 z-20 mt-auto flex flex-col gap-2 rounded-[16px] px-4 py-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StateBadge tone={state.dirty ? 'orange' : 'green'} dot size="sm">
          {state.dirty ? t('edit.unsaved') : t('edit.saved')}
        </StateBadge>
        <button type="button" disabled={disabled} onClick={() => void save()} className={SECONDARY_BUTTON_CLASS}>
          {saveAction.status === 'pending' ? t('render.saving') : t('render.save')}
        </button>
      </div>
      {saveAction.error !== null && <ErrorNotice surface="glass" error={saveAction.error} />}
    </div>
  );
}
