import type { ServiceHealth } from './render-api-types';
import type { Blocker } from './blockers';
import type { TranslationKey } from '../i18n/messages-en';

export function storyboardBlockers(health: ServiceHealth | null): Blocker[] {
  if (health === null) {
    return [{ key: 'storyboard.blocker.healthUnknown' }];
  }

  if (!health.capabilities.storyboardQueue) {
    return [{ key: 'storyboard.blocker.noQueue' }];
  }

  return [];
}

export function canProposeStoryboard(health: ServiceHealth | null): boolean {
  return storyboardBlockers(health).length === 0;
}

const AGENT_FAILURE_CODES = [
  'AI_AGENT_UNAVAILABLE',
  'AI_AGENT_RATE_LIMITED',
  'AI_AGENT_FAILED',
  'AI_AGENT_INVALID_OUTPUT',
  'STORYBOARD_INPUT_INVALID',
  'STORYBOARD_OVERWRITE_INVALID',
  'STORYBOARD_NOT_FOUND',
  'STORYBOARD_INVALID',
] as const;

type AgentFailureCode = (typeof AGENT_FAILURE_CODES)[number];

function isAgentFailureCode(code: string): code is AgentFailureCode {
  return (AGENT_FAILURE_CODES as readonly string[]).includes(code);
}

export function storyboardFailureKey(code: string): TranslationKey | null {
  return isAgentFailureCode(code) ? (`storyboardFailure.${code}` as TranslationKey) : null;
}
