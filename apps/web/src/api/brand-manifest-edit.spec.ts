import { describe, expect, it } from 'vitest';

import { brandManifest } from './__fixtures__/brand';
import {
  fontFamilies,
  withOptionalText,
  withPaletteColor,
  withTokenOverride,
  withoutTokenOverride,
} from './brand-manifest-edit';

const TOKENS = { '--mg-bg': '#09090b', '--mg-accent': '#0ea5e9', '--mg-accent-2': '#38bdf8', '--mg-text': '#fafafa' };

describe('brand manifest edits', () => {
  it('replaces one palette color and drops the overrides frozen by a duplicate, keeping the font tokens', () => {
    const manifest = brandManifest({
      tokens: { '--mg-accent': '#0ea5e9', '--mg-glow': 'x', '--mg-font-display': '"Outfit"' },
    });

    const next = withPaletteColor(manifest, TOKENS, 'accent', '#ff0000');

    expect(next.palette).toEqual({ background: '#09090b', accent: '#ff0000', accent2: '#14b8a6', text: '#fafafa' });
    expect(next.tokens).toEqual({ '--mg-font-display': '"Outfit"' });
  });

  it('removes the tokens key when no override is left', () => {
    const next = withPaletteColor(brandManifest({ tokens: { '--mg-accent': '#0ea5e9' } }), TOKENS, 'text', '#ffffff');

    expect('tokens' in next).toBe(false);
  });

  it('adds and removes a single token override', () => {
    const overridden = withTokenOverride(brandManifest(), '--mg-radius', '8px');
    expect(overridden.tokens).toEqual({ '--mg-radius': '8px' });

    const reset = withoutTokenOverride(overridden, '--mg-radius');
    expect('tokens' in reset).toBe(false);
  });

  it('drops an optional text when it is cleared and trims it otherwise', () => {
    const withUrl = withOptionalText(brandManifest(), 'url', '  https://x.test ');
    expect(withUrl.url).toBe('https://x.test');
    expect('url' in withOptionalText(withUrl, 'url', '   ')).toBe(false);
  });

  it('lists each font family once', () => {
    const manifest = brandManifest({
      fonts: [
        { family: 'Outfit', file: 'fonts/a.woff2' },
        { family: 'Outfit', file: 'fonts/b.woff2' },
        { family: 'Geist', file: 'fonts/c.woff2' },
      ],
    });

    expect(fontFamilies(manifest)).toEqual(['Outfit', 'Geist']);
  });
});
