import { describe, expect, it, vi } from 'vitest';

import { isTutorialKey, keyFromParams, onRequestGet, onRequestHead } from './[[path]].js';

function makeR2Object({ size, httpEtag, range } = {}) {
  return {
    size,
    httpEtag,
    range,
    body: 'fake-video-bytes',
    writeHttpMetadata(headers) {
      headers.set('content-type', 'application/octet-stream');
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

const URL_BASE = 'https://video.estebanburgos.com.ar/tutoriales/';

describe('keyFromParams', () => {
  it('joins catch-all path segments', () => {
    expect(keyFromParams({ path: ['Tutorial-Video-Maker.mp4'] })).toBe('Tutorial-Video-Maker.mp4');
  });

  it('returns an empty string with no segments', () => {
    expect(keyFromParams({ path: undefined })).toBe('');
  });
});

describe('isTutorialKey', () => {
  it('accepts only the tutorial file', () => {
    expect(isTutorialKey('Tutorial-Video-Maker.mp4')).toBe(true);
    expect(isTutorialKey('Video-Maker-arm64.dmg')).toBe(false);
    expect(isTutorialKey('../Tutorial-Video-Maker.mp4')).toBe(false);
    expect(isTutorialKey('')).toBe(false);
  });
});

describe('onRequestGet', () => {
  it('returns 404 without touching the bucket for any other key', async () => {
    const env = makeEnv();
    const response = await onRequestGet({
      params: { path: ['Video-Maker-arm64.dmg'] },
      request: new Request(`${URL_BASE}Video-Maker-arm64.dmg`),
      env,
    });

    expect(response.status).toBe(404);
    expect(env.DOWNLOADS.get).not.toHaveBeenCalled();
  });

  it('returns 404 when the video is missing from the bucket', async () => {
    const env = makeEnv({ getResult: null });
    const response = await onRequestGet({
      params: { path: ['Tutorial-Video-Maker.mp4'] },
      request: new Request(`${URL_BASE}Tutorial-Video-Maker.mp4`),
      env,
    });

    expect(response.status).toBe(404);
  });

  it('streams the video inline as video/mp4 with range support advertised', async () => {
    const env = makeEnv({ getResult: makeR2Object({ size: 15336276, httpEtag: '"abc"' }) });
    const response = await onRequestGet({
      params: { path: ['Tutorial-Video-Maker.mp4'] },
      request: new Request(`${URL_BASE}Tutorial-Video-Maker.mp4`),
      env,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('video/mp4');
    expect(response.headers.get('content-length')).toBe('15336276');
    expect(response.headers.get('content-disposition')).toBeNull();
    expect(response.headers.get('accept-ranges')).toBe('bytes');
    expect(response.headers.get('cache-control')).toBe('public, max-age=86400');
  });

  it('forwards a Range request to R2 and returns 206 with content-range', async () => {
    const object = makeR2Object({ size: 1000, httpEtag: '"r"', range: { offset: 0, length: 100 } });
    const env = makeEnv({ getResult: object });
    const request = new Request(`${URL_BASE}Tutorial-Video-Maker.mp4`, { headers: { range: 'bytes=0-99' } });

    const response = await onRequestGet({ params: { path: ['Tutorial-Video-Maker.mp4'] }, request, env });

    expect(response.status).toBe(206);
    expect(response.headers.get('content-range')).toBe('bytes 0-99/1000');
    expect(env.DOWNLOADS.get).toHaveBeenCalledWith('Tutorial-Video-Maker.mp4', { range: request.headers });
  });
});

describe('onRequestHead', () => {
  it('returns 404 for any other key', async () => {
    const env = makeEnv();
    const response = await onRequestHead({ params: { path: ['index.html'] }, env });

    expect(response.status).toBe(404);
    expect(env.DOWNLOADS.head).not.toHaveBeenCalled();
  });

  it('returns the size and no body for the tutorial', async () => {
    const env = makeEnv({ headResult: makeR2Object({ size: 555, httpEtag: '"h"' }) });
    const response = await onRequestHead({ params: { path: ['Tutorial-Video-Maker.mp4'] }, env });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-length')).toBe('555');
    expect(response.body).toBeNull();
  });
});
