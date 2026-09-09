import { describe, expect, it } from 'vitest';

import { normalizePath, routeRequest } from './router';
import { ROUTES } from './routes';

function canonicalPathFor(pattern: string): string {
  return pattern
    .split('/')
    .map((segment) => {
      if (segment.startsWith('*')) {
        return 'a/b/c';
      }
      if (segment.startsWith(':')) {
        return 'example';
      }
      return segment;
    })
    .join('/');
}

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

  it('extracts the slug, role and filename params of the upload route', () => {
    expect(routeRequest('PUT', '/projects/acme-launch/assets/aroll/clip01.mp4')).toEqual({
      kind: 'matched',
      id: 'projects.assets.upload',
      params: { slug: 'acme-launch', role: 'aroll', filename: 'clip01.mp4' },
    });
  });

  it('captures the remaining segments of the files route in a single path param', () => {
    expect(routeRequest('GET', '/projects/acme-launch/files/raw/aroll/clip01.mp4')).toEqual({
      kind: 'matched',
      id: 'projects.files.get',
      params: { slug: 'acme-launch', path: 'raw/aroll/clip01.mp4' },
    });
  });

  it('percent-decodes every captured param and returns not-found for an undecodable one', () => {
    expect(routeRequest('GET', '/projects/acme%20launch')).toEqual({
      kind: 'matched',
      id: 'projects.detail',
      params: { slug: 'acme launch' },
    });

    expect(routeRequest('GET', '/projects/%zz')).toEqual({ kind: 'not-found' });

    expect(routeRequest('GET', '/projects/acme-launch/files/raw/a%20roll/clip01.mp4')).toEqual({
      kind: 'matched',
      id: 'projects.files.get',
      params: { slug: 'acme-launch', path: 'raw/a roll/clip01.mp4' },
    });

    expect(routeRequest('GET', '/projects/acme-launch/files/raw/%zz/clip01.mp4')).toEqual({
      kind: 'not-found',
    });
  });

  it('never matches an empty segment against a named param', () => {
    expect(routeRequest('GET', '/projects//assets')).toEqual({ kind: 'not-found' });
  });

  it('answers method-not-allowed with every method declared for a parameterised path', () => {
    expect(routeRequest('DELETE', '/projects/acme-launch/timeline')).toEqual({
      kind: 'method-not-allowed',
      allow: ['GET', 'PUT'],
    });
  });

  it('routes the four job patterns with their params', () => {
    expect(routeRequest('POST', '/projects/acme-launch/jobs')).toEqual({
      kind: 'matched',
      id: 'projects.jobs.create',
      params: { slug: 'acme-launch' },
    });

    expect(routeRequest('GET', '/projects/acme-launch/jobs')).toEqual({
      kind: 'matched',
      id: 'projects.jobs.list',
      params: { slug: 'acme-launch' },
    });

    expect(routeRequest('GET', '/jobs/render-0001')).toEqual({
      kind: 'matched',
      id: 'jobs.detail',
      params: { jobId: 'render-0001' },
    });

    expect(routeRequest('DELETE', '/jobs/render-0001')).toEqual({
      kind: 'matched',
      id: 'jobs.cancel',
      params: { jobId: 'render-0001' },
    });
  });

  it('answers method-not-allowed with GET and DELETE for a job path', () => {
    expect(routeRequest('PATCH', '/jobs/render-0001')).toEqual({
      kind: 'method-not-allowed',
      allow: ['GET', 'DELETE'],
    });
  });

  it('no two ROUTES patterns match the same concrete path', () => {
    for (const route of ROUTES) {
      const path = canonicalPathFor(route.pattern);
      const result = routeRequest(route.method, path);

      expect(result).toMatchObject({ kind: 'matched', id: route.id });
    }
  });
});
