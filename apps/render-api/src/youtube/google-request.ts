import { collectBytes } from '../media-search/commons-shared';
import type { FetchRemoteInit, RenderApiDependencies } from '../deps/render-api-dependencies';
import { GOOGLE_RESPONSE_LIMIT_BYTES } from './youtube-constants';

const ALLOWED_GOOGLE_HOSTS: readonly string[] = ['accounts.google.com', 'oauth2.googleapis.com', 'www.googleapis.com'];

export class GoogleNetworkError extends Error {
  constructor(cause: unknown) {
    super('Google could not be reached.', { cause });
    this.name = 'GoogleNetworkError';
  }
}

export interface GoogleRequest {
  readonly url: string;
  readonly method?: 'GET' | 'POST' | 'PUT';
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: Uint8Array | string;
  readonly timeoutMs: number;
}

export interface GoogleResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly text: () => Promise<string>;
}

function assertAllowedGoogleUrl(rawUrl: string): void {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== 'https:' || !ALLOWED_GOOGLE_HOSTS.includes(parsed.hostname)) {
    throw new Error(`Outbound request to ${parsed.hostname} is not allowed for the YouTube integration.`);
  }
}

export function formBody(fields: Readonly<Record<string, string>>): string {
  return new URLSearchParams(fields).toString();
}

export const FORM_CONTENT_TYPE = 'application/x-www-form-urlencoded';

export async function googleRequest(deps: RenderApiDependencies, request: GoogleRequest): Promise<GoogleResponse> {
  assertAllowedGoogleUrl(request.url);

  const init: FetchRemoteInit = {
    ...(request.method === undefined ? {} : { method: request.method }),
    ...(request.headers === undefined ? {} : { headers: request.headers }),
    ...(request.body === undefined ? {} : { body: request.body }),
    timeoutMs: request.timeoutMs,
  };

  let response;
  try {
    response = await deps.fetchRemote(request.url, init);
  } catch (cause) {
    throw new GoogleNetworkError(cause);
  }

  return {
    status: response.status,
    headers: response.headers,
    text: async () => {
      try {
        return new TextDecoder().decode(
          await collectBytes(response.body(), GOOGLE_RESPONSE_LIMIT_BYTES, 'Google'),
        );
      } catch (cause) {
        throw new GoogleNetworkError(cause);
      }
    },
  };
}

export function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
