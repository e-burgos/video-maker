import { describe, expect, it } from 'vitest';

import type { ServiceHealth } from '../../api/render-api-types';
import { buildRequirements, countMissing, itemsInGroup } from './requirements-model';

const BINARY_NAMES = ['ffmpeg', 'ffprobe', 'whisperCli', 'whisperModel', 'ttsCli', 'ttsVoicesDir'];

function healthWith(options: {
  missingBinaries?: readonly string[];
  unloadedModules?: readonly string[];
  claudeCli?: boolean;
  openrouter?: boolean;
  legacyProducer?: boolean;
}): ServiceHealth {
  const missing = options.missingBinaries ?? [];
  const unloaded = options.unloadedModules ?? [];
  return {
    status: 'ok',
    service: 'render-api',
    cycle: 3,
    time: '2026-11-13T00:00:00.000Z',
    engine: ['media-local', 'composition-remotion/render'].map((name) => ({ name, loaded: !unloaded.includes(name) })),
    binaries: BINARY_NAMES.map((name) => ({ name, envVar: `${name.toUpperCase()}_PATH`, resolved: !missing.includes(name) })),
    capabilities: {
      renderPipeline: true,
      assetStore: true,
      jobQueue: true,
      montageQueue: true,
      storyboardQueue: true,
      voiceQueue: true,
      producer: options.legacyProducer ?? false,
      ...(options.legacyProducer === undefined
        ? { producerEngines: { claudeCli: options.claudeCli ?? false, openrouter: options.openrouter ?? false } }
        : {}),
    },
    jobs: { running: 0, queued: 0 },
  };
}

function stateById(health: ServiceHealth) {
  return Object.fromEntries(buildRequirements(health).map((item) => [item.id, item.state]));
}

describe('buildRequirements', () => {
  it('reports every requirement with a state, binaries with their env var', () => {
    const items = buildRequirements(healthWith({ claudeCli: true }));

    expect(items).toHaveLength(10);
    expect(items.find((item) => item.id === 'ffmpeg')).toEqual({ id: 'ffmpeg', group: 'media', state: 'ok', envVar: 'FFMPEG_PATH' });
    expect(countMissing(items)).toBe(0);
  });

  it('marks unresolved binaries and unloaded modules as missing', () => {
    const states = stateById(healthWith({ missingBinaries: ['whisperModel'], unloadedModules: ['media-local'], claudeCli: true }));

    expect(states['whisperModel']).toBe('missing');
    expect(states['media-local']).toBe('missing');
    expect(states['ffmpeg']).toBe('ok');
  });

  it('treats the second producer engine as optional when one is available', () => {
    const states = stateById(healthWith({ claudeCli: true }));

    expect(states['claudeCli']).toBe('ok');
    expect(states['openrouter']).toBe('optional');
  });

  it('marks both producer engines missing when neither is available', () => {
    const items = buildRequirements(healthWith({}));

    expect(itemsInGroup(items, 'producer').map((item) => item.state)).toEqual(['missing', 'missing']);
    expect(countMissing(items)).toBe(2);
  });

  it('falls back to the producer capability when the engines are not reported', () => {
    const states = stateById(healthWith({ legacyProducer: true }));

    expect(states['claudeCli']).toBe('ok');
    expect(states['openrouter']).toBe('optional');
  });

  it('groups engines, media tools and producer engines', () => {
    const items = buildRequirements(healthWith({ claudeCli: true }));

    expect(itemsInGroup(items, 'engine')).toHaveLength(2);
    expect(itemsInGroup(items, 'media')).toHaveLength(6);
    expect(itemsInGroup(items, 'producer')).toHaveLength(2);
  });
});
