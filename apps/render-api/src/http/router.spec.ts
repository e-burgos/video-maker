import { describe, expect, it } from 'vitest';

import { normalizePath, routeRequest } from './router';

describe('normalizePath', () => {
  it('strips the query string and a single trailing slash, leaving "/" intact', () => {
    expect(normalizePath('/health')).toBe('/health');
    expect(normalizePath('/health/')).toBe('/health');
    expect(normalizePath('/health?x=1')).toBe('/health');
    expect(normalizePath('/health/?x=1')).toBe('/health');
    expect(normalizePath('/')).toBe('/');
  });
});

describe('routeRequest', () => {
  it('matches GET /health and tolerates a trailing slash and a query string', () => {
    for (const path of ['/health', '/health/', '/health?x=1']) {
      expect(routeRequest('GET', normalizePath(path))).toEqual({ kind: 'matched', id: 'health' });
    }
  });

  it('returns not-found for an unknown path', () => {
    expect(routeRequest('GET', '/unknown-path')).toEqual({ kind: 'not-found' });
  });

  it('returns method-not-allowed with the allow list for POST /health', () => {
    expect(routeRequest('POST', '/health')).toEqual({ kind: 'method-not-allowed', allow: ['GET'] });

    expect(routeRequest('HEAD', '/health')).toEqual({ kind: 'method-not-allowed', allow: ['GET'] });
  });
});
