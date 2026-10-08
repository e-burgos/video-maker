import { describe, expect, it } from 'vitest';

import { createCallLog } from '../__fixtures__/call-log';
import { createFakeFetchRemote, textBodyChunks } from '../__fixtures__/fake-fetch-remote';
import type { FakeFetchRemoteAnswer, FakeFetchRemoteRoute } from '../__fixtures__/fake-fetch-remote';
import { createFakeObjectStorage } from '../__fixtures__/fake-object-storage';
import { createFakeRenderApiDependencies } from '../__fixtures__/fake-render-api-dependencies';
import { requestLine } from '../__fixtures__/http-request';
import type { ServerConfig } from '../config/server-config';
import type { StoreConfig } from '../config/store-config';
import { httpStatusFor } from '../errors/http-status-for';
import { toErrorPayload } from '../errors/to-error-payload';
import { handleRequest } from '../http/handle-request';
import { handlePostBrandFont } from '../http/handlers/brands-handler';
import { createRenderApiRuntime } from '../http/render-api-runtime';
import type { BrandDetail } from './brand-library';

const STORE: StoreConfig = {
  mediaRoot: '/media',
  dbPath: '/media/.studio/studio.db',
  maxUploadBytes: 2_147_483_648,
  objectStore: 'fs',
  motionAssetsRoot: '/assets',
  brandsRoot: '/brands',
};
const CONFIG: ServerConfig = { host: '127.0.0.1', port: 4310, webRoot: null, accessToken: null };

const USER_MANIFEST = {
  id: 'mine',
  name: 'Mine',
  spokenName: 'Mine',
  tagline: 'Hecho a mano.',
  logo: 'img/logo.svg',
  palette: { background: '#101820', accent: '#ff5500', accent2: '#00aaff', text: '#ffffff' },
  typography: { display: 'Outfit', body: 'Outfit' },
  fonts: [
    { family: 'Outfit', file: 'fonts/outfit.woff2' },
    { family: 'Poppins', file: 'fonts/old-poppins.woff2' },
  ],
  devices: {},
  images: {},
  music: [],
  voice: { id: 'es_AR-daniela-high', lengthScale: 1.08 },
};
const BUILT_IN_MANIFEST = { ...USER_MANIFEST, id: 'builtin', fonts: [{ family: 'Outfit', file: 'fonts/outfit.woff2' }], typography: undefined };

const WOFF2 = new Uint8Array([0x77, 0x4f, 0x46, 0x32, 1, 2, 3]);
const VARIABLE_CSS = `/* cyrillic */
@font-face {
  font-family: 'Poppins';
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/poppins/v1/cyr.woff2) format('woff2');
  unicode-range: U+0400-045F;
}
/* latin-ext */
@font-face {
  font-family: 'Poppins';
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/poppins/v1/ext.woff2) format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5;
}
/* latin */
@font-face {
  font-family: 'Poppins';
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/poppins/v1/lat.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131;
}
`;
const STATIC_CSS = `/* latin */
@font-face {
  font-family: 'Pacifico';
  font-style: normal;
  font-weight: 400;
  src: url(https://fonts.gstatic.com/s/pacifico/v1/a.woff2) format('woff2');
  unicode-range: U+0000-00FF;
}
/* latin */
@font-face {
  font-family: 'Pacifico';
  font-style: normal;
  font-weight: 700;
  src: url(https://fonts.gstatic.com/s/pacifico/v1/b.woff2) format('woff2');
  unicode-range: U+0000-00FF;
}
`;

function stylesheet(css: string): FakeFetchRemoteRoute {
  return { status: 200, bodyChunks: textBodyChunks(css) };
}

function googleAnswering(css: (url: string) => FakeFetchRemoteRoute | Error): FakeFetchRemoteAnswer {
  return ({ url }) => (url.startsWith('https://fonts.gstatic.com/') ? { status: 200, bodyChunks: [WOFF2] } : css(url));
}

