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

  const detail = health.data;

  return (
    <div className="relative flex items-center gap-2">
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

      <details className="text-xs text-slate-400">
        <summary className="cursor-pointer list-none rounded-full border border-slate-700 px-2 py-1 hover:border-slate-500">
          details
        </summary>
        <div
          data-testid="service-health-details"
          className="absolute right-0 z-10 mt-2 w-80 space-y-3 rounded-lg border border-slate-700 bg-slate-950 p-3 text-left"
        >
          {detail === null ? (
            <p className="text-slate-400">No health document read yet.</p>
          ) : (
            <>
              <div className="space-y-1">
                <p className="font-mono uppercase tracking-wide text-slate-500">engine</p>
                <ul className="space-y-0.5 font-mono">
                  {detail.engine.map((module) => (
                    <li key={module.name} className={module.loaded ? 'text-slate-300' : 'text-rose-300'}>
                      {module.name} · {module.loaded ? 'loaded' : 'not loaded'}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-1">
                <p className="font-mono uppercase tracking-wide text-slate-500">binaries</p>
                <ul data-testid="service-health-binaries" className="space-y-0.5 font-mono">
                  {detail.binaries.map((binary) => (
                    <li
                      key={binary.name}
                      className={binary.resolved ? 'text-slate-300' : 'text-rose-300'}
                    >
                      {binary.name} · {binary.envVar} · {binary.resolved ? 'resolved' : 'missing'}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-1">
                <p className="font-mono uppercase tracking-wide text-slate-500">capabilities</p>
                <ul data-testid="service-health-capabilities" className="space-y-0.5 font-mono">
                  {Object.entries(detail.capabilities).map(([capability, enabled]) => (
                    <li key={capability} className={enabled ? 'text-slate-300' : 'text-amber-300'}>
                      {capability} · {enabled ? 'on' : 'off'}
                    </li>
                  ))}
                </ul>
              </div>

              <p className="font-mono text-slate-500">
                jobs · {detail.jobs.running} running · {detail.jobs.queued} queued
              </p>
            </>
          )}
        </div>
      </details>
    </div>
  );
}
