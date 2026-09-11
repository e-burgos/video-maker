import { describe, expect, it } from 'vitest';

import {
  VOICE_PREVIEW_CACHE_DIR_NAME,
  readVoicePreviewConfig,
} from './voice-preview-config';

describe('readVoicePreviewConfig (US-016-002)', () => {
  it('caches under the temporary directory of the OS, never inside media/', () => {
    const config = readVoicePreviewConfig({}, '/var/folders/tmp');

    expect(config.cacheDirectory).toBe(`/var/folders/tmp/${VOICE_PREVIEW_CACHE_DIR_NAME}`);
  });

  it('PIPER_PREVIEW_CACHE_DIR wins over the temporary directory', () => {
    const config = readVoicePreviewConfig(
      { PIPER_PREVIEW_CACHE_DIR: '/cache/voices' },
      '/var/folders/tmp',
    );

    expect(config.cacheDirectory).toBe('/cache/voices');
  });

  it('an empty PIPER_PREVIEW_CACHE_DIR falls back instead of caching at the filesystem root', () => {
    const config = readVoicePreviewConfig({ PIPER_PREVIEW_CACHE_DIR: '' }, '/var/folders/tmp');

    expect(config.cacheDirectory).toBe(`/var/folders/tmp/${VOICE_PREVIEW_CACHE_DIR_NAME}`);
  });
});
