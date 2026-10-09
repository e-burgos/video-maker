import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { createCallLog } from '../__fixtures__/call-log';
import { createFakeFetchRemote } from '../__fixtures__/fake-fetch-remote';
import type { FakeFetchRemoteAnswer } from '../__fixtures__/fake-fetch-remote';
import {
  CHANNEL_RESPONSE,
  TOKEN_RESPONSE,
  createFakeOAuthLoopback,
  emptyRoute,
  formFields,
  jsonRoute,
} from '../__fixtures__/fake-google';
import { createFakeRenderApiDependencies } from '../__fixtures__/fake-render-api-dependencies';
import type { LogEvent } from '../deps/render-api-dependencies';
import { toErrorPayload } from '../errors/to-error-payload';
import {
  YOUTUBE_CHANNEL_SETTING_KEY,
  YOUTUBE_CLIENT_ID_SECRET,
  YOUTUBE_CLIENT_SECRET_SECRET,
  YOUTUBE_REFRESH_TOKEN_SECRET,
} from './youtube-constants';
import { createYoutubeOAuth } from './youtube-oauth';

const START = Date.parse('2026-10-08T10:00:00.000Z');

function harness(answer?: FakeFetchRemoteAnswer) {
  let nowMs = START;
  const loopback = createFakeOAuthLoopback();
  const google = createFakeFetchRemote(
    answer ??
      ((call) => {
        if (call.url.startsWith('https://oauth2.googleapis.com/token')) {
          return jsonRoute(200, TOKEN_RESPONSE);
        }
        if (call.url.startsWith('https://www.googleapis.com/youtube/v3/channels')) {
          return jsonRoute(200, CHANNEL_RESPONSE);
        }
        return emptyRoute(200);
      }),
  );
  const logged: LogEvent[] = [];
  const deps = createFakeRenderApiDependencies(createCallLog(), {
    fetchRemote: google.fetchRemote,
    startOAuthLoopback: loopback.start,
    clock: { nowIso: () => new Date(nowMs).toISOString() },
    logger: { info: () => undefined, error: (event) => logged.push(event) },
  });
  return { deps, oauth: createYoutubeOAuth(deps), loopback, google, logged, advance: (ms: number) => (nowMs += ms) };
}

async function connect(h: ReturnType<typeof harness>): Promise<{ authUrl: URL; callback: (query: Record<string, string>) => Promise<string> }> {
  await h.oauth.saveClient('client-id', 'client-secret');
  const { authUrl } = await h.oauth.startConnect();
  const handler = h.loopback.handlers[h.loopback.handlers.length - 1];
  if (handler === undefined) {
    throw new Error('no loopback handler registered');
  }
  return { authUrl: new URL(authUrl), callback: handler };
}

describe('youtube oauth status and client', () => {
  it('starts disconnected and unconfigured with the contract keys', async () => {
    const status = await harness().oauth.status();

    expect(Object.keys(status).sort()).toEqual(['channel', 'clientConfigured', 'connected']);
    expect(status).toEqual({ clientConfigured: false, connected: false, channel: null });
  });

  it('stores the client id and secret in the secret store', async () => {
    const h = harness();

    const status = await h.oauth.saveClient('client-id', 'client-secret');

    expect(status.clientConfigured).toBe(true);
    expect(await h.deps.secretStore.get(YOUTUBE_CLIENT_ID_SECRET)).toBe('client-id');
    expect(await h.deps.secretStore.get(YOUTUBE_CLIENT_SECRET_SECRET)).toBe('client-secret');
  });

  it('refuses to connect before a client is stored', async () => {
    const error = await harness().oauth.startConnect().catch((cause: unknown) => toErrorPayload(cause));

    expect(error).toMatchObject({ code: 'YOUTUBE_CLIENT_MISSING' });
  });
});

