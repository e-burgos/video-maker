import { describe, expect, it } from 'vitest';

import type { ServiceHealth } from '../../api/render-api-types';
import { engineStatuses, apiBaseUrl } from './engines-model';

function healthWith(producerEngines: { claudeCli: boolean; openrouter: boolean } | undefined): ServiceHealth {
  return {
    status: 'ok',
    service: 'render-api',
    cycle: 1,
    time: '',
    engine: [],
    binaries: [],
    capabilities: {
      renderPipeline: true,
      assetStore: true,
      jobQueue: true,
      montageQueue: true,
      storyboardQueue: true,
      voiceQueue: true,
      producer: true,
      producerEngines,
    },
    jobs: { running: 0, queued: 0 },
  };
}

describe('engineStatuses', () => {
  it('maps each engine flag to ready or missing', () => {
    expect(engineStatuses(healthWith({ claudeCli: true, openrouter: false }))).toEqual([
      { id: 'claudeCli', state: 'ready' },
      { id: 'openrouter', state: 'missing' },
    ]);
  });

  it('reports unknown when the service does not expose the engines', () => {
    expect(engineStatuses(healthWith(undefined)).map((engine) => engine.state)).toEqual(['unknown', 'unknown']);
  });
});

describe('apiBaseUrl', () => {
  it('joins the studio origin with the API base path the client uses', () => {
    expect(apiBaseUrl({ origin: 'http://127.0.0.1:4200' })).toBe('http://127.0.0.1:4200/api');
  });
});
