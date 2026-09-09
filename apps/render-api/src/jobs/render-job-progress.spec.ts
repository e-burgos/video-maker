import { describe, expect, it } from 'vitest';

import type { RenderJobProgress } from './render-job';
import { mergeRenderProgress, progressPercent, startRenderJobStage } from './render-job-progress';

describe('progressPercent', () => {
  it.each([
    { renderedFrames: 129, totalFrames: 538, expected: 23 },
    { renderedFrames: 600, totalFrames: 538, expected: 100 },
    { renderedFrames: -10, totalFrames: 538, expected: 0 },
    { renderedFrames: 200, totalFrames: 0, expected: null },
    { renderedFrames: 200, totalFrames: -1, expected: null },
  ])(
    'floors the percent and clamps it to 0..100, answering null for a non-positive total ($renderedFrames/$totalFrames)',
    ({ renderedFrames, totalFrames, expected }) => {
      expect(progressPercent(renderedFrames, totalFrames)).toBe(expected);
    },
  );
});

describe('startRenderJobStage', () => {
  it('drops the frame counters when a new stage starts', () => {
    const previous: RenderJobProgress = { stage: 'render', renderedFrames: 129, totalFrames: 538, percent: 23 };

    expect(startRenderJobStage(previous, 'mix')).toEqual({
      stage: 'mix',
      renderedFrames: null,
      totalFrames: null,
      percent: null,
    });
  });

  it('starts the first stage the same way when there is no previous progress', () => {
    expect(startRenderJobStage(null, 'prepare')).toEqual({
      stage: 'prepare',
      renderedFrames: null,
      totalFrames: null,
      percent: null,
    });
  });
});

describe('mergeRenderProgress', () => {
  it('keeps the highest renderedFrames seen and ignores a lower one', () => {
    const started: RenderJobProgress = { stage: 'render', renderedFrames: null, totalFrames: null, percent: null };

    const afterFirst = mergeRenderProgress(started, 120, 538);
    expect(afterFirst).toEqual({ stage: 'render', renderedFrames: 120, totalFrames: 538, percent: 22 });

    const afterRegression = mergeRenderProgress(afterFirst, 119, 538);
    expect(afterRegression).toBe(afterFirst);

    const afterAdvance = mergeRenderProgress(afterRegression, 538, 538);
    expect(afterAdvance).toEqual({ stage: 'render', renderedFrames: 538, totalFrames: 538, percent: 100 });
  });

  it('ignores progress reported outside the render stage', () => {
    const previous: RenderJobProgress = { stage: 'mix', renderedFrames: null, totalFrames: null, percent: null };

    expect(mergeRenderProgress(previous, 300, 538)).toBe(previous);
  });

  it('starts tracking frames on the first sample of a render stage that has none yet', () => {
    const previous: RenderJobProgress = { stage: 'render', renderedFrames: null, totalFrames: null, percent: null };

    expect(mergeRenderProgress(previous, 0, 538)).toEqual({
      stage: 'render',
      renderedFrames: 0,
      totalFrames: 538,
      percent: 0,
    });
  });

  it('builds a fresh render progress when there is no previous progress at all', () => {
    expect(mergeRenderProgress(null, 42, 538)).toEqual({
      stage: 'render',
      renderedFrames: 42,
      totalFrames: 538,
      percent: 7,
    });
  });
});
