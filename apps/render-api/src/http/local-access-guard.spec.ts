import { describe, expect, it } from 'vitest';

import {
  evaluateLocalAccess,
  sessionCookieHeaderValue,
  STUDIO_TOKEN_HEADER,
} from './local-access-guard';

const TOKEN = 'a'.repeat(64);
const PORT = 4599;

function baseInput(overrides: Partial<Parameters<typeof evaluateLocalAccess>[0]> = {}) {
  return {
    accessToken: TOKEN,
    port: PORT,
    method: 'GET',
    pathname: '/api/health',
    query: new URLSearchParams(),
    headers: { host: `127.0.0.1:${PORT}` },
    ...overrides,
  };
}

describe('evaluateLocalAccess (D-C3-04)', () => {
  it('denies any request whose Host header is not exactly 127.0.0.1:<port> or localhost:<port>', () => {
    for (const host of [`evil.example:${PORT}`, `127.0.0.1:9999`, 'localhost', '127.0.0.1', undefined]) {
      const headers = host === undefined ? {} : { host };
      expect(evaluateLocalAccess(baseInput({ headers })).kind).toBe('deny');
    }
  });

  it('accepts localhost:<port> as an equally valid Host', () => {
    const decision = evaluateLocalAccess(
      baseInput({ headers: { host: `localhost:${PORT}`, [STUDIO_TOKEN_HEADER]: TOKEN } }),
    );
    expect(decision.kind).toBe('allow');
  });

  it('GET / with the right ?t= token redirects with a cookie', () => {
    const decision = evaluateLocalAccess(
      baseInput({ pathname: '/', query: new URLSearchParams({ t: TOKEN }) }),
    );
    expect(decision).toEqual({ kind: 'redirect-with-cookie', cookieValue: TOKEN });
  });

  it('GET / with the wrong ?t= token is denied', () => {
    const decision = evaluateLocalAccess(
      baseInput({ pathname: '/', query: new URLSearchParams({ t: 'wrong-token-wrong-token-wrong' }) }),
    );
    expect(decision.kind).toBe('deny');
  });

  it('a request with the vm_session cookie set to the right token is allowed', () => {
    const decision = evaluateLocalAccess(baseInput({ headers: { host: `127.0.0.1:${PORT}`, cookie: `vm_session=${TOKEN}` } }));
    expect(decision.kind).toBe('allow');
  });

  it('a request with the wrong vm_session cookie is denied', () => {
    const decision = evaluateLocalAccess(
      baseInput({ headers: { host: `127.0.0.1:${PORT}`, cookie: 'vm_session=not-the-token-not-the-token' } }),
    );
    expect(decision.kind).toBe('deny');
  });

  it('a request with the x-studio-token header set to the right token is allowed (MCP and producer calls)', () => {
    const decision = evaluateLocalAccess(baseInput({ headers: { host: `127.0.0.1:${PORT}`, [STUDIO_TOKEN_HEADER]: TOKEN } }));
    expect(decision.kind).toBe('allow');
  });

  it('a request with neither cookie nor header nor a valid ?t= is denied', () => {
    expect(evaluateLocalAccess(baseInput()).kind).toBe('deny');
  });

  it('parses multiple cookies and finds vm_session among them', () => {
    const decision = evaluateLocalAccess(
      baseInput({ headers: { host: `127.0.0.1:${PORT}`, cookie: `other=1; vm_session=${TOKEN}; another=2` } }),
    );
    expect(decision.kind).toBe('allow');
  });

  it('a POST to / with ?t= does not trigger the login redirect (only GET does)', () => {
    const decision = evaluateLocalAccess(
      baseInput({ method: 'POST', pathname: '/', query: new URLSearchParams({ t: TOKEN }) }),
    );
    expect(decision.kind).toBe('deny');
  });

  it('sessionCookieHeaderValue builds an HttpOnly SameSite=Strict cookie scoped to the whole app', () => {
    expect(sessionCookieHeaderValue(TOKEN)).toBe(`vm_session=${TOKEN}; HttpOnly; SameSite=Strict; Path=/`);
  });
});
