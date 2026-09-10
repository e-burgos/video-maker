import { describe, expect, it } from 'vitest';

import { startAssembleJobStage } from './assemble-job-progress';

describe('startAssembleJobStage', () => {
  it('advances through the three stages with a growing percent', () => {
    const collect = startAssembleJobStage(null, 'collect');
    const build = startAssembleJobStage(collect, 'build');
    const persist = startAssembleJobStage(build, 'persist');

    expect(collect).toEqual({ stage: 'collect', percent: 33 });
    expect(build).toEqual({ stage: 'build', percent: 66 });
    expect(persist).toEqual({ stage: 'persist', percent: 100 });
  });

  it('never goes back to an earlier stage', () => {
    const persist = startAssembleJobStage(null, 'persist');

    expect(startAssembleJobStage(persist, 'collect')).toBe(persist);
    expect(startAssembleJobStage(persist, 'persist')).toBe(persist);
  });
});
