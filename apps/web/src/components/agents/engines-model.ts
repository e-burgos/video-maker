import type { ServiceHealth } from '../../api/render-api-types';
import type { TranslationKey } from '../../i18n/messages-en';

export const PRODUCER_ENGINES = ['claudeCli', 'openrouter'] as const;

export type ProducerEngineId = (typeof PRODUCER_ENGINES)[number];

export type EngineState = 'ready' | 'missing' | 'unknown';

export type EngineStatus = {
  id: ProducerEngineId;
  state: EngineState;
};

export const ENGINE_LABEL: Readonly<Record<ProducerEngineId, TranslationKey>> = {
  claudeCli: 'agents.engine.claudeCli',
  openrouter: 'agents.engine.openrouter',
};

export const ENGINE_STATE_LABEL: Readonly<Record<EngineState, TranslationKey>> = {
  ready: 'agents.engine.ready',
  missing: 'agents.engine.missing',
  unknown: 'agents.engine.unknown',
};

export const ENGINE_STATE_TONE = { ready: 'green', missing: 'orange', unknown: 'neutral' } as const;

export function engineStatuses(health: ServiceHealth): EngineStatus[] {
  const engines = health.capabilities.producerEngines;
  return PRODUCER_ENGINES.map((id) => {
    if (engines === undefined) {
      return { id, state: 'unknown' };
    }
    return { id, state: engines[id] ? 'ready' : 'missing' };
  });
}

export function studioPort(location: Pick<Location, 'port' | 'protocol'>): string {
  if (location.port !== '') {
    return location.port;
  }
  return location.protocol === 'https:' ? '443' : '80';
}
