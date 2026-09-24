import { describe, expect, it } from 'vitest';

import { createCallLog } from '../__fixtures__/call-log';
import { createFakeObjectStorage } from '../__fixtures__/fake-object-storage';
import { inboxAssetId, pickAvailableFileName, toAssetProbeSummary, withSuffix } from './asset-inbox';

describe('inboxAssetId', () => {
  it('builds the project-relative path under raw/inbox', () => {
    expect(inboxAssetId('clip.mp4')).toBe('raw/inbox/clip.mp4');
  });
});

describe('withSuffix', () => {
  it('returns the file name unchanged on the first attempt', () => {
    expect(withSuffix('clip.mp4', 1)).toBe('clip.mp4');
  });

  it('inserts the attempt number before the extension', () => {
    expect(withSuffix('clip.mp4', 2)).toBe('clip-2.mp4');
    expect(withSuffix('clip.mp4', 3)).toBe('clip-3.mp4');
  });

  it('appends the attempt number when there is no extension', () => {
    expect(withSuffix('README', 2)).toBe('README-2');
  });

  it('treats a leading dot as part of the name, not an extension', () => {
    expect(withSuffix('.gitignore', 2)).toBe('.gitignore-2');
  });
});

describe('pickAvailableFileName', () => {
  it('returns the requested name when nothing occupies it', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: ['/media/demo/raw/inbox'] });

    expect(await pickAvailableFileName(storage, '/media/demo/raw/inbox', 'clip.mp4')).toBe('clip.mp4');
  });

  it('suffixes past every already occupied candidate', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: ['/media/demo/raw/inbox'],
      files: [
        { path: '/media/demo/raw/inbox/clip.mp4', contents: 'a' },
        { path: '/media/demo/raw/inbox/clip-2.mp4', contents: 'b' },
      ],
    });

    expect(await pickAvailableFileName(storage, '/media/demo/raw/inbox', 'clip.mp4')).toBe('clip-3.mp4');
  });
});

describe('toAssetProbeSummary', () => {
  it('keeps only the probe fields relevant to a role proposal', () => {
    expect(
      toAssetProbeSummary({
        id: 'raw/inbox/clip.mp4',
        kind: 'video',
        path: 'raw/inbox/clip.mp4',
        durationMs: 12_000,
        fps: 30,
        width: 1920,
        height: 1080,
        hasAudio: true,
        videoCodec: 'h264',
        probedAt: '2026-01-01T00:00:00.000Z',
      }),
    ).toEqual({
      kind: 'video',
      durationMs: 12_000,
      width: 1920,
      height: 1080,
      hasAudio: true,
    });
  });

  it('omits undefined optional fields instead of writing them as undefined', () => {
    expect(
      toAssetProbeSummary({
        id: 'raw/inbox/photo.jpg',
        kind: 'image',
        path: 'raw/inbox/photo.jpg',
        durationMs: 0,
        probedAt: '2026-01-01T00:00:00.000Z',
      }),
    ).toEqual({ kind: 'image', durationMs: 0 });
  });
});
