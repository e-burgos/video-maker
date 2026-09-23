import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PHOTO_AROLL_FPS,
  parsePhotoArollFps,
  parsePhotoArollJobInput,
  parsePhotoArollOutput,
  parsePhotoArollPhotos,
} from './photo-aroll-job-params';

function captureError(run: () => unknown): unknown {
  try {
    run();
    return null;
  } catch (error) {
    return error;
  }
}

describe('parsePhotoArollPhotos', () => {
  it('passes through a non-empty array of strings', () => {
    expect(parsePhotoArollPhotos(['raw/images/1.jpg', 'raw/images/2.jpg'])).toEqual([
      'raw/images/1.jpg',
      'raw/images/2.jpg',
    ]);
  });

  it('rejects a missing value', () => {
    const error = captureError(() => parsePhotoArollPhotos(undefined));
    expect(error).toMatchObject({ code: 'PHOTO_AROLL_INPUT_INVALID', resource: 'photos' });
  });

  it('rejects an empty array', () => {
    expect(captureError(() => parsePhotoArollPhotos([]))).toMatchObject({ code: 'PHOTO_AROLL_INPUT_INVALID' });
  });

  it('rejects an array with a blank entry', () => {
    expect(captureError(() => parsePhotoArollPhotos(['raw/images/1.jpg', '  ']))).toMatchObject({
      code: 'PHOTO_AROLL_INPUT_INVALID',
    });
  });

  it('rejects an array with a non-string entry', () => {
    expect(captureError(() => parsePhotoArollPhotos(['raw/images/1.jpg', 42]))).toMatchObject({
      code: 'PHOTO_AROLL_INPUT_INVALID',
    });
  });

  it('rejects a plain string', () => {
    expect(captureError(() => parsePhotoArollPhotos('raw/images/1.jpg'))).toMatchObject({
      code: 'PHOTO_AROLL_INPUT_INVALID',
    });
  });
});

describe('parsePhotoArollOutput', () => {
  it('passes through a portable file name', () => {
    expect(parsePhotoArollOutput('product-ad.mp4')).toBe('product-ad.mp4');
  });

  it('rejects a missing value', () => {
    expect(captureError(() => parsePhotoArollOutput(undefined))).toMatchObject({
      code: 'PHOTO_AROLL_INPUT_INVALID',
      resource: 'output',
    });
  });

  it('rejects a path with a directory segment', () => {
    expect(captureError(() => parsePhotoArollOutput('raw/aroll/product-ad.mp4'))).toMatchObject({
      code: 'PHOTO_AROLL_INPUT_INVALID',
    });
  });

  it('rejects an absolute path', () => {
    expect(captureError(() => parsePhotoArollOutput('/etc/passwd'))).toMatchObject({
      code: 'PHOTO_AROLL_INPUT_INVALID',
    });
  });
});

describe('parsePhotoArollFps', () => {
  it('defaults to 30 when absent', () => {
    expect(parsePhotoArollFps(undefined)).toBe(DEFAULT_PHOTO_AROLL_FPS);
  });

  it('accepts exactly 30', () => {
    expect(parsePhotoArollFps(30)).toBe(30);
  });

  it('rejects any other fps', () => {
    expect(captureError(() => parsePhotoArollFps(24))).toMatchObject({
      code: 'PHOTO_AROLL_INPUT_INVALID',
      resource: 'fps',
    });
  });
});

describe('parsePhotoArollJobInput', () => {
  it('combines the three fields', () => {
    expect(
      parsePhotoArollJobInput({ photos: ['raw/images/1.jpg'], output: 'ad.mp4', fps: 30 }),
    ).toEqual({ photos: ['raw/images/1.jpg'], output: 'ad.mp4', fps: 30 });
  });

  it('applies the fps default when absent', () => {
    expect(parsePhotoArollJobInput({ photos: ['raw/images/1.jpg'], output: 'ad.mp4' }).fps).toBe(
      DEFAULT_PHOTO_AROLL_FPS,
    );
  });
});
