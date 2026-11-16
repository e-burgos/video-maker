import { StateBadge } from '@e-burgos/tucu-ui';
import { useCallback } from 'react';

import { useRenderApi } from '../../api/render-api-context';
import type { ServiceHealth } from '../../api/render-api-types';
import { useAsyncResource } from '../../hooks/use-async-resource';
import { useT } from '../../i18n/language-context';
import { ErrorNotice } from '../error-notice';
import { PANEL_CLASS, PANEL_HEADING_CLASS } from '../ui/cl-controls';
import { LoadingState } from '../ui/status-states';
import { ENGINE_LABEL, ENGINE_STATE_LABEL, ENGINE_STATE_TONE, engineStatuses, apiBaseUrl } from './engines-model';

export function StudioEnginesStatus() {
  const client = useRenderApi();
  const t = useT();
  const load = useCallback((): Promise<ServiceHealth> => client.getHealth(), [client]);
  const health = useAsyncResource<ServiceHealth>(load, 'agents-health');

  return (
    <section data-testid="agents-status" className={`${PANEL_CLASS} gap-3 min-[1100px]:col-span-2`}>
      <h2 className={PANEL_HEADING_CLASS}>{t('agents.status.heading')}</h2>
      {health.status === 'loading' && <LoadingState message={t('agents.status.loading')} />}
      {health.status === 'error' && health.error !== null && (
        <ErrorNotice error={health.error} onRetry={health.reload} />
      )}
      {health.status === 'ready' && health.data !== null && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <p data-testid="agents-studio" className="m-0 text-sm text-[var(--cl-ink)]">
            {t('agents.status.studio', { url: apiBaseUrl(window.location) })}
          </p>
          <ul aria-label={t('agents.status.engines')} className="m-0 flex list-none flex-wrap items-center gap-2 p-0">
            {engineStatuses(health.data).map((engine) => (
              <li key={engine.id} data-testid={`agents-engine-${engine.id}`} data-state={engine.state} className="flex items-center gap-2 text-sm text-[var(--cl-ink-2)]">
                {t(ENGINE_LABEL[engine.id])}
                <StateBadge tone={ENGINE_STATE_TONE[engine.state]} dot size="sm">
                  {t(ENGINE_STATE_LABEL[engine.state])}
                </StateBadge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