function setup(answer: FakeFetchRemoteRoute | Error | FakeFetchRemoteAnswer) {
  const callLog = createCallLog();
  const storage = createFakeObjectStorage(callLog, {
    files: [
      { path: '/brands/mine/brand.json', contents: JSON.stringify(USER_MANIFEST) },
      { path: '/brands/mine/img/logo.svg', contents: '<svg/>' },
      { path: '/brands/mine/fonts/outfit.woff2', contents: 'font' },
      { path: '/brands/mine/fonts/old-poppins.woff2', contents: 'old' },
      { path: '/assets/brands/builtin/brand.json', contents: JSON.stringify(BUILT_IN_MANIFEST) },
      { path: '/assets/brands/builtin/fonts/outfit.woff2', contents: 'font' },
    ],
  });
  const remote = createFakeFetchRemote(answer, callLog);
  const deps = createFakeRenderApiDependencies(callLog, { storage, fetchRemote: remote.fetchRemote });
  return { deps, storage, remote };
}

function jsonRequest(value: unknown) {
  async function* body(): AsyncGenerator<Uint8Array> {
    yield new TextEncoder().encode(JSON.stringify(value));
  }
  return requestLine({ method: 'POST', path: '/brands/mine/fonts', body: body() });
}

async function caught(promise: Promise<unknown>): Promise<ReturnType<typeof toErrorPayload>> {
  return promise.then(
    () => {
      throw new Error('expected the handler to reject');
    },
    (error: unknown) => toErrorPayload(error),
  );
}

