import { describe, expect, it } from 'vitest';

import { isRenderApiError } from '../errors/render-api-error';
import {
  DEFAULT_MAX_UPLOAD_BYTES,
  DEFAULT_MEDIA_ROOT,
  MAX_UPLOAD_BYTES_ENV_VAR,
  MEDIA_ROOT_ENV_VAR,
  OBJECT_STORE_ENV_VAR,
  readStoreConfig,
} from './store-config';

const CWD = '/home/dev/video-maker';

function expectInvalidConfig(env: NodeJS.ProcessEnv, cwd: string): void {
  try {
    readStoreConfig(env, cwd);
    throw new Error('expected readStoreConfig to reject the config');
  } catch (error) {
    if (!isRenderApiError(error)) {
      throw error;
    }
    expect(error.code).toBe('SERVER_CONFIG_INVALID');
  }
}

describe('readStoreConfig', () => {
  it('defaults the media root to media resolved against the cwd', () => {
    expect(readStoreConfig({}, CWD).mediaRoot).toBe(`${CWD}/${DEFAULT_MEDIA_ROOT}`);
    expect(readStoreConfig({ [MEDIA_ROOT_ENV_VAR]: 'projects-media' }, CWD).mediaRoot).toBe(
      `${CWD}/projects-media`,
    );
  });

  it('keeps an absolute RENDER_API_MEDIA_ROOT as is', () => {
    expect(readStoreConfig({ [MEDIA_ROOT_ENV_VAR]: '/mnt/media' }, CWD).mediaRoot).toBe(
      '/mnt/media',
    );
  });

  it('defaults the upload limit and rejects a non-positive RENDER_API_MAX_UPLOAD_BYTES with SERVER_CONFIG_INVALID', () => {
    expect(readStoreConfig({}, CWD).maxUploadBytes).toBe(DEFAULT_MAX_UPLOAD_BYTES);

    for (const invalidValue of ['0', '-1', 'not-a-number', '3.5']) {
      expectInvalidConfig({ [MAX_UPLOAD_BYTES_ENV_VAR]: invalidValue }, CWD);
    }

    expect(readStoreConfig({ [MAX_UPLOAD_BYTES_ENV_VAR]: '1024' }, CWD).maxUploadBytes).toBe(1024);
  });

  it('accepts only fs as RENDER_API_OBJECT_STORE', () => {
    expect(readStoreConfig({}, CWD).objectStore).toBe('fs');
    expect(readStoreConfig({ [OBJECT_STORE_ENV_VAR]: 'fs' }, CWD).objectStore).toBe('fs');

    expectInvalidConfig({ [OBJECT_STORE_ENV_VAR]: 'minio' }, CWD);
  });
});
