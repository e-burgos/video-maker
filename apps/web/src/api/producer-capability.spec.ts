import { describe, expect, it } from 'vitest';

import { canTalkToProducer, producerBlockers, producerFailureExplanation } from './producer-capability';
import type { ServiceHealth } from './render-api-types';

function health(producer: boolean): ServiceHealth {
  return {
    status: 'ok',
    service: 'render-api',
    cycle: 3,
    time: '2026-09-10T00:00:00.000Z',
    engine: [{ name: 'media-local', loaded: true }],
    binaries: [{ name: 'ffmpeg', envVar: 'FFMPEG_PATH', resolved: false }],
    capabilities: {
      renderPipeline: true,
      assetStore: true,
      jobQueue: true,
      montageQueue: true,
      storyboardQueue: true,
      voiceQueue: true,
      producer,
    },
    jobs: { running: 0, queued: 0 },
  };
}

describe('producerBlockers', () => {
  it('blocks with a written reason when the health is unknown', () => {
    expect(producerBlockers(null)).toEqual([
      'The render service health is unknown, so the producer cannot be reached.',
    ]);
  });

  it('blocks when the service does not expose the producer capability', () => {
    expect(producerBlockers(health(false))).toHaveLength(1);
    expect(canTalkToProducer(health(false))).toBe(false);
  });

  it('does not look at the media binaries: the producer runs its own tools', () => {
    expect(producerBlockers(health(true))).toEqual([]);
    expect(canTalkToProducer(health(true))).toBe(true);
  });
});

describe('producerFailureExplanation', () => {
  it.each([
    'PRODUCER_UNAVAILABLE',
    'PRODUCER_RATE_LIMITED',
    'PRODUCER_TURN_FAILED',
    'PRODUCER_TURN_ACTIVE',
    'PRODUCER_TURN_NOT_FOUND',
    'PRODUCER_TURN_NOT_CANCELABLE',
    'PRODUCER_MESSAGE_INVALID',
    'PRODUCER_STATE_INVALID',
  ])('explains %s in the language of the user', (code) => {
    const explanation = producerFailureExplanation(code);

    expect(explanation).not.toBeNull();
    expect(explanation).not.toContain(code);
  });

  it('says that the conversation survives a quota failure', () => {
    expect(producerFailureExplanation('PRODUCER_RATE_LIMITED')).toContain('conversation is saved');
  });

  it('returns null for a code it does not own', () => {
    expect(producerFailureExplanation('TIMELINE_NOT_FOUND')).toBeNull();
  });
});
