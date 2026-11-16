import { StateBadge } from '@e-burgos/tucu-ui';

import { useT } from '../../i18n/language-context';
import { ToolbarStatus } from '../shell/toolbar-status';
import { useToolbarAction } from '../shell/use-toolbar-action';

export type PublishQueueToolbarProps = {
  paused: boolean;
  busy: boolean;
  onTogglePause: () => void;
};

export function PublishQueueToolbar({ paused, busy, onTogglePause }: PublishQueueToolbarProps) {
  const t = useT();

  useToolbarAction({
    label: paused ? t('publishQueue.resume') : t('publishQueue.pause'),
    disabled: busy,
    onClick: onTogglePause,
  });

  return (
    <ToolbarStatus>
      <StateBadge tone={paused ? 'orange' : 'green'} dot size="sm" data-testid="publish-queue-state">
        {paused ? t('publishQueue.state.paused') : t('publishQueue.state.active')}
      </StateBadge>
    </ToolbarStatus>
  );
}
