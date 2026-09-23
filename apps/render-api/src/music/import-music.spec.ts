import { resolveMediaProject } from '@video-maker/auto-montage';
import { describe, expect, it } from 'vitest';

import { createCallLog } from '../__fixtures__/call-log';
import { createFakeFetchRemote, textBodyChunks } from '../__fixtures__/fake-fetch-remote';
import { createFakeObjectStorage } from '../__fixtures__/fake-object-storage';
import type { CommonsMusicResult } from './commons-music-search';
import { downloadCommonsAudioFile, isAllowedMusicDownloadHost } from './import-music';

const PROJECT_ROOT = '/media/pitch-deck';

function project() {
  return resolveMediaProject(PROJECT_ROOT);
}

function commonsResult(overrides?: Partial<CommonsMusicResult>): CommonsMusicResult {
  return {
    resultId: 'commons-abc123',
    title: 'Calm Piano.mp3',
    durationMs: 120000,
    license: 'CC BY 3.0',
    author: 'Jane Doe',
    pageUrl: 'https://commons.wikimedia.org/wiki/File:Calm_Piano.mp3',
    downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/aa/Calm_Piano.mp3',
    ...overrides,
  };
}

describe('isAllowedMusicDownloadHost', () => {
  it('accepts exactly upload.wikimedia.org', () => {
    expect(isAllowedMusicDownloadHost('https://upload.wikimedia.org/wikipedia/commons/a/aa/x.mp3')).toBe(true);
  });

  it('rejects a look-alike host', () => {
    expect(isAllowedMusicDownloadHost('https://upload.wikimedia.org.evil.example/x.mp3')).toBe(false);
  });

  it('rejects a different scheme host entirely', () => {
    expect(isAllowedMusicDownloadHost('https://commons.wikimedia.org/x.mp3')).toBe(false);
  });

  it('rejects an unparseable url', () => {
    expect(isAllowedMusicDownloadHost('not a url')).toBe(false);
  });
});

describe('downloadCommonsAudioFile', () => {
  it('downloads into raw/audio/ using the file name from the download url', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });
    const bytes = textBodyChunks('audio-bytes');
    const { fetchRemote } = createFakeFetchRemote({
      status: 200,
      headers: { 'content-length': String(bytes[0]?.byteLength ?? 0) },
      bodyChunks: bytes,
    });

    const downloaded = await downloadCommonsAudioFile(storage, fetchRemote, project(), commonsResult());

    expect(downloaded.relativePath).toBe('raw/audio/Calm_Piano.mp3');
    expect(await storage.stat(`${PROJECT_ROOT}/raw/audio/Calm_Piano.mp3`)).not.toBeNull();
  });

  it('suffixes the file name when it already exists', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: [PROJECT_ROOT],
      files: [{ path: `${PROJECT_ROOT}/raw/audio/Calm_Piano.mp3`, contents: 'already here' }],
    });
    const bytes = textBodyChunks('audio-bytes');
    const { fetchRemote } = createFakeFetchRemote({
      status: 200,
      headers: { 'content-length': String(bytes[0]?.byteLength ?? 0) },
      bodyChunks: bytes,
    });

    const downloaded = await downloadCommonsAudioFile(storage, fetchRemote, project(), commonsResult());

    expect(downloaded.relativePath).toBe('raw/audio/Calm_Piano-2.mp3');
    expect(await storage.stat(`${PROJECT_ROOT}/raw/audio/Calm_Piano.mp3`)).not.toBeNull();
    expect(await storage.readTextFile(`${PROJECT_ROOT}/raw/audio/Calm_Piano.mp3`)).toBe('already here');
  });

  it('rejects a download url whose host is not upload.wikimedia.org', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });
    const { fetchRemote } = createFakeFetchRemote(new Error('should not be called'));

    await expect(
      downloadCommonsAudioFile(
        storage,
        fetchRemote,
        project(),
        commonsResult({ downloadUrl: 'https://evil.example/x.mp3' }),
      ),
    ).rejects.toThrow();
  });

  it('rejects a non-200 download response', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });
    const { fetchRemote } = createFakeFetchRemote({ status: 404, bodyChunks: textBodyChunks('not found') });

    await expect(downloadCommonsAudioFile(storage, fetchRemote, project(), commonsResult())).rejects.toThrow();
  });

  it('rejects a response with no content-length', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });
    const { fetchRemote } = createFakeFetchRemote({ status: 200, bodyChunks: textBodyChunks('audio-bytes') });

    await expect(downloadCommonsAudioFile(storage, fetchRemote, project(), commonsResult())).rejects.toThrow();
  });

  it('rejects a file over the size cap', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });
    const { fetchRemote } = createFakeFetchRemote({
      status: 200,
      headers: { 'content-length': String(60 * 1024 * 1024) },
      bodyChunks: textBodyChunks('audio-bytes'),
    });

    await expect(downloadCommonsAudioFile(storage, fetchRemote, project(), commonsResult())).rejects.toThrow();
  });
});
