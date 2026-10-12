import { describe, expect, it } from 'vitest';

import { parseReferenceFile, parseReferenceJobInput } from './reference-job-params';
import { completeReferenceJobProgress, startReferenceJobStage } from './reference-job-progress';

describe('parseReferenceJobInput', () => {
  it('accepts a video directly under raw/reference/', () => {
    expect(parseReferenceJobInput({ file: 'raw/reference/modelo.mp4' })).toEqual({ file: 'raw/reference/modelo.mp4' });
    expect(parseReferenceFile('raw/reference/otro.MOV')).toBe('raw/reference/otro.MOV');
  });

  it('rejects other folders, subfolders, non-video files and non-strings with REFERENCE_FILE_INVALID', () => {
    const invalid = ['raw/aroll/a.mp4', 'raw/reference/sub/a.mp4', 'raw/reference/a.wav', 'raw/reference/a.png', 'raw/reference/../a.mp4', 'out/a.mp4', 'raw/reference/', 5, undefined];
    for (const file of invalid) {
      expect(() => parseReferenceFile(file)).toThrowError(expect.objectContaining({ code: 'REFERENCE_FILE_INVALID' }));
    }
  });
});

describe('reference job progress', () => {
  it('only moves forward through the five stages and completes at 100', () => {
    const probe = startReferenceJobStage(null, 'probe');
    const keyframes = startReferenceJobStage(probe, 'keyframes');

    expect(probe).toEqual({ stage: 'probe', percent: 0 });
    expect(keyframes).toEqual({ stage: 'keyframes', percent: 60 });
    expect(startReferenceJobStage(keyframes, 'scenes')).toBe(keyframes);
    expect(completeReferenceJobProgress(keyframes)).toEqual({ stage: 'keyframes', percent: 100 });
    expect(completeReferenceJobProgress(null)).toBeNull();
  });
});
