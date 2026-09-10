import { describe, expect, it } from 'vitest';

import {
  ASSET_ROLES,
  isAssetRole,
  isPortableArtifactPath,
  isPortableFileName,
  rawDirectoryForRole,
} from './asset-path';

describe('isAssetRole', () => {
  it('accepts the five asset roles and rejects any other value', () => {
    for (const role of ASSET_ROLES) {
      expect(isAssetRole(role)).toBe(true);
    }

    for (const value of ['video', 'ImAge', '', 'aroll ']) {
      expect(isAssetRole(value)).toBe(false);
    }
  });
});

describe('rawDirectoryForRole', () => {
  it('maps the image role to the raw/images directory', () => {
    expect(rawDirectoryForRole('image')).toBe('images');
    expect(rawDirectoryForRole('aroll')).toBe('aroll');
    expect(rawDirectoryForRole('broll')).toBe('broll');
    expect(rawDirectoryForRole('audio')).toBe('audio');
    expect(rawDirectoryForRole('voice')).toBe('voice');
  });

  it('exposes voice as an uploadable role so a recorded locution lands in raw/voice (US-09-001)', () => {
    expect(ASSET_ROLES).toContain('voice');
    expect(isAssetRole('voice')).toBe(true);
  });
});

describe('isPortableFileName', () => {
  it('rejects a file name with a separator, a parent segment, a drive letter or a URI scheme', () => {
    expect(isPortableFileName('clip01.mp4')).toBe(true);

    expect(isPortableFileName('sub/dir.mp4')).toBe(false);
    expect(isPortableFileName('..')).toBe(false);
    expect(isPortableFileName('../escape.mp4')).toBe(false);
    expect(isPortableFileName('C:\\clip.mp4')).toBe(false);
    expect(isPortableFileName('file:clip.mp4')).toBe(false);
    expect(isPortableFileName('')).toBe(false);
  });
});

describe('isPortableArtifactPath', () => {
  it('rejects an artifact path outside raw, work and out', () => {
    expect(isPortableArtifactPath('raw/aroll/clip01.mp4')).toBe(true);
    expect(isPortableArtifactPath('work/catalog.json')).toBe(true);
    expect(isPortableArtifactPath('out/render-1.mp4')).toBe(true);

    expect(isPortableArtifactPath('media/other.mp4')).toBe(false);
    expect(isPortableArtifactPath('../raw/escape.mp4')).toBe(false);
    expect(isPortableArtifactPath('raw/../escape.mp4')).toBe(false);
    expect(isPortableArtifactPath('/raw/absolute.mp4')).toBe(false);
    expect(isPortableArtifactPath('raw/')).toBe(false);
  });
});
