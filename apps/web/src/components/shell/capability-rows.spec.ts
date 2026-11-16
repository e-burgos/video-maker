import { describe, expect, it } from 'vitest';

import { capabilityRows } from './capability-rows';

describe('capabilityRows', () => {
  it('keeps flat flags in order', () => {
    expect(capabilityRows({ renderPipeline: true, jobQueue: false })).toEqual([
      { name: 'renderPipeline', enabled: true },
      { name: 'jobQueue', enabled: false },
    ]);
  });

  it('flattens nested groups into dotted names', () => {
    expect(capabilityRows({ producer: true, producerEngines: { claudeCli: true, openrouter: false } })).toEqual([
      { name: 'producer', enabled: true },
      { name: 'producerEngines.claudeCli', enabled: true },
      { name: 'producerEngines.openrouter', enabled: false },
    ]);
  });

  it('skips values that are neither flags nor groups', () => {
    expect(capabilityRows({ note: 'x', empty: null })).toEqual([]);
  });
});
