import { createHash, randomBytes } from 'node:crypto';

import type { OAuthLoopbackHandle, RenderApiDependencies } from '../deps/render-api-dependencies';
import { PipelineStageError } from '../errors/pipeline-stage-error';
import { FORM_CONTENT_TYPE, GoogleNetworkError, formBody, googleRequest, parseJsonObject } from './google-request';
import { youtubeApiError, youtubeNetworkError } from './youtube-api-error';
import { fetchOwnChannel } from './youtube-channel';
import type { YoutubeChannel } from './youtube-channel';
import {
  GOOGLE_API_TIMEOUT_MS,
  GOOGLE_AUTH_URL,
  GOOGLE_REVOKE_URL,
  GOOGLE_TOKEN_URL,
  OAUTH_CONNECT_TIMEOUT_MS,
  YOUTUBE_CHANNEL_SETTING_KEY,
  YOUTUBE_CLIENT_ID_SECRET,
  YOUTUBE_CLIENT_SECRET_SECRET,
  YOUTUBE_REFRESH_TOKEN_SECRET,
  YOUTUBE_SCOPES,
} from './youtube-constants';

const ACCESS_TOKEN_SAFETY_MARGIN_MS = 60_000;
const DEFAULT_ACCESS_TOKEN_LIFETIME_SEC = 3600;
const VERIFIER_BYTES = 48;
const STATE_BYTES = 24;
const GOOGLE_RESOURCE = 'youtube';

export interface YoutubeIntegrationStatus {
  readonly clientConfigured: boolean;
  readonly connected: boolean;
  readonly channel: YoutubeChannel | null;
}

export interface YoutubeOAuth {
  readonly status: () => Promise<YoutubeIntegrationStatus>;
  readonly saveClient: (clientId: string, clientSecret: string) => Promise<YoutubeIntegrationStatus>;
  readonly startConnect: () => Promise<{ readonly authUrl: string }>;
  readonly disconnect: () => Promise<void>;
  readonly accessToken: () => Promise<string>;
  readonly invalidateAccessToken: () => void;
}

interface OAuthClient {
  readonly clientId: string;
  readonly clientSecret: string;
}

interface TokenGrant {
  readonly accessToken: string;
  readonly refreshToken: string | null;
  readonly expiresInSec: number;
}

interface CachedAccessToken {
  readonly value: string;
  readonly expiresAtMs: number;
}

interface PendingConnect {
  readonly state: string;
  readonly handle: OAuthLoopbackHandle;
}

function base64Url(bytes: Buffer): string {
  return bytes.toString('base64url');
}

function challengeOf(verifier: string): string {
  return base64Url(createHash('sha256').update(verifier).digest());
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => `&#${String(character.charCodeAt(0))};`);
}

const CLOSE_WINDOW_SCRIPT = '<script>setTimeout(function () { window.close(); }, 1500);</script>';

function callbackPage(heading: string, detail: string, closeScript = ''): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Video Maker</title></head><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1rem"><h1>${escapeHtml(heading)}</h1><p>${escapeHtml(detail)}</p>${closeScript}</body></html>`;
}

const SUCCESS_PAGE = callbackPage(
  'Listo, ya podés volver al estudio',
  'YouTube quedó conectado. Esta ventana se cierra sola; si no, cerrala.',
  CLOSE_WINDOW_SCRIPT,
);

function failurePage(reason: string): string {
  return callbackPage('No pudimos conectar YouTube', `${reason} Cerrá esta pestaña y probá de nuevo desde el estudio.`);
}

function notConnected(hint: string): PipelineStageError {
  return new PipelineStageError({ code: 'YOUTUBE_NOT_CONNECTED', stage: null, resource: GOOGLE_RESOURCE, hint });
}

function clientMissing(): PipelineStageError {
  return new PipelineStageError({
    code: 'YOUTUBE_CLIENT_MISSING',
    stage: null,
    resource: GOOGLE_RESOURCE,
    hint: 'store the Google OAuth client id and secret in Settings first',
  });
}

