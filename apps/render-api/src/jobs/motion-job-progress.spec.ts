import { describe, expect, it } from 'vitest';

import { completeMotionJobProgress, mergeMotionVoiceProgress, startMotionJobStage } from './motion-job-progress';

describe('motion job progress', () => {
  it('starts a stage with null line counters and a stage-based percent', () => {
    expect(startMotionJobStage(null, 'storyboard')).toEqual({
      stage: 'storyboard',
      linesVoiced: null,
      totalLines: null,
      percent: 0,
    });
    expect(startMotionJobStage(null, 'plan').percent).toBe(40);
  });

  it('never moves backwards to an earlier stage', () => {
    const rendering = startMotionJobStage(null, 'render');
    expect(startMotionJobStage(rendering, 'voice')).toBe(rendering);
  });

  it('tracks voiced lines inside the voice stage', () => {
    const voice = startMotionJobStage(null, 'voice');
    expect(mergeMotionVoiceProgress(voice, 1, 4)).toEqual({ stage: 'voice', linesVoiced: 1, totalLines: 4, percent: 25 });
    expect(mergeMotionVoiceProgress(voice, 4, 4).percent).toBe(40);
  });

  it('ignores voiced lines once another stage has started', () => {
    const plan = startMotionJobStage(null, 'plan');
    expect(mergeMotionVoiceProgress(plan, 1, 4)).toBe(plan);
  });
});

describe('completeMotionJobProgress', () => {
  it('reaches 100 percent at the stage where the job finished', () => {
    expect(completeMotionJobProgress({ stage: 'render', linesVoiced: null, totalLines: null, percent: 80 })).toEqual({ stage: 'render', linesVoiced: null, totalLines: null, percent: 100 });
    expect(completeMotionJobProgress(null)).toBeNull();
  });
});
