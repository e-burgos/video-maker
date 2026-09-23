import { describe, expect, it } from 'vitest';

import type { PhotoArollJobProgress } from './render-job';
import {
  mergePhotoArollJobProgress,
  photoArollProgressPercent,
  startPhotoArollJobStage,
} from './photo-aroll-job-progress';

describe('photoArollProgressPercent', () => {
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
      expect(photoArollProgressPercent(processed, total)).toBe(expected);
    },
  );
});

describe('startPhotoArollJobStage', () => {
  it('drops the clip counters when a later stage starts', () => {
    const previous: PhotoArollJobProgress = { stage: 'clips', processedClips: 3, totalClips: 7, percent: 42 };

    expect(startPhotoArollJobStage(previous, 'concat')).toEqual({
      stage: 'concat',
      processedClips: null,
      totalClips: null,
      percent: null,
    });
  });

  it('starts the first stage the same way when there is no previous progress', () => {
    expect(startPhotoArollJobStage(null, 'clips')).toEqual({
      stage: 'clips',
      processedClips: null,
      totalClips: null,
      percent: null,
    });
  });

  it('never regresses to an earlier stage', () => {
    const previous: PhotoArollJobProgress = { stage: 'mux', processedClips: 4, totalClips: 9, percent: 44 };

    expect(startPhotoArollJobStage(previous, 'clips')).toBe(previous);
  });

  it('is a no-op when the reported stage is already the current one', () => {
    const previous: PhotoArollJobProgress = { stage: 'clips', processedClips: 2, totalClips: 7, percent: 28 };

    expect(startPhotoArollJobStage(previous, 'clips')).toBe(previous);
  });
});

describe('mergePhotoArollJobProgress', () => {
  it('increments processedClips and recomputes percent against the given total', () => {
    const started: PhotoArollJobProgress = { stage: 'clips', processedClips: null, totalClips: null, percent: null };

    const afterFirst = mergePhotoArollJobProgress(started, 7);
    expect(afterFirst).toEqual({ stage: 'clips', processedClips: 1, totalClips: 7, percent: 14 });

    const afterSecond = mergePhotoArollJobProgress(afterFirst, 7);
    expect(afterSecond).toEqual({ stage: 'clips', processedClips: 2, totalClips: 7, percent: 28 });
  });

  it('builds a fresh progress when there is no previous progress at all', () => {
    expect(mergePhotoArollJobProgress(null, 4)).toEqual({
      stage: 'clips',
      processedClips: 1,
      totalClips: 4,
      percent: 25,
    });
  });

  it('ignores a clip processed once the concat or mux stage has started', () => {
    const previous: PhotoArollJobProgress = { stage: 'concat', processedClips: null, totalClips: null, percent: null };

    expect(mergePhotoArollJobProgress(previous, 7)).toBe(previous);
  });

  it('never decreases the processed count across sequential merges', () => {
    const started: PhotoArollJobProgress = { stage: 'clips', processedClips: null, totalClips: null, percent: null };

    const afterFirst = mergePhotoArollJobProgress(started, 9);
    const afterSecond = mergePhotoArollJobProgress(afterFirst, 9);
    const afterThird = mergePhotoArollJobProgress(afterSecond, 9);

    expect(afterFirst.processedClips).toBe(1);
    expect(afterSecond.processedClips).toBe(2);
    expect(afterThird.processedClips).toBe(3);
  });
});
