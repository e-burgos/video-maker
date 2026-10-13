import { describe, expect, it } from 'vitest';

import { externalUrlToOpen } from './external-navigation';

const APP_ORIGIN = 'http://127.0.0.1:4318';

describe('externalUrlToOpen', () => {
  it('opens the Google OAuth consent screen outside the app', () => {
    const url = 'https://accounts.google.com/o/oauth2/v2/auth?client_id=abc&state=xyz';
    expect(externalUrlToOpen(url, APP_ORIGIN)).toBe(url);
  });

  it('opens other http origins, including another port on the same host', () => {
    expect(externalUrlToOpen('http://127.0.0.1:9999/x', APP_ORIGIN)).toBe('http://127.0.0.1:9999/x');
  });

  it('returns null for the app origin', () => {
    expect(externalUrlToOpen(`${APP_ORIGIN}/videos/1/download`, APP_ORIGIN)).toBeNull();
  });

  it.each([
    'about:blank',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'data:text/html,<h1>x</h1>',
    'ftp://example.com/file',
    'not a url',
    '',
  ])('blocks %s without opening anything', (url) => {
    expect(externalUrlToOpen(url, APP_ORIGIN)).toBeNull();
  });
});
