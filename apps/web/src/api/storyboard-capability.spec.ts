import { describe, expect, it } from 'vitest';

import {
  canProposeStoryboard,
  storyboardBlockers,
  storyboardFailureExplanation,
} from './storyboard-capability';
import type { ServiceHealth } from './render-api-types';

function health(storyboardQueue: boolean): ServiceHealth {
  return {
    status: 'ok',
    service: 'render-api',
    cycle: 3,
    time: '2026-09-09T12:00:00.000Z',
    engine: [],
    binaries: [],
    capabilities: {
      renderPipeline: true,
      assetStore: true,
      jobQueue: true,
      montageQueue: true,
      storyboardQueue,
      voiceQueue: true,
      producer: true,
    },
    jobs: { running: 0, queued: 0 },
  };
}

describe('storyboardBlockers', () => {
  it('blocks while the health document has not been read', () => {
    expect(storyboardBlockers(null)).toHaveLength(1);
    expect(canProposeStoryboard(null)).toBe(false);
  });

  it('blocks when the service exposes no storyboard queue', () => {
    expect(storyboardBlockers(health(false))[0]).toContain('storyboard queue');
  });

  it('does not block a service that can reach the agent', () => {
    expect(storyboardBlockers(health(true))).toEqual([]);
    expect(canProposeStoryboard(health(true))).toBe(true);
  });

  it('does not depend on the media binaries, which the agent never uses', () => {
    const withMissingBinaries: ServiceHealth = {
      ...health(true),
      status: 'degraded',
      binaries: [{ name: 'whisperCli', envVar: 'WHISPER_CPP_PATH', resolved: false }],
    };

    expect(storyboardBlockers(withMissingBinaries)).toEqual([]);
  });
});

describe('storyboardFailureExplanation', () => {
  it('explains the quota failure in the language of the user, not of the CLI', () => {
    expect(storyboardFailureExplanation('AI_AGENT_RATE_LIMITED')).toContain('usage limit');
  });

  it('explains every agent failure code the service can answer', () => {
    for (const code of [
      'AI_AGENT_UNAVAILABLE',
      'AI_AGENT_RATE_LIMITED',
      'AI_AGENT_FAILED',
      'AI_AGENT_INVALID_OUTPUT',
    ]) {
      expect(storyboardFailureExplanation(code)).not.toBeNull();
    }
  });

  it('has nothing to add for a code it does not know', () => {
    expect(storyboardFailureExplanation('PROJECT_NOT_FOUND')).toBeNull();
  });
});
