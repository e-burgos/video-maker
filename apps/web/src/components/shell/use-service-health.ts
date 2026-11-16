import { useCallback } from 'react';

import { useRenderApi } from '../../api/render-api-context';
import { useAsyncResource } from '../../hooks/use-async-resource';
import { useT } from '../../i18n/language-context';
import { resolveServiceHealthState, serviceHealthLabel } from './service-health-state';

export function useServiceHealth() {
  const client = useRenderApi();
  const load = useCallback(() => client.getHealth(), [client]);
  const health = useAsyncResource(load, 'health');
  const t = useT();

  const state = resolveServiceHealthState(health.status, health.data);
  const label = serviceHealthLabel(state, health.data, health.error?.code ?? null, t);

  return { state, label, detail: health.data, reload: health.reload };
}
