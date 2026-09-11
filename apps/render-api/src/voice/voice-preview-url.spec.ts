import { describe, expect, it } from 'vitest';

import { VOICE_PREVIEW_ROUTE_PATTERN, voicePreviewUrl } from './voice-preview-url';

describe('voicePreviewUrl (US-016-001)', () => {
  it('builds a path relative to the service, never an absolute url with a host', () => {
    expect(voicePreviewUrl('es_AR-daniela-high')).toBe('/voices/es_AR-daniela-high/preview');
  });

  it('percent-encodes the voice id so a crafted file name cannot escape the route', () => {
    expect(voicePreviewUrl('../../etc/passwd')).toBe('/voices/..%2F..%2Fetc%2Fpasswd/preview');
  });

  it('the url it builds is matched by the route pattern the router registers', () => {
    const pattern = VOICE_PREVIEW_ROUTE_PATTERN.replace(/:[a-zA-Z]+/u, '[^/]+');

    expect(new RegExp(`^${pattern}$`, 'u').test(voicePreviewUrl('es_MX-claude-high'))).toBe(true);
  });
});
