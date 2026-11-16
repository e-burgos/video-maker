import { StateBadge } from '@e-burgos/tucu-ui';

import type { TimelineEditState } from '../../api/timeline-edit/timeline-edit-state';
import { useT } from '../../i18n/language-context';
import { ToolbarStatus } from '../shell/toolbar-status';

export function PreviewToolbarStatus({ state }: { state: TimelineEditState }) {
  const t = useT();
  const noticeCount = state.issues.length + state.warnings.length;

  if (state.dirty) {
    return (
      <ToolbarStatus>
        <StateBadge tone="orange" dot size="sm" data-testid="preview-toolbar-status">
          {t('edit.unsaved')}
        </StateBadge>
      </ToolbarStatus>
    );
  }

  if (noticeCount > 0) {
    return (
      <ToolbarStatus>
        <StateBadge tone="orange" dot size="sm" data-testid="preview-toolbar-status">
          {t('preview.toolbar.notices', { count: noticeCount })}
        </StateBadge>
      </ToolbarStatus>
    );
  }

  return null;
}