describe('youtube oauth connect', () => {
  it('builds a PKCE consent url with a loopback redirect, offline access and forced consent', async () => {
    const h = harness();

    const { authUrl } = await connect(h);

    expect(`${authUrl.origin}${authUrl.pathname}`).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    const query = Object.fromEntries(authUrl.searchParams);
    expect(Object.keys(query).sort()).toEqual([
      'access_type',
      'client_id',
      'code_challenge',
      'code_challenge_method',
      'prompt',
      'redirect_uri',
      'response_type',
      'scope',
      'state',
    ]);
    expect(query).toMatchObject({
      client_id: 'client-id',
      redirect_uri: 'http://127.0.0.1:51000',
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.force-ssl',
      access_type: 'offline',
      prompt: 'consent',
      code_challenge_method: 'S256',
    });
    expect(query.state?.length).toBeGreaterThan(20);
  });

  it('exchanges the code with the matching PKCE verifier, stores the refresh token and the channel, and answers a Spanish success page', async () => {
    const h = harness();
    const { authUrl, callback } = await connect(h);

    const page = await callback({ code: 'auth-code', state: authUrl.searchParams.get('state') ?? '' });

    expect(page).toContain('Listo, ya podés volver al estudio');
    expect(page).toContain('window.close()');
    const tokenCall = h.google.calls.find((call) => call.url === 'https://oauth2.googleapis.com/token');
    const fields = formFields(tokenCall ?? { url: '', init: { timeoutMs: 0 } });
    expect(fields).toMatchObject({
      grant_type: 'authorization_code',
      code: 'auth-code',
      client_id: 'client-id',
      client_secret: 'client-secret',
      redirect_uri: 'http://127.0.0.1:51000',
    });
    const challenge = createHash('sha256').update(fields.code_verifier ?? '').digest('base64url');
    expect(challenge).toBe(authUrl.searchParams.get('code_challenge'));
    const channelCall = h.google.calls.find((call) => call.url.includes('/youtube/v3/channels'));
    expect(channelCall?.init.headers).toEqual({ authorization: 'Bearer access-1' });
    expect(await h.deps.secretStore.get(YOUTUBE_REFRESH_TOKEN_SECRET)).toBe('refresh-1');
    expect(h.deps.localStore.settings.get(YOUTUBE_CHANNEL_SETTING_KEY)).toEqual({
      id: 'UC-channel-1',
      title: 'Mi canal',
      thumbnailUrl: 'https://yt3.example/a.jpg',
    });
    expect(await h.oauth.status()).toEqual({
      clientConfigured: true,
      connected: true,
      channel: { id: 'UC-channel-1', title: 'Mi canal', thumbnailUrl: 'https://yt3.example/a.jpg' },
    });
  });

  it('rejects a callback whose state does not match and stores nothing', async () => {
    const h = harness();
    const { callback } = await connect(h);

    const page = await callback({ code: 'auth-code', state: 'forged' });

    expect(page).toContain('No pudimos conectar YouTube');
    expect(await h.oauth.status()).toMatchObject({ connected: false });
    expect(h.google.calls).toHaveLength(0);
  });

  it('answers an error page when Google reports the user denied access', async () => {
    const h = harness();
    const { authUrl, callback } = await connect(h);

    const page = await callback({ error: 'access_denied', state: authUrl.searchParams.get('state') ?? '' });

    expect(page).toContain('No pudimos conectar YouTube');
    expect(await h.oauth.status()).toMatchObject({ connected: false });
  });

  it('fails the connection without leaking tokens when the exchange is refused', async () => {
    const h = harness((call) =>
      call.url.startsWith('https://oauth2.googleapis.com/token') ? jsonRoute(400, { error: 'invalid_client' }) : emptyRoute(200),
    );
    const { authUrl, callback } = await connect(h);

    const page = await callback({ code: 'auth-code', state: authUrl.searchParams.get('state') ?? '' });

    expect(page).toContain('No pudimos conectar YouTube');
    expect(await h.oauth.status()).toMatchObject({ connected: false });
    expect(JSON.stringify(h.logged)).not.toContain('auth-code');
    expect(JSON.stringify(h.logged)).not.toContain('client-secret');
  });

  it('fails the connection when Google returns no refresh token', async () => {
    const h = harness((call) =>
      call.url.startsWith('https://oauth2.googleapis.com/token')
        ? jsonRoute(200, { access_token: 'access-1', expires_in: 3600 })
        : jsonRoute(200, CHANNEL_RESPONSE),
    );
    const { authUrl, callback } = await connect(h);

    const page = await callback({ code: 'auth-code', state: authUrl.searchParams.get('state') ?? '' });

    expect(page).toContain('No pudimos conectar YouTube');
    expect(await h.deps.secretStore.get(YOUTUBE_REFRESH_TOKEN_SECRET)).toBeNull();
  });

  it('keeps one pending connect at a time: a new connect closes the previous listener', async () => {
    const h = harness();
    await connect(h);

    await h.oauth.startConnect();

    expect(h.loopback.handlers).toHaveLength(2);
    expect(h.loopback.closed).toEqual([51000]);
  });
});

