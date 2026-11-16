import { describe, expect, it } from 'vitest';

import { JSON_CONTENT_TYPE } from '../http-message';
import {
  DEFAULT_UPDATE_MANIFEST_URL,
  UPDATE_MANIFEST_URL_ENV_VAR,
  handleGetAppUpdate,
} from './app-update-handler';
import type { AppUpdateBody } from './app-update-handler';

const MANIFEST = {
  version: '0.4.0',
  url: 'https://video.estebanburgos.com.ar/descargas/Video-Maker-arm64.dmg',
  sha256: 'abc',
  publishedAt: '2026-11-13T12:00:00.000Z',
};

function withManifest(manifest: unknown, installed = '0.3.2') {
  return handleGetAppUpdate({
    env: { VIDEO_MAKER_APP_VERSION: installed },
    fetchManifest: async () => manifest,
  });
}

describe('handleGetAppUpdate', () => {
  it('reports an available update with the download url and publication date', async () => {
    const response = await withManifest(MANIFEST);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe(JSON_CONTENT_TYPE);
    expect(response.body as AppUpdateBody).toEqual({
      status: 'available',
      installedVersion: '0.3.2',
      latestVersion: '0.4.0',
      downloadUrl: MANIFEST.url,
      publishedAt: MANIFEST.publishedAt,
    });
  });

  it('reports up-to-date when the installed version matches the manifest', async () => {
    const body = (await withManifest(MANIFEST, '0.4.0')).body as AppUpdateBody;

    expect(body.status).toBe('up-to-date');
    expect(body.latestVersion).toBe('0.4.0');
    expect(body.downloadUrl).toBeUndefined();
  });

  it('reports up-to-date when the installed version is newer than the manifest', async () => {
    expect(((await withManifest(MANIFEST, '0.5.0')).body as AppUpdateBody).status).toBe('up-to-date');
  });

  it('answers unknown, not an error, when the network fails', async () => {
    const response = await handleGetAppUpdate({
      env: { VIDEO_MAKER_APP_VERSION: '0.3.2' },
      fetchManifest: async () => {
        throw new Error('offline');
      },
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'unknown', installedVersion: '0.3.2' });
  });

  it('answers unknown when the manifest is invalid', async () => {
    for (const invalid of [null, 'text', {}, { version: 3, url: 'x' }, { version: '0.4.0', url: 'javascript:alert(1)' }]) {
      expect(((await withManifest(invalid)).body as AppUpdateBody).status).toBe('unknown');
    }
  });

  it('answers unknown when the manifest version is not numeric', async () => {
    expect(((await withManifest({ ...MANIFEST, version: 'latest' })).body as AppUpdateBody).status).toBe('unknown');
  });

  it('reads the default url and lets an env var override it', async () => {
    const urls: string[] = [];
    const record = async (url: string) => {
      urls.push(url);
      return MANIFEST;
    };

    await handleGetAppUpdate({ env: {}, fetchManifest: record });
    await handleGetAppUpdate({ env: { [UPDATE_MANIFEST_URL_ENV_VAR]: 'http://127.0.0.1:9/latest.json' }, fetchManifest: record });

    expect(urls).toEqual([DEFAULT_UPDATE_MANIFEST_URL, 'http://127.0.0.1:9/latest.json']);
  });
});
