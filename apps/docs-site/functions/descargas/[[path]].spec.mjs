import { describe, expect, it, vi } from 'vitest';

import { cacheControlFor, isDownloadableKey, keyFromParams, onRequestGet, onRequestHead } from './[[path]].js';

function makeR2Object({ size, httpEtag, range } = {}) {
  return {
    size,
    httpEtag,
    range,
    body: 'fake-dmg-bytes',
    writeHttpMetadata(headers) {
      headers.set('content-type', 'application/x-www-form-urlencoded');
    },
  };
}

function makeEnv({ getResult, headResult } = {}) {
  return {
    DOWNLOADS: {
      get: vi.fn().mockResolvedValue(getResult ?? null),
      head: vi.fn().mockResolvedValue(headResult ?? null),
    },
  };
}

describe('keyFromParams', () => {
  it('joins catch-all path segments', () => {
    expect(keyFromParams({ path: ['Video-Maker-arm64.dmg'] })).toBe('Video-Maker-arm64.dmg');
  });

  it('returns an empty string with no segments', () => {
    expect(keyFromParams({ path: undefined })).toBe('');
  });
});

describe('isDownloadableKey', () => {
  it('accepts the stable file name', () => {
    expect(isDownloadableKey('Video-Maker-arm64.dmg')).toBe(true);
  });

  it('accepts a versioned file name', () => {
    expect(isDownloadableKey('Video-Maker-0.1.0-arm64.dmg')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isDownloadableKey('Video-Maker-arm64.dmg.bak')).toBe(false);
    expect(isDownloadableKey('../secrets.txt')).toBe(false);
    expect(isDownloadableKey('')).toBe(false);
  });
});

describe('cacheControlFor', () => {
  it('uses a short cache for the stable file name', () => {
    expect(cacheControlFor('Video-Maker-arm64.dmg')).toBe('public, max-age=300');
  });

  it('uses an immutable cache for a versioned file name', () => {
    expect(cacheControlFor('Video-Maker-0.1.0-arm64.dmg')).toBe('public, max-age=31536000, immutable');
  });
});

describe('onRequestGet', () => {
  it('returns 404 for a key that does not match the download pattern', async () => {
    const env = makeEnv();
    const response = await onRequestGet({
      params: { path: ['not-a-dmg.txt'] },
      request: new Request('https://video.estebanburgos.com.ar/descargas/not-a-dmg.txt'),
      env,
    });

    expect(response.status).toBe(404);
    expect(env.DOWNLOADS.get).not.toHaveBeenCalled();
  });

  it('returns 404 when the object is missing from the bucket', async () => {
    const env = makeEnv({ getResult: null });
    const response = await onRequestGet({
      params: { path: ['Video-Maker-arm64.dmg'] },
      request: new Request('https://video.estebanburgos.com.ar/descargas/Video-Maker-arm64.dmg'),
      env,
    });

    expect(response.status).toBe(404);
  });

  it('streams the stable file with a short-lived cache header', async () => {
    const object = makeR2Object({ size: 12345, httpEtag: '"abc"' });
    const env = makeEnv({ getResult: object });
    const response = await onRequestGet({
      params: { path: ['Video-Maker-arm64.dmg'] },
      request: new Request('https://video.estebanburgos.com.ar/descargas/Video-Maker-arm64.dmg'),
      env,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/x-apple-diskimage');
    expect(response.headers.get('content-length')).toBe('12345');
    expect(response.headers.get('content-disposition')).toBe('attachment; filename="Video-Maker-arm64.dmg"');
    expect(response.headers.get('cache-control')).toBe('public, max-age=300');
    expect(response.headers.get('etag')).toBe('"abc"');
    expect(response.headers.get('accept-ranges')).toBe('bytes');
    expect(env.DOWNLOADS.get).toHaveBeenCalledWith('Video-Maker-arm64.dmg', undefined);
  });

  it('uses an immutable cache header for a versioned file', async () => {
    const object = makeR2Object({ size: 99, httpEtag: '"v"' });
    const env = makeEnv({ getResult: object });
    const response = await onRequestGet({
      params: { path: ['Video-Maker-0.1.0-arm64.dmg'] },
      request: new Request('https://video.estebanburgos.com.ar/descargas/Video-Maker-0.1.0-arm64.dmg'),
      env,
    });

    expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
  });

  it('forwards a Range request to R2 and returns 206 with content-range', async () => {
    const object = makeR2Object({ size: 1000, httpEtag: '"r"', range: { offset: 0, length: 100 } });
    const env = makeEnv({ getResult: object });
    const request = new Request('https://video.estebanburgos.com.ar/descargas/Video-Maker-arm64.dmg', {
      headers: { range: 'bytes=0-99' },
    });

    const response = await onRequestGet({ params: { path: ['Video-Maker-arm64.dmg'] }, request, env });

    expect(response.status).toBe(206);
    expect(response.headers.get('content-length')).toBe('100');
    expect(response.headers.get('content-range')).toBe('bytes 0-99/1000');
    expect(env.DOWNLOADS.get).toHaveBeenCalledWith('Video-Maker-arm64.dmg', { range: request.headers });
  });
});

describe('onRequestHead', () => {
  it('returns 404 for a key that does not match the download pattern', async () => {
    const env = makeEnv();
    const response = await onRequestHead({ params: { path: ['index.html'] }, env });

    expect(response.status).toBe(404);
    expect(env.DOWNLOADS.head).not.toHaveBeenCalled();
  });

  it('returns headers with the object size and no body', async () => {
    const object = makeR2Object({ size: 555, httpEtag: '"h"' });
    const env = makeEnv({ headResult: object });
    const response = await onRequestHead({ params: { path: ['Video-Maker-arm64.dmg'] }, env });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-length')).toBe('555');
    expect(response.body).toBeNull();
  });

  it('returns 404 when the object is missing from the bucket', async () => {
    const env = makeEnv({ headResult: null });
    const response = await onRequestHead({ params: { path: ['Video-Maker-arm64.dmg'] }, env });

    expect(response.status).toBe(404);
  });
});
