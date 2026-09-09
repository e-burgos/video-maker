import { describe, expect, it } from 'vitest';

import type { MontageJobProgress } from './render-job';
import { mergeMontageJobProgress, montageProgressPercent, startMontageJobStage } from './montage-job-progress';

describe('montageProgressPercent', () => {
  it.each([
    { processed: 3, total: 7, expected: 42 },
    { processed: 5, total: 5, expected: 100 },
    { processed: 9, total: 5, expected: 100 },
    { processed: -1, total: 5, expected: 0 },
    { processed: 2, total: 0, expected: null },
    { processed: 2, total: -1, expected: null },
  ])(
    'floors the percent and clamps it to 0..100, answering null for a non-positive total ($processed/$total)',
    ({ processed, total, expected }) => {
      expect(montageProgressPercent(processed, total)).toBe(expected);
    },
  );
});

describe('startMontageJobStage', () => {
  it('drops the asset counters when a later stage starts', () => {
    const previous: MontageJobProgress = { stage: 'probe', processedAssets: 3, totalAssets: 7, percent: 42 };

    expect(startMontageJobStage(previous, 'transcribe')).toEqual({
      stage: 'transcribe',
      processedAssets: null,
      totalAssets: null,
      percent: null,
    });
  });

  it('starts the first stage the same way when there is no previous progress', () => {
    expect(startMontageJobStage(null, 'discover')).toEqual({
      stage: 'discover',
      processedAssets: null,
      totalAssets: null,
      percent: null,
    });
  });

  it('allows skipping a stage, moving directly from discover to transcribe when probe never ran', () => {
    const previous: MontageJobProgress = { stage: 'discover', processedAssets: null, totalAssets: null, percent: null };

    expect(startMontageJobStage(previous, 'transcribe')).toEqual({
      stage: 'transcribe',
      processedAssets: null,
      totalAssets: null,
      percent: null,
    });
  });

  it('never regresses to an earlier stage', () => {
    const previous: MontageJobProgress = { stage: 'transcribe', processedAssets: 4, totalAssets: 9, percent: 44 };

    expect(startMontageJobStage(previous, 'probe')).toBe(previous);
  });

  it('is a no-op when the reported stage is already the current one', () => {
    const previous: MontageJobProgress = { stage: 'probe', processedAssets: 2, totalAssets: 7, percent: 28 };

    expect(startMontageJobStage(previous, 'probe')).toBe(previous);
  });

  it('discover and plan always carry null counters, never a count', () => {
    expect(startMontageJobStage(null, 'discover')).toEqual({
      stage: 'discover',
      processedAssets: null,
      totalAssets: null,
      percent: null,
    });
    expect(startMontageJobStage(null, 'plan')).toEqual({
      stage: 'plan',
      processedAssets: null,
      totalAssets: null,
      percent: null,
    });
  });
});

describe('mergeMontageJobProgress', () => {
  it('increments processedAssets and recomputes percent against the given total', () => {
    const started: MontageJobProgress = { stage: 'probe', processedAssets: null, totalAssets: null, percent: null };

    const afterFirst = mergeMontageJobProgress(started, 'probe', 7);
    expect(afterFirst).toEqual({ stage: 'probe', processedAssets: 1, totalAssets: 7, percent: 14 });

    const afterSecond = mergeMontageJobProgress(afterFirst, 'probe', 7);
    expect(afterSecond).toEqual({ stage: 'probe', processedAssets: 2, totalAssets: 7, percent: 28 });
  });

  it('builds a fresh progress when there is no previous progress at all', () => {
    expect(mergeMontageJobProgress(null, 'transcribe', 4)).toEqual({
      stage: 'transcribe',
      processedAssets: 1,
      totalAssets: 4,
      percent: 25,
    });
  });

  it('ignores an asset processed for a stage other than the current one', () => {
    const previous: MontageJobProgress = { stage: 'discover', processedAssets: null, totalAssets: null, percent: null };

    expect(mergeMontageJobProgress(previous, 'probe', 7)).toBe(previous);
  });

  it('never decreases the processed count across sequential merges of the same stage', () => {
    const started: MontageJobProgress = { stage: 'transcribe', processedAssets: null, totalAssets: null, percent: null };

    const afterFirst = mergeMontageJobProgress(started, 'transcribe', 9);
    const afterSecond = mergeMontageJobProgress(afterFirst, 'transcribe', 9);
    const afterThird = mergeMontageJobProgress(afterSecond, 'transcribe', 9);

    expect(afterFirst.processedAssets).toBe(1);
    expect(afterSecond.processedAssets).toBe(2);
    expect(afterThird.processedAssets).toBe(3);
  });
});
