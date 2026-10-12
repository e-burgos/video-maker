import { describe, expect, it } from 'vitest';

import { isSampleVideoName, parseSampleInput, sampleOutputName } from './sample-job-params';

describe('parseSampleInput', () => {
  it('keeps no sample when the field is absent', () => {
    expect(parseSampleInput(undefined)).toBeUndefined();
  });

  it.each([8, 10, 12.5, 20])('accepts %s seconds', (seconds) => {
    expect(parseSampleInput({ seconds, extra: true })).toEqual({ seconds });
  });

  it.each([[{ seconds: 7.9 }], [{ seconds: 21 }], [{ seconds: '10' }], [{}], [10], [null], [{ seconds: Number.NaN }]])(
    'rejects %j with INVALID_INPUT on sample',
    (value) => {
      expect(() => parseSampleInput(value)).toThrow(expect.objectContaining({ code: 'INVALID_INPUT', resource: 'sample' }));
    },
  );
});

describe('sample file names', () => {
  it('derives the sample file from the video name', () => {
    expect(sampleOutputName('video.mp4')).toBe('video.sample.mp4');
    expect(sampleOutputName('promo')).toBe('promo.sample.mp4');
  });

  it('recognizes only the .sample.mp4 suffix', () => {
    expect(isSampleVideoName('video.sample.mp4')).toBe(true);
    expect(isSampleVideoName('video.mp4')).toBe(false);
    expect(isSampleVideoName('sample.mp4')).toBe(false);
  });
});