async function connected(h: ReturnType<typeof harness>): Promise<void> {
  const { authUrl, callback } = await connect(h);
  await callback({ code: 'auth-code', state: authUrl.searchParams.get('state') ?? '' });
  h.google.calls.length = 0;
}

describe('youtube oauth access tokens', () => {
  it('caches the access token until it expires and then refreshes with the refresh token', async () => {
    const h = harness();
    await connected(h);

    expect(await h.oauth.accessToken()).toBe('access-1');
    expect(await h.oauth.accessToken()).toBe('access-1');
    expect(h.google.calls).toHaveLength(0);

    h.advance(3600 * 1000);
    h.google.calls.length = 0;
    const refreshed = await h.oauth.accessToken();

    expect(refreshed).toBe('access-1');
    expect(formFields(h.google.calls[0] ?? { url: '', init: { timeoutMs: 0 } })).toMatchObject({
      grant_type: 'refresh_token',
      refresh_token: 'refresh-1',
      client_id: 'client-id',
    });
  });

  it('deduplicates concurrent refreshes into one request', async () => {
    const h = harness();
    await connected(h);
    h.advance(3600 * 1000);
    h.google.calls.length = 0;

    await Promise.all([h.oauth.accessToken(), h.oauth.accessToken(), h.oauth.accessToken()]);

    expect(h.google.calls).toHaveLength(1);
  });

  it('forces a new refresh after the cached token is invalidated', async () => {
    const h = harness();
    await connected(h);

    h.oauth.invalidateAccessToken();
    await h.oauth.accessToken();

    expect(h.google.calls).toHaveLength(1);
  });

  it('clears the connection and fails with YOUTUBE_NOT_CONNECTED on invalid_grant', async () => {
    const h = harness();
    await connected(h);
    h.oauth.invalidateAccessToken();
    const revoked = createFakeFetchRemote(jsonRoute(400, { error: 'invalid_grant' }));
    const deps = createFakeRenderApiDependencies(createCallLog(), {
      fetchRemote: revoked.fetchRemote,
      secretStore: h.deps.secretStore,
      localStore: h.deps.localStore,
      startOAuthLoopback: h.loopback.start,
    });

    const error = await createYoutubeOAuth(deps).accessToken().catch((cause: unknown) => toErrorPayload(cause));

    expect(error).toMatchObject({ code: 'YOUTUBE_NOT_CONNECTED' });
    expect(await deps.secretStore.get(YOUTUBE_REFRESH_TOKEN_SECRET)).toBeNull();
    expect(deps.localStore.settings.get(YOUTUBE_CHANNEL_SETTING_KEY)).toBeNull();
  });

  it('fails with YOUTUBE_NOT_CONNECTED when there is no refresh token', async () => {
    const h = harness();
    await h.oauth.saveClient('client-id', 'client-secret');

    const error = await h.oauth.accessToken().catch((cause: unknown) => toErrorPayload(cause));

    expect(error).toMatchObject({ code: 'YOUTUBE_NOT_CONNECTED' });
  });
});

describe('youtube oauth disconnect and client change', () => {
  it('revokes the refresh token at Google and clears the token and the channel', async () => {
    const h = harness();
    await connected(h);

    await h.oauth.disconnect();

    const revoke = h.google.calls.find((call) => call.url === 'https://oauth2.googleapis.com/revoke');
    expect(revoke?.init.method).toBe('POST');
    expect(formFields(revoke ?? { url: '', init: { timeoutMs: 0 } })).toEqual({ token: 'refresh-1' });
    expect(await h.oauth.status()).toEqual({ clientConfigured: true, connected: false, channel: null });
  });

  it('still clears the local connection when the revoke request fails', async () => {
    const h = harness((call) => {
      if (call.url.includes('/revoke')) {
        return new Error('offline');
      }
      return call.url.includes('/token') ? jsonRoute(200, TOKEN_RESPONSE) : jsonRoute(200, CHANNEL_RESPONSE);
    });
    await connected(h);

    await h.oauth.disconnect();

    expect(await h.oauth.status()).toMatchObject({ connected: false });
  });

  it('disconnects when the client changes but keeps the connection when the same client is saved again', async () => {
    const h = harness();
    await connected(h);

    await h.oauth.saveClient('client-id', 'client-secret');
    expect(await h.oauth.status()).toMatchObject({ connected: true });

    const status = await h.oauth.saveClient('other-client', 'other-secret');
    expect(status).toEqual({ clientConfigured: true, connected: false, channel: null });
  });
});
