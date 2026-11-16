import { StateBadge } from '@e-burgos/tucu-ui';

import { producerEngineLabel } from '../../api/producer-engine-i18n';
import type { ProducerSettings } from '../../api/render-api-types';
import { useT } from '../../i18n/language-context';

export function ProducerEngineStatus({ settings }: { settings: ProducerSettings }) {
  const t = useT();
  const claude = settings.engines.claudeCli;
  const keyPresent = settings.engines.openrouter.keyPresent;

  return (
    <ul data-testid="settings-engine-status" className="m-0 flex list-none flex-col gap-1.5 p-0 text-xs text-[var(--cl-ink-2)]">
      <li data-testid="settings-engine-status-claudeCli" className="flex flex-wrap items-center gap-2">
        <span className="font-data">{producerEngineLabel(t, 'claude-cli')}</span>
        <StateBadge tone={claude.available ? 'green' : 'neutral'} dot size="sm">
          {claude.available ? t('settings.engine.available') : t('settings.engine.unavailable')}
        </StateBadge>
        {!claude.available && claude.reason !== null && (
          <span className="text-[var(--cl-ink-3)]">({claude.reason})</span>
        )}
      </li>
      <li data-testid="settings-engine-status-openrouter" className="flex flex-wrap items-center gap-2">
        <span className="font-data">{producerEngineLabel(t, 'openrouter')}</span>
        <StateBadge tone={keyPresent ? 'green' : 'neutral'} dot size="sm">
          {keyPresent ? t('settings.engine.available') : t('settings.engine.unavailable')}
        </StateBadge>
        {!keyPresent && <span className="text-[var(--cl-ink-3)]">({t('settings.engine.openrouterKeyMissing')})</span>}
      </li>
    </ul>
  );
}
