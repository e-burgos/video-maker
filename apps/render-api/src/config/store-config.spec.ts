import { describe, expect, it } from 'vitest';

import { isRenderApiError } from '../errors/render-api-error';
import {
  DB_PATH_ENV_VAR,
  DEFAULT_MAX_UPLOAD_BYTES,
  DEFAULT_MEDIA_ROOT,
  BRANDS_ROOT_ENV_VAR,
  MAX_UPLOAD_BYTES_ENV_VAR,
  MEDIA_ROOT_ENV_VAR,
  MOTION_ASSETS_ENV_VAR,
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

  it('defaults the db path under .studio inside the resolved media root', () => {
    expect(readStoreConfig({}, CWD).dbPath).toBe(`${CWD}/${DEFAULT_MEDIA_ROOT}/.studio/studio.db`);
    expect(readStoreConfig({ [MEDIA_ROOT_ENV_VAR]: 'projects-media' }, CWD).dbPath).toBe(
      `${CWD}/projects-media/.studio/studio.db`,
    );
  });

  it('resolves a relative RENDER_API_DB_PATH against the cwd, like the media root', () => {
    expect(readStoreConfig({ [DB_PATH_ENV_VAR]: 'state/studio.db' }, CWD).dbPath).toBe(
      `${CWD}/state/studio.db`,
    );
  });

  it('keeps an absolute RENDER_API_DB_PATH as is', () => {
    expect(readStoreConfig({ [DB_PATH_ENV_VAR]: '/var/lib/video-maker/studio.db' }, CWD).dbPath).toBe(
      '/var/lib/video-maker/studio.db',
    );
  });

  it('accepts only fs as RENDER_API_OBJECT_STORE', () => {
    expect(readStoreConfig({}, CWD).objectStore).toBe('fs');
    expect(readStoreConfig({ [OBJECT_STORE_ENV_VAR]: 'fs' }, CWD).objectStore).toBe('fs');

    expectInvalidConfig({ [OBJECT_STORE_ENV_VAR]: 'minio' }, CWD);
  });

  it('defaults the motion assets root to the repo libs folder and honours MOTION_GRAPHICS_ASSETS', () => {
    expect(readStoreConfig({}, CWD).motionAssetsRoot).toBe(`${CWD}/libs/motion-graphics/assets`);
    expect(readStoreConfig({ [MOTION_ASSETS_ENV_VAR]: 'assets/motion' }, CWD).motionAssetsRoot).toBe(
      `${CWD}/assets/motion`,
    );
    expect(readStoreConfig({ [MOTION_ASSETS_ENV_VAR]: '/opt/motion-assets' }, CWD).motionAssetsRoot).toBe(
      '/opt/motion-assets',
    );
  });

  it('defaults the brands root to a brands folder next to the media root and honours BRANDS_ROOT', () => {
    expect(readStoreConfig({}, CWD).brandsRoot).toBe(`${CWD}/brands`);
    expect(readStoreConfig({ [MEDIA_ROOT_ENV_VAR]: '/mnt/data/projects' }, CWD).brandsRoot).toBe('/mnt/data/brands');
    expect(readStoreConfig({ [BRANDS_ROOT_ENV_VAR]: 'my-brands' }, CWD).brandsRoot).toBe(`${CWD}/my-brands`);
    expect(readStoreConfig({ [BRANDS_ROOT_ENV_VAR]: '/opt/brands' }, CWD).brandsRoot).toBe('/opt/brands');
  });
});
