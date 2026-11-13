import { dedupeHealthCategoryKeys } from '../../api/health-categories';
import type { ServiceHealth } from '../../api/render-api-types';
import type { TranslateFn } from '../../i18n/language-context';

export type ServiceHealthState = 'ok' | 'degraded' | 'unreachable' | 'loading';

export const DOT_CLASS_BY_STATE: Readonly<Record<ServiceHealthState, string>> = {
  ok: 'bg-[var(--tucu-state-green-ink)]',
  degraded: 'bg-[var(--tucu-state-orange-ink)]',
  unreachable: 'bg-[var(--tucu-state-red-ink)]',
  loading: 'bg-[var(--tucu-state-neutral-ink)]',
};

export function resolveServiceHealthState(
  status: 'loading' | 'ready' | 'error',
  data: ServiceHealth | null,
): ServiceHealthState {
  if (status === 'loading') {
    return 'loading';
  }
  if (status === 'error') {
    return 'unreachable';
  }
  const reported = data?.status;
  return reported === 'ok' || reported === 'degraded' ? reported : 'unreachable';
}

function missingParts(health: ServiceHealth): string[] {
  return [
    ...health.engine.filter((module) => !module.loaded).map((module) => module.name),
    ...health.binaries.filter((binary) => !binary.resolved).map((binary) => binary.name),
  ];
}

export function serviceHealthLabel(
  state: ServiceHealthState,
  data: ServiceHealth | null,
  errorCode: string | null,
  t: TranslateFn,
): string {
  if (state === 'loading') {
    return t('health.checking');
  }
  if (state === 'unreachable') {
    return t('health.unreachable', { code: errorCode ?? 'UNKNOWN' });
  }
  if (state === 'degraded' && data !== null) {
    const categories = dedupeHealthCategoryKeys(missingParts(data));
    return t('health.degraded', { parts: categories.map((key) => t(key)).join(', ') });
  }
  return t('health.ok');
}
