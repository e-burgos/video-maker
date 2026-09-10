import { describe, expect, it } from 'vitest';

import { STORYBOARD_STAGES } from './render-job';
import { startStoryboardJobStage, storyboardStagePercent } from './storyboard-job-progress';

describe('storyboardStagePercent', () => {
  it('crece con la etapa y termina en 100', () => {
    const percents = STORYBOARD_STAGES.map(storyboardStagePercent);

    expect(percents).toEqual([33, 66, 100]);
  });
});

describe('startStoryboardJobStage', () => {
  it('arranca en la primera etapa desde null', () => {
    expect(startStoryboardJobStage(null, 'collect')).toEqual({ stage: 'collect', percent: 33 });
  });

  it('avanza a la etapa siguiente', () => {
    const collect = startStoryboardJobStage(null, 'collect');

    expect(startStoryboardJobStage(collect, 'propose')).toEqual({ stage: 'propose', percent: 66 });
  });

  it('es monotónico: no retrocede a una etapa anterior ni repite la actual', () => {
    const propose = startStoryboardJobStage(startStoryboardJobStage(null, 'collect'), 'propose');

    expect(startStoryboardJobStage(propose, 'collect')).toBe(propose);
    expect(startStoryboardJobStage(propose, 'propose')).toBe(propose);
  });
});