function parseGrant(text: string): TokenGrant | null {
  const body = parseJsonObject(text);
  if (body === null || typeof body.access_token !== 'string') {
    return null;
  }
  return {
    accessToken: body.access_token,
    refreshToken: typeof body.refresh_token === 'string' ? body.refresh_token : null,
    expiresInSec: typeof body.expires_in === 'number' ? body.expires_in : DEFAULT_ACCESS_TOKEN_LIFETIME_SEC,
  };
}

function isChannel(value: unknown): value is YoutubeChannel {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as YoutubeChannel).id === 'string' &&
    typeof (value as YoutubeChannel).title === 'string'
  );
}

export function createYoutubeOAuth(deps: RenderApiDependencies): YoutubeOAuth {
  let pending: PendingConnect | null = null;
  let cached: CachedAccessToken | null = null;
  let refreshing: Promise<string> | null = null;

  const nowMs = (): number => Date.parse(deps.clock.nowIso());

  async function readClient(): Promise<OAuthClient | null> {
    const [clientId, clientSecret] = await Promise.all([
      deps.secretStore.get(YOUTUBE_CLIENT_ID_SECRET),
      deps.secretStore.get(YOUTUBE_CLIENT_SECRET_SECRET),
    ]);
    return clientId === null || clientSecret === null ? null : { clientId, clientSecret };
  }

  function readChannel(): YoutubeChannel | null {
    const stored = deps.localStore.settings.get(YOUTUBE_CHANNEL_SETTING_KEY);
    return isChannel(stored)
      ? { id: stored.id, title: stored.title, thumbnailUrl: stored.thumbnailUrl ?? null }
      : null;
  }

  function cancelPendingConnect(): void {
    pending?.handle.close();
    pending = null;
  }

  async function clearConnection(): Promise<void> {
    cancelPendingConnect();
    cached = null;
    deps.localStore.settings.delete(YOUTUBE_CHANNEL_SETTING_KEY);
    await deps.secretStore.delete(YOUTUBE_REFRESH_TOKEN_SECRET);
  }

  async function revokeBestEffort(token: string): Promise<void> {
    try {
      await googleRequest(deps, {
        url: GOOGLE_REVOKE_URL,
        method: 'POST',
        headers: { 'content-type': FORM_CONTENT_TYPE },
        body: formBody({ token }),
        timeoutMs: GOOGLE_API_TIMEOUT_MS,
      });
    } catch {
      deps.logger.error({ event: 'youtube-revoke-failed' });
    }
  }

  async function requestGrant(fields: Readonly<Record<string, string>>): Promise<TokenGrant> {
    let status: number;
    let text: string;
    try {
      const response = await googleRequest(deps, {
        url: GOOGLE_TOKEN_URL,
        method: 'POST',
        headers: { 'content-type': FORM_CONTENT_TYPE },
        body: formBody(fields),
        timeoutMs: GOOGLE_API_TIMEOUT_MS,
      });
      status = response.status;
      text = await response.text();
    } catch (cause) {
      throw cause instanceof GoogleNetworkError ? youtubeNetworkError(cause) : cause;
    }

    if (status === 400 && parseJsonObject(text)?.error === 'invalid_grant') {
      await clearConnection();
      throw notConnected('Google rejected the stored access, connect YouTube again');
    }
    const grant = status === 200 ? parseGrant(text) : null;
    if (grant === null) {
      throw youtubeApiError(status, text);
    }
    return grant;
  }

  function remember(grant: TokenGrant): void {
    cached = { value: grant.accessToken, expiresAtMs: nowMs() + grant.expiresInSec * 1000 };
  }

  async function refreshAccessToken(): Promise<string> {
    const [refreshToken, client] = await Promise.all([deps.secretStore.get(YOUTUBE_REFRESH_TOKEN_SECRET), readClient()]);
    if (refreshToken === null) {
      throw notConnected('connect a YouTube channel from Settings');
    }
    if (client === null) {
      throw clientMissing();
    }
    const grant = await requestGrant({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: client.clientId,
      client_secret: client.clientSecret,
    });
    remember(grant);
    return grant.accessToken;
  }

  async function accessToken(): Promise<string> {
    if (cached !== null && cached.expiresAtMs - ACCESS_TOKEN_SAFETY_MARGIN_MS > nowMs()) {
      return cached.value;
    }
    refreshing ??= refreshAccessToken().finally(() => {
      refreshing = null;
    });
    return refreshing;
  }

  async function status(): Promise<YoutubeIntegrationStatus> {
    const [client, refreshToken] = await Promise.all([readClient(), deps.secretStore.get(YOUTUBE_REFRESH_TOKEN_SECRET)]);
    return {
      clientConfigured: client !== null,
      connected: refreshToken !== null,
      channel: refreshToken === null ? null : readChannel(),
    };
  }

  async function disconnect(): Promise<void> {
    const refreshToken = await deps.secretStore.get(YOUTUBE_REFRESH_TOKEN_SECRET);
    if (refreshToken !== null) {
      await revokeBestEffort(refreshToken);
    }
    await clearConnection();
  }

  async function saveClient(clientId: string, clientSecret: string): Promise<YoutubeIntegrationStatus> {
    const previous = await readClient();
    const changed = previous === null || previous.clientId !== clientId || previous.clientSecret !== clientSecret;
    if (changed) {
      await disconnect();
      await deps.secretStore.set(YOUTUBE_CLIENT_ID_SECRET, clientId);
      await deps.secretStore.set(YOUTUBE_CLIENT_SECRET_SECRET, clientSecret);
    }
    return status();
  }

  async function completeConnect(
    client: OAuthClient,
    verifier: string,
    redirectUri: string,
    code: string,
  ): Promise<void> {
    const grant = await requestGrant({
      grant_type: 'authorization_code',
      code,
      code_verifier: verifier,
      redirect_uri: redirectUri,
      client_id: client.clientId,
      client_secret: client.clientSecret,
    });
    if (grant.refreshToken === null) {
      throw new PipelineStageError({
        code: 'YOUTUBE_UPLOAD_FAILED',
        stage: null,
        resource: GOOGLE_RESOURCE,
        hint: 'Google did not return a refresh token, revoke the app access in your Google account and connect again',
      });
    }
    const channel = await fetchOwnChannel(deps, grant.accessToken);
    await deps.secretStore.set(YOUTUBE_REFRESH_TOKEN_SECRET, grant.refreshToken);
    deps.localStore.settings.set(YOUTUBE_CHANNEL_SETTING_KEY, channel);
    remember(grant);
  }

  async function handleCallback(
    expectedState: string,
    client: OAuthClient,
    verifier: string,
    redirectUri: string,
    query: Readonly<Record<string, string>>,
  ): Promise<string> {
    pending = null;
    if (query.state !== expectedState) {
      return failurePage('La respuesta de Google no corresponde a esta conexión.');
    }
    if (query.error !== undefined || query.code === undefined) {
      return failurePage('Google no autorizó el acceso.');
    }
    try {
      await completeConnect(client, verifier, redirectUri, query.code);
      return SUCCESS_PAGE;
    } catch (cause) {
      const code = cause instanceof PipelineStageError ? cause.code : 'INTERNAL_ERROR';
      deps.logger.error({ event: 'youtube-connect-failed', detail: { code } });
      return failurePage('Google rechazó o no completó la conexión.');
    }
  }

  async function startConnect(): Promise<{ readonly authUrl: string }> {
    const client = await readClient();
    if (client === null) {
      throw clientMissing();
    }
    cancelPendingConnect();

    const verifier = base64Url(randomBytes(VERIFIER_BYTES));
    const state = base64Url(randomBytes(STATE_BYTES));
    let redirectUri = '';
    const handle = await deps.startOAuthLoopback({
      timeoutMs: OAUTH_CONNECT_TIMEOUT_MS,
      handler: (query) => handleCallback(state, client, verifier, redirectUri, query),
    });
    redirectUri = `http://127.0.0.1:${String(handle.port)}`;
    pending = { state, handle };

    const authUrl = new URL(GOOGLE_AUTH_URL);
    authUrl.search = formBody({
      client_id: client.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: YOUTUBE_SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state,
      code_challenge: challengeOf(verifier),
      code_challenge_method: 'S256',
    });
    return { authUrl: authUrl.toString() };
  }

  return {
    status,
    saveClient,
    startConnect,
    disconnect,
    accessToken,
    invalidateAccessToken: () => {
      cached = null;
    },
  };
}
