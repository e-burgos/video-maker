import { describe, expect, it } from 'vitest';

import { parseReviewFile, parseReviewJobInput, reviewFileFor } from './review-job-params';
import { completeReviewJobProgress, startReviewJobStage } from './review-job-progress';

describe('parseReviewJobInput', () => {
  it('accepts an mp4 directly under out/', () => {
    expect(parseReviewJobInput({ file: 'out/video.mp4' })).toEqual({ file: 'out/video.mp4' });
  });

  it('rejects other folders, subfolders, extensions and non-strings with REVIEW_FILE_INVALID', () => {
    for (const file of ['raw/a.mp4', 'out/sub/a.mp4', 'out/a.mov', '../out/a.mp4', 'out/..\\a.mp4', 'out/a.review.json', 5, undefined]) {
      expect(() => parseReviewFile(file)).toThrowError(expect.objectContaining({ code: 'REVIEW_FILE_INVALID' }));
    }
  });
});

describe('reviewFileFor', () => {
  it('swaps the mp4 extension for .review.json', () => {
    expect(reviewFileFor('out/video 1.mp4')).toBe('out/video 1.review.json');
  });
});

describe('review job progress', () => {
  it('only moves forward through the stages and completes at 100', () => {
    const collect = startReviewJobStage(null, 'collect');
    const rules = startReviewJobStage(collect, 'rules');

    expect(collect).toEqual({ stage: 'collect', percent: 0 });
    expect(rules).toEqual({ stage: 'rules', percent: 50 });
    expect(startReviewJobStage(rules, 'measure')).toBe(rules);
    expect(completeReviewJobProgress(rules)).toEqual({ stage: 'rules', percent: 100 });
    expect(completeReviewJobProgress(null)).toBeNull();
  });
});
