import { useCallback } from 'react';

import { useRenderApi } from '../api/render-api-context';
import { useAsyncResource } from '../hooks/use-async-resource';
import type { ServiceHealth } from '../api/render-api-types';

const DOT_CLASS_BY_STATE: Readonly<Record<string, string>> = {
  ok: 'bg-emerald-400',
  degraded: 'bg-amber-400',
  unreachable: 'bg-rose-500',
  loading: 'bg-slate-500',
};

function missingParts(health: ServiceHealth): string[] {
  return [
    ...health.engine.filter((module) => !module.loaded).map((module) => module.name),
    ...health.binaries.filter((binary) => !binary.resolved).map((binary) => binary.name),
  ];
}

export function ServiceHealthBadge() {
  const client = useRenderApi();
  const load = useCallback(() => client.getHealth(), [client]);
  const health = useAsyncResource(load, 'health');

  const state =
    health.status === 'loading' ? 'loading' : health.status === 'error' ? 'unreachable' : (health.data?.status ?? 'unreachable');

  const label =
    state === 'loading'
      ? 'checking service'
      : state === 'unreachable'
        ? `service unreachable (${health.error?.code ?? 'UNKNOWN'})`
        : state === 'degraded'
          ? `service degraded: ${missingParts(health.data as ServiceHealth).join(', ')}`
          : `service ok · cycle ${health.data?.cycle ?? 0}`;

  return (
    <button
      type="button"
      onClick={health.reload}
      title="Re-check the render service"
      className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500"
    >
      <span
        aria-hidden="true"
        className={`size-2 rounded-full ${DOT_CLASS_BY_STATE[state] ?? DOT_CLASS_BY_STATE['loading']}`}
      />
      <span data-testid="service-health-label">{label}</span>
    </button>
  );
}
