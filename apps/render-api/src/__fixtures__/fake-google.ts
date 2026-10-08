import type { OAuthLoopbackHandle, OAuthLoopbackHandler, StartOAuthLoopbackInput } from '../deps/render-api-dependencies';
import type { FakeFetchRemoteCall, FakeFetchRemoteRoute } from './fake-fetch-remote';
import { jsonBodyChunks } from './fake-fetch-remote';

export function jsonRoute(
  status: number,
  body: unknown,
  headers: Readonly<Record<string, string>> = {},
): FakeFetchRemoteRoute {
  return { status, headers, bodyChunks: jsonBodyChunks(body) };
}

export function emptyRoute(status: number, headers: Readonly<Record<string, string>> = {}): FakeFetchRemoteRoute {
  return { status, headers };
}

export function formFields(call: FakeFetchRemoteCall): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(String(call.init.body ?? '')));
}

export function bodyJson(call: FakeFetchRemoteCall): Record<string, unknown> {
  return JSON.parse(String(call.init.body ?? '{}')) as Record<string, unknown>;
}

export const CHANNEL_RESPONSE = {
  items: [{ id: 'UC-channel-1', snippet: { title: 'Mi canal', thumbnails: { default: { url: 'https://yt3.example/a.jpg' } } } }],
};

export const TOKEN_RESPONSE = { access_token: 'access-1', refresh_token: 'refresh-1', expires_in: 3600 };

export interface FakeOAuthLoopback {
  readonly start: (input: StartOAuthLoopbackInput) => Promise<OAuthLoopbackHandle>;
  readonly handlers: OAuthLoopbackHandler[];
  readonly closed: number[];
}

export function createFakeOAuthLoopback(firstPort = 51000): FakeOAuthLoopback {
  const handlers: OAuthLoopbackHandler[] = [];
  const closed: number[] = [];
  return {
    handlers,
    closed,
    start: async (input) => {
      handlers.push(input.handler);
      const port = firstPort + handlers.length - 1;
      return { port, close: () => closed.push(port) };
    },
  };
}
