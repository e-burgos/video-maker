import { describe, expect, it } from 'vitest';

import { readRemotionConfig } from './remotion-config';

describe('readRemotionConfig (US-017-201)', () => {
  it('sin ninguna variable devuelve null en ambos campos, el comportamiento de siempre', () => {
    expect(readRemotionConfig({})).toEqual({ serveUrl: null, browserExecutable: null });
  });

  it('lee REMOTION_SERVE_URL cuando esta definida', () => {
    expect(readRemotionConfig({ REMOTION_SERVE_URL: '/app/resources/remotion-bundle' })).toEqual({
      serveUrl: '/app/resources/remotion-bundle',
      browserExecutable: null,
    });
  });

  it('lee REMOTION_BROWSER_EXECUTABLE cuando esta definida', () => {
    expect(
      readRemotionConfig({ REMOTION_BROWSER_EXECUTABLE: '/app/resources/chrome-headless-shell' }),
    ).toEqual({
      serveUrl: null,
      browserExecutable: '/app/resources/chrome-headless-shell',
    });
  });

  it('una variable vacia se trata como ausente', () => {
    expect(readRemotionConfig({ REMOTION_SERVE_URL: '', REMOTION_BROWSER_EXECUTABLE: '' })).toEqual({
      serveUrl: null,
      browserExecutable: null,
    });
  });

  it('lee las dos variables juntas', () => {
    expect(
      readRemotionConfig({
        REMOTION_SERVE_URL: '/app/resources/remotion-bundle',
        REMOTION_BROWSER_EXECUTABLE: '/app/resources/chrome-headless-shell',
      }),
    ).toEqual({
      serveUrl: '/app/resources/remotion-bundle',
      browserExecutable: '/app/resources/chrome-headless-shell',
    });
  });
});
