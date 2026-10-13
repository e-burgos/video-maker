import { describe, expect, it } from 'vitest';

import { parsePublishJobInput, thumbnailContentType } from './publish-job-params';

const NOW = Date.parse('2026-10-08T10:00:00.000Z');
const VALID = { platform: 'youtube', file: 'out/video.mp4', title: ' Titulo ', privacy: 'unlisted' };

describe('parsePublishJobInput', () => {
  it('applies defaults and trims the title', () => {
    expect(parsePublishJobInput(VALID, NOW)).toEqual({
      platform: 'youtube',
      file: 'out/video.mp4',
      title: 'Titulo',
      description: '',
      tags: [],
      privacy: 'unlisted',
      publishAt: null,
      playlistIds: [],
      thumbnail: null,
      categoryId: '22',
      madeForKids: false,
      defaultLanguage: null,
      ignoreReview: false,
    });
  });

  it('accepts the optional fields', () => {
    const input = parsePublishJobInput(
      {
        ...VALID,
        description: 'd',
        tags: [' a ', 'b'],
        publishAt: '2026-10-09T10:00:00Z',
        playlistId: 'PL1',
        playlistIds: ['PL2', 'PL1'],
        thumbnail: 'work/t.JPG',
        categoryId: '27',
        madeForKids: true,
        defaultLanguage: 'en',
      },
      NOW,
    );

    expect(input).toMatchObject({
      tags: ['a', 'b'],
      publishAt: '2026-10-09T10:00:00.000Z',
      playlistIds: ['PL1', 'PL2'],
      thumbnail: 'work/t.JPG',
      categoryId: '27',
      madeForKids: true,
      defaultLanguage: 'en',
    });
  });

  it('rejects files outside out/, in subfolders, or with another extension', () => {
    for (const file of ['raw/a.mp4', 'out/sub/a.mp4', 'out/a.mov', '../out/a.mp4', 'out/..\\a.mp4', 5]) {
      expect(() => parsePublishJobInput({ ...VALID, file }, NOW)).toThrowError(expect.objectContaining({ code: 'PUBLISH_FILE_INVALID' }));
    }
  });

  it('accepts a title of exactly 100 characters and tags totalling exactly 500', () => {
    expect(() => parsePublishJobInput({ ...VALID, title: 'x'.repeat(100) }, NOW)).not.toThrow();
    expect(() => parsePublishJobInput({ ...VALID, tags: ['a'.repeat(250), 'b'.repeat(250)] }, NOW)).not.toThrow();
    expect(() => parsePublishJobInput({ ...VALID, tags: ['a'.repeat(250), 'b'.repeat(251)] }, NOW)).toThrowError(
      expect.objectContaining({ code: 'INVALID_INPUT' }),
    );
  });

  it('rejects a publishAt that is not in the future', () => {
    expect(() => parsePublishJobInput({ ...VALID, publishAt: '2026-10-08T10:00:00.000Z' }, NOW)).toThrowError(
      expect.objectContaining({ code: 'INVALID_INPUT', resource: 'publishAt' }),
    );
  });
});

describe('thumbnailContentType', () => {
  it('maps png and jpeg extensions and rejects the rest', () => {
    expect(thumbnailContentType('a.png')).toBe('image/png');
    expect(thumbnailContentType('a.JPEG')).toBe('image/jpeg');
    expect(thumbnailContentType('a.gif')).toBeNull();
    expect(thumbnailContentType('noext')).toBeNull();
  });
});
