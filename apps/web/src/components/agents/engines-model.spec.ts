import { describe, expect, it } from 'vitest';

import type { ServiceHealth } from '../../api/render-api-types';
import { engineStatuses, studioPort } from './engines-model';

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

describe('studioPort', () => {
  it('uses the explicit port', () => {
    expect(studioPort({ port: '4200', protocol: 'http:' })).toBe('4200');
  });

  it('falls back to the protocol default', () => {
    expect(studioPort({ port: '', protocol: 'https:' })).toBe('443');
    expect(studioPort({ port: '', protocol: 'http:' })).toBe('80');
  });
});
