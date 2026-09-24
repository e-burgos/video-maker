import { timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE_NAME = 'vm_session';
export const STUDIO_TOKEN_HEADER = 'x-studio-token';
export const TOKEN_QUERY_PARAM = 't';

export type AccessDecision =
  | { readonly kind: 'allow' }
  | { readonly kind: 'redirect-with-cookie'; readonly cookieValue: string }
  | { readonly kind: 'deny' };

export interface EvaluateLocalAccessInput {
  readonly accessToken: string;
  readonly port: number;
  readonly method: string;
  readonly pathname: string;
  readonly query: URLSearchParams;
  readonly headers: Readonly<Record<string, string>>;
}

function constantTimeEquals(candidate: string, expected: string): boolean {
  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);
  if (candidateBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return timingSafeEqual(candidateBuffer, expectedBuffer);
}

function parseCookieHeader(header: string | undefined): Readonly<Record<string, string>> {
  if (header === undefined) {
    return {};
  }

  const cookies: Record<string, string> = {};
  for (const pair of header.split(';')) {
    const separatorIndex = pair.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }
    const name = pair.slice(0, separatorIndex).trim();
    const value = pair.slice(separatorIndex + 1).trim();
    if (name !== '') {
      cookies[name] = value;
    }
  }
  return cookies;
}

function isAllowedHost(headers: Readonly<Record<string, string>>, port: number): boolean {
  const host = headers.host;
  if (host === undefined) {
    return false;
  }
  return host === `127.0.0.1:${port}` || host === `localhost:${port}`;
}

export function evaluateLocalAccess(input: EvaluateLocalAccessInput): AccessDecision {
  if (!isAllowedHost(input.headers, input.port)) {
    return { kind: 'deny' };
  }

  if (input.method === 'GET' && input.pathname === '/') {
    const tokenParam = input.query.get(TOKEN_QUERY_PARAM);
    if (tokenParam !== null) {
      return constantTimeEquals(tokenParam, input.accessToken)
        ? { kind: 'redirect-with-cookie', cookieValue: input.accessToken }
        : { kind: 'deny' };
    }
  }

  const cookies = parseCookieHeader(input.headers.cookie);
  const cookieToken = cookies[SESSION_COOKIE_NAME];
  if (cookieToken !== undefined && constantTimeEquals(cookieToken, input.accessToken)) {
    return { kind: 'allow' };
  }

  const headerToken = input.headers[STUDIO_TOKEN_HEADER];
  if (headerToken !== undefined && constantTimeEquals(headerToken, input.accessToken)) {
    return { kind: 'allow' };
  }

  return { kind: 'deny' };
}

export function sessionCookieHeaderValue(token: string): string {
  return `${SESSION_COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/`;
}