describe('POST /brands/:id/fonts', () => {
  it('downloads the latin and latin-ext woff2 of a variable family and replaces only that family in the manifest', async () => {
    const { deps, storage, remote } = setup(googleAnswering(() => stylesheet(VARIABLE_CSS)));

    const response = await handlePostBrandFont(deps, STORE, { id: 'mine' }, jsonRequest({ family: 'Poppins' }));
    const body = response.body as BrandDetail;

    expect(response.status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(['files', 'id', 'manifest', 'source', 'tokens']);
    expect(body.manifest.fonts).toEqual([
      { family: 'Outfit', file: 'fonts/outfit.woff2' },
      { family: 'Poppins', file: 'fonts/poppins-latin-ext.woff2', weight: '100 900', unicodeRange: 'U+0100-02BA, U+02BD-02C5' },
      { family: 'Poppins', file: 'fonts/poppins-latin.woff2', weight: '100 900', unicodeRange: 'U+0000-00FF, U+0131' },
    ]);
    expect(body.files.fonts).toEqual(['fonts/outfit.woff2', 'fonts/poppins-latin-ext.woff2', 'fonts/poppins-latin.woff2']);
    expect(await storage.stat('/brands/mine/fonts/old-poppins.woff2')).toBeNull();
    expect(remote.calls[0]?.url).toBe('https://fonts.googleapis.com/css2?family=Poppins:wght@100..900&display=swap');
    expect(remote.calls[0]?.init.headers?.['user-agent']).toContain('Chrome/');
    expect(remote.calls).toHaveLength(3);
    expect(JSON.parse(await storage.readTextFile('/brands/mine/brand.json'))).toMatchObject({ typography: { display: 'Outfit' } });
  });

  it('retries with the 400 and 700 static weights when the variable range is refused', async () => {
    const { deps, remote } = setup(googleAnswering((url) => (url.includes('100..900') ? { status: 400 } : stylesheet(STATIC_CSS))));

    const body = (await handlePostBrandFont(deps, STORE, { id: 'mine' }, jsonRequest({ family: 'Pacifico' }))).body as BrandDetail;

    expect(remote.calls[1]?.url).toBe('https://fonts.googleapis.com/css2?family=Pacifico:wght@400;700&display=swap');
    expect(body.manifest.fonts.filter((font) => font.family === 'Pacifico').map((font) => [font.file, font.weight])).toEqual([
      ['fonts/pacifico-latin-400.woff2', '400'],
      ['fonts/pacifico-latin-700.woff2', '700'],
    ]);
  });

  it('falls back to the plain family request for a family with a single weight', async () => {
    const { deps, remote } = setup(googleAnswering((url) => (url.includes('wght') ? { status: 400 } : stylesheet(STATIC_CSS))));

    await handlePostBrandFont(deps, STORE, { id: 'mine' }, jsonRequest({ family: 'Pacifico' }));

    expect(remote.calls[2]?.url).toBe('https://fonts.googleapis.com/css2?family=Pacifico&display=swap');
  });

  it('answers BRAND_FONT_UNKNOWN with 422 when Google refuses every request', async () => {
    const { deps, storage } = setup({ status: 400 });

    const error = await caught(handlePostBrandFont(deps, STORE, { id: 'mine' }, jsonRequest({ family: 'Nope Nope' })));

    expect(error.code).toBe('BRAND_FONT_UNKNOWN');
    expect(httpStatusFor(error.code)).toBe(422);
    expect(JSON.parse(await storage.readTextFile('/brands/mine/brand.json'))).toMatchObject({ fonts: USER_MANIFEST.fonts });
  });

  it('answers BRAND_FONT_DOWNLOAD_FAILED with 502 on a network error, a bad status or a file that is not woff2', async () => {
    const network = await caught(handlePostBrandFont(setup(new Error('offline')).deps, STORE, { id: 'mine' }, jsonRequest({ family: 'Poppins' })));
    const status = await caught(handlePostBrandFont(setup({ status: 503 }).deps, STORE, { id: 'mine' }, jsonRequest({ family: 'Poppins' })));
    const notWoff2 = await caught(
      handlePostBrandFont(
        setup(({ url }) => (url.startsWith('https://fonts.gstatic.com/') ? { status: 200, bodyChunks: textBodyChunks('<html>') } : stylesheet(VARIABLE_CSS))).deps,
        STORE,
        { id: 'mine' },
        jsonRequest({ family: 'Poppins' }),
      ),
    );

    for (const error of [network, status, notWoff2]) {
      expect(error.code).toBe('BRAND_FONT_DOWNLOAD_FAILED');
      expect(httpStatusFor(error.code)).toBe(502);
    }
  });

  it('refuses to download from a host other than fonts.gstatic.com', async () => {
    const foreign = VARIABLE_CSS.replaceAll('fonts.gstatic.com', 'evil.example.com');
    const { deps, remote } = setup(googleAnswering(() => stylesheet(foreign)));

    const error = await caught(handlePostBrandFont(deps, STORE, { id: 'mine' }, jsonRequest({ family: 'Poppins' })));

    expect(error.code).toBe('BRAND_FONT_DOWNLOAD_FAILED');
    expect(remote.calls.every((call) => call.url.startsWith('https://fonts.googleapis.com/'))).toBe(true);
  });

  it('answers BRAND_READ_ONLY for a built-in brand, BRAND_UNKNOWN for a missing one and INVALID_INPUT for a bad family', async () => {
    const { deps } = setup(googleAnswering(() => stylesheet(VARIABLE_CSS)));
    const post = (id: string, value: unknown) => handlePostBrandFont(deps, STORE, { id }, jsonRequest(value));

    const readOnly = await caught(post('builtin', { family: 'Poppins' }));
    const unknown = await caught(post('nope', { family: 'Poppins' }));
    const invalid = await Promise.all([{ family: 'P' }, { family: 'Poppins; drop' }, { family: 3 }, {}].map((value) => caught(post('mine', value))));

    expect(readOnly.code).toBe('BRAND_READ_ONLY');
    expect(unknown.code).toBe('BRAND_UNKNOWN');
    for (const error of invalid) expect(error.code).toBe('INVALID_INPUT');
  });

  it('is reachable through handleRequest', async () => {
    const { deps } = setup(googleAnswering(() => stylesheet(VARIABLE_CSS)));
    const runtime = createRenderApiRuntime(deps);

    const response = await handleRequest(jsonRequest({ family: 'Poppins' }), deps, STORE, runtime, CONFIG);

    expect(response.status).toBe(200);
  });
});
