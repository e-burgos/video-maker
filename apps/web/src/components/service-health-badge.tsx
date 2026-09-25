import { useCallback } from 'react';

import { dedupeHealthCategoryKeys } from '../api/health-categories';
import { useRenderApi } from '../api/render-api-context';
import { useAsyncResource } from '../hooks/use-async-resource';
import { useT } from '../i18n/language-context';
import type { TranslateFn } from '../i18n/language-context';
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

function healthLabel(
  state: string,
  health: { data: ServiceHealth | null; error: { code: string } | null },
  t: TranslateFn,
): string {
  if (state === 'loading') {
    return t('health.checking');
  }
  if (state === 'unreachable') {
    return t('health.unreachable', { code: health.error?.code ?? 'UNKNOWN' });
  }
  if (state === 'degraded') {
    const categories = dedupeHealthCategoryKeys(missingParts(health.data as ServiceHealth));
    return t('health.degraded', {
      parts: categories.map((key) => t(key)).join(', '),
    });
  }
  return t('health.ok');
}

export function ServiceHealthBadge() {
  const client = useRenderApi();
  const load = useCallback(() => client.getHealth(), [client]);
  const health = useAsyncResource(load, 'health');
  const t = useT();

  const state =
    health.status === 'loading' ? 'loading' : health.status === 'error' ? 'unreachable' : (health.data?.status ?? 'unreachable');

  const label = healthLabel(state, health, t);

  const detail = health.data;

  return (
    <div className="relative flex items-center gap-2">
      <button
        type="button"
        onClick={health.reload}
        title={t('health.recheck')}
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
          {t('health.details')}
        </summary>
        <div
          data-testid="service-health-details"
          className="absolute right-0 z-10 mt-2 w-80 space-y-3 rounded-lg border border-slate-700 bg-slate-950 p-3 text-left"
        >
          {detail === null ? (
            <p className="text-slate-400">{t('health.empty')}</p>
          ) : (
            <>
              <div className="space-y-1">
                <p className="font-mono uppercase tracking-wide text-slate-500">{t('health.engine')}</p>
                <ul className="space-y-0.5 font-mono">
                  {detail.engine.map((module) => (
                    <li key={module.name} className={module.loaded ? 'text-slate-300' : 'text-rose-300'}>
                      {module.name} · {module.loaded ? t('health.loaded') : t('health.notLoaded')}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-1">
                <p className="font-mono uppercase tracking-wide text-slate-500">
                  {t('health.binaries')}
                </p>
                <ul data-testid="service-health-binaries" className="space-y-0.5 font-mono">
                  {detail.binaries.map((binary) => (
                    <li
                      key={binary.name}
                      className={binary.resolved ? 'text-slate-300' : 'text-rose-300'}
                    >
                      {binary.name} · {binary.envVar} ·{' '}
                      {binary.resolved ? t('health.resolved') : t('health.missing')}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-1">
                <p className="font-mono uppercase tracking-wide text-slate-500">
                  {t('health.capabilities')}
                </p>
                <ul data-testid="service-health-capabilities" className="space-y-0.5 font-mono">
                  {Object.entries(detail.capabilities).map(([capability, enabled]) => (
                    <li key={capability} className={enabled ? 'text-slate-300' : 'text-amber-300'}>
                      {capability} · {enabled ? t('health.on') : t('health.off')}
                    </li>
                  ))}
                </ul>
              </div>

              <p className="font-mono text-slate-500">
                {t('health.jobs', { running: detail.jobs.running, queued: detail.jobs.queued })}
              </p>
            </>
          )}
        </div>
      </details>
    </div>
  );
}
