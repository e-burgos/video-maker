import { describe, expect, it } from 'vitest';

import { createCallLog } from '../__fixtures__/call-log';
import { createFakeFetchRemote } from '../__fixtures__/fake-fetch-remote';
import { createFakeRenderApiDependencies } from '../__fixtures__/fake-render-api-dependencies';
import { youtubeApiError } from './youtube-api-error';
import { GoogleNetworkError, googleRequest } from './google-request';

function deps(fetchRemote = createFakeFetchRemote({ status: 200 }).fetchRemote) {
  return createFakeRenderApiDependencies(createCallLog(), { fetchRemote });
}

describe('googleRequest', () => {
  it('allows the three Google hosts over https', async () => {
    for (const url of [
      'https://accounts.google.com/o/oauth2/v2/auth',
      'https://oauth2.googleapis.com/token',
      'https://www.googleapis.com/youtube/v3/channels',
    ]) {
      await expect(googleRequest(deps(), { url, timeoutMs: 1000 })).resolves.toMatchObject({ status: 200 });
    }
  });

  it('refuses any other host, plain http and look-alike hosts without calling the network', async () => {
    const fake = createFakeFetchRemote({ status: 200 });

    for (const url of [
      'https://evil.example/token',
      'http://oauth2.googleapis.com/token',
      'https://oauth2.googleapis.com.evil.example/token',
      'https://googleapis.com/x',
      'https://youtube.com/x',
    ]) {
      await expect(googleRequest(deps(fake.fetchRemote), { url, timeoutMs: 1000 })).rejects.toThrow('not allowed');
    }
    expect(fake.calls).toHaveLength(0);
  });

  it('turns a transport failure into GoogleNetworkError', async () => {
    const failing = createFakeFetchRemote(new Error('offline'));

    await expect(
      googleRequest(deps(failing.fetchRemote), { url: 'https://oauth2.googleapis.com/token', timeoutMs: 1000 }),
    ).rejects.toBeInstanceOf(GoogleNetworkError);
  });
});

describe('youtubeApiError', () => {
  it('maps quota reasons to YOUTUBE_QUOTA_EXCEEDED', () => {
    for (const reason of ['quotaExceeded', 'dailyLimitExceeded', 'rateLimitExceeded', 'uploadLimitExceeded']) {
      const error = youtubeApiError(403, JSON.stringify({ error: { message: 'm', errors: [{ reason }] } }));
      expect(error.code).toBe('YOUTUBE_QUOTA_EXCEEDED');
    }
  });

  it('maps 401 to YOUTUBE_NOT_CONNECTED and everything else to YOUTUBE_UPLOAD_FAILED with the reason', () => {
    expect(youtubeApiError(401, '{}').code).toBe('YOUTUBE_NOT_CONNECTED');

    const failed = youtubeApiError(400, JSON.stringify({ error: { message: 'bad title', errors: [{ reason: 'invalidTitle' }] } }));
    expect(failed.code).toBe('YOUTUBE_UPLOAD_FAILED');
    expect(failed.hint).toBe('400 invalidTitle bad title');
  });

  it('survives a body that is not JSON', () => {
    expect(youtubeApiError(500, '<html>').code).toBe('YOUTUBE_UPLOAD_FAILED');
  });
});
