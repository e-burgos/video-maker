import type { ServiceHealth } from './render-api-types';

export function storyboardBlockers(health: ServiceHealth | null): string[] {
  if (health === null) {
    return ['The render service health is unknown, so no storyboard can be proposed.'];
  }

  if (!health.capabilities.storyboardQueue) {
    return [
      'The render service does not expose a storyboard queue, so it cannot reach the local AI agent.',
    ];
  }

  return [];
}

export function canProposeStoryboard(health: ServiceHealth | null): boolean {
  return storyboardBlockers(health).length === 0;
}

const AGENT_FAILURE_EXPLANATIONS: Readonly<Record<string, string>> = {
  AI_AGENT_UNAVAILABLE:
    'The local AI agent is not installed or not reachable on this machine. Install Claude Code and make sure the claude command runs from a terminal.',
  AI_AGENT_RATE_LIMITED:
    'Your Claude subscription hit its usage limit. Nothing was lost: wait until the quota resets and press Propose storyboard again.',
  AI_AGENT_FAILED:
    'The local AI agent stopped before answering. Try again; if it keeps failing, run the same brief from a terminal to see what the agent reports.',
  AI_AGENT_INVALID_OUTPUT:
    'The agent answered something that is not a storyboard. This is usually transient: propose it again, and shorten the brief if it repeats.',
  STORYBOARD_INPUT_INVALID:
    'Send exactly one of a brief or a script, and make sure it is not empty.',
  STORYBOARD_OVERWRITE_INVALID: 'The overwrite flag has to be a boolean.',
  STORYBOARD_NOT_FOUND: 'This project has no storyboard yet. Propose one to get started.',
  STORYBOARD_INVALID:
    'The stored storyboard does not validate against the storyboard schema, so it cannot be shown or saved.',
};

export function storyboardFailureExplanation(code: string): string | null {
  return AGENT_FAILURE_EXPLANATIONS[code] ?? null;
}
