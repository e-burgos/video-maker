import { resolveMediaProject } from '@video-maker/auto-montage';
import { describe, expect, it } from 'vitest';

import { createCallLog } from '../__fixtures__/call-log';
import { createFakeFetchRemote, textBodyChunks } from '../__fixtures__/fake-fetch-remote';
import { createFakeObjectStorage } from '../__fixtures__/fake-object-storage';
import type { FreeMediaResult } from './free-media-result';
import { downloadFreeMediaFile, isAllowedFreeMediaDownloadHost } from './import-free-media';

const PROJECT_ROOT = '/media/pitch-deck';

function project() {
  return resolveMediaProject(PROJECT_ROOT);
}

function videoResult(overrides?: Partial<FreeMediaResult>): FreeMediaResult {
  return {
    resultId: 'commons-video-abc123',
    source: 'commons',
    kind: 'video',
    title: 'Ocean Waves.mp4',
    license: 'CC BY 3.0',
    author: 'Jane Doe',
    pageUrl: 'https://commons.wikimedia.org/wiki/File:Ocean_Waves.mp4',
    downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/aa/Ocean_Waves.mp4',
    durationMs: 5000,
    width: null,
    height: null,
    ...overrides,
  };
}

function imageResult(overrides?: Partial<FreeMediaResult>): FreeMediaResult {
  return {
    resultId: 'nasa-image-PIA1',
    source: 'nasa',
    kind: 'image',
    title: 'Nebula',
    license: 'NASA (public domain, NASA media usage guidelines)',
    author: 'NASA',
    pageUrl: 'https://images.nasa.gov/details/PIA1',
    downloadUrl: 'https://images-assets.nasa.gov/image/PIA1/PIA1~large.jpg',
    durationMs: null,
    width: null,
    height: null,
    ...overrides,
  };
}

describe('isAllowedFreeMediaDownloadHost', () => {
  it('accepts upload.wikimedia.org', () => {
    expect(isAllowedFreeMediaDownloadHost('https://upload.wikimedia.org/wikipedia/commons/a/aa/x.mp4')).toBe(true);
  });

  it('accepts images-assets.nasa.gov', () => {
    expect(isAllowedFreeMediaDownloadHost('https://images-assets.nasa.gov/image/PIA1/PIA1~large.jpg')).toBe(true);
  });

  it('rejects a look-alike host', () => {
    expect(isAllowedFreeMediaDownloadHost('https://images-assets.nasa.gov.evil.example/x.jpg')).toBe(false);
  });

  it('rejects an unparseable url', () => {
    expect(isAllowedFreeMediaDownloadHost('not a url')).toBe(false);
  });
});

describe('downloadFreeMediaFile', () => {
  it('downloads a video into raw/broll/ using the file name from the download url', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });
    const bytes = textBodyChunks('video-bytes');
    const { fetchRemote } = createFakeFetchRemote({
      status: 200,
      headers: { 'content-length': String(bytes[0]?.byteLength ?? 0) },
      bodyChunks: bytes,
    });

    const downloaded = await downloadFreeMediaFile(storage, fetchRemote, project(), videoResult());

    expect(downloaded.relativePath).toBe('raw/broll/Ocean_Waves.mp4');
    expect(await storage.stat(`${PROJECT_ROOT}/raw/broll/Ocean_Waves.mp4`)).not.toBeNull();
  });

  it('guarda el archivo con nombre ASCII: sin tildes, espacios ni paréntesis', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });
    const bytes = textBodyChunks('image-bytes');
    const { fetchRemote } = createFakeFetchRemote({
      status: 200,
      headers: { 'content-length': String(bytes[0]?.byteLength ?? 0) },
      bodyChunks: bytes,
    });
    const result = { ...imageResult(), downloadUrl: 'https://upload.wikimedia.org/x/Caff%C3%A8_espresso_variet%C3%A0_(Unsplash).jpg' };

    const downloaded = await downloadFreeMediaFile(storage, fetchRemote, project(), result);

    expect(downloaded.relativePath).toBe('raw/images/Caffe_espresso_varieta_-Unsplash.jpg');
  });

  it('downloads an image into raw/images/', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });
    const bytes = textBodyChunks('image-bytes');
    const { fetchRemote } = createFakeFetchRemote({
      status: 200,
      headers: { 'content-length': String(bytes[0]?.byteLength ?? 0) },
      bodyChunks: bytes,
    });

    const downloaded = await downloadFreeMediaFile(storage, fetchRemote, project(), imageResult());

    expect(downloaded.relativePath).toBe('raw/images/PIA1~large.jpg');
  });

  it('suffixes the file name when it already exists', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: [PROJECT_ROOT],
      files: [{ path: `${PROJECT_ROOT}/raw/broll/Ocean_Waves.mp4`, contents: 'already here' }],
    });
    const bytes = textBodyChunks('video-bytes');
    const { fetchRemote } = createFakeFetchRemote({
      status: 200,
      headers: { 'content-length': String(bytes[0]?.byteLength ?? 0) },
      bodyChunks: bytes,
    });

    const downloaded = await downloadFreeMediaFile(storage, fetchRemote, project(), videoResult());

    expect(downloaded.relativePath).toBe('raw/broll/Ocean_Waves-2.mp4');
  });

  it('rejects a download url whose host is not allow-listed', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });
    const { fetchRemote } = createFakeFetchRemote(new Error('should not be called'));

    await expect(
      downloadFreeMediaFile(storage, fetchRemote, project(), videoResult({ downloadUrl: 'https://evil.example/x.mp4' })),
    ).rejects.toThrow();
  });

  it('rejects a non-200 download response', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });
    const { fetchRemote } = createFakeFetchRemote({ status: 404, bodyChunks: textBodyChunks('not found') });

    await expect(downloadFreeMediaFile(storage, fetchRemote, project(), videoResult())).rejects.toThrow();
  });

  it('rejects a response with no content-length', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });
    const { fetchRemote } = createFakeFetchRemote({ status: 200, bodyChunks: textBodyChunks('video-bytes') });

    await expect(downloadFreeMediaFile(storage, fetchRemote, project(), videoResult())).rejects.toThrow();
  });

  it('rejects a video over the 200 MB cap', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });
    const { fetchRemote } = createFakeFetchRemote({
      status: 200,
      headers: { 'content-length': String(210 * 1024 * 1024) },
      bodyChunks: textBodyChunks('video-bytes'),
    });

    await expect(downloadFreeMediaFile(storage, fetchRemote, project(), videoResult())).rejects.toThrow();
  });

  it('rejects an image over the 30 MB cap', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });
    const { fetchRemote } = createFakeFetchRemote({
      status: 200,
      headers: { 'content-length': String(31 * 1024 * 1024) },
      bodyChunks: textBodyChunks('image-bytes'),
    });

    await expect(downloadFreeMediaFile(storage, fetchRemote, project(), imageResult())).rejects.toThrow();
  });
});
