import { describe, expect, it } from 'vitest';

import { handleStaticWeb } from './static-web-handler';
import type { StaticFileSystem } from './static-web-handler';

const WEB_ROOT = '/app/resources/web';

function fakeFileSystem(files: Readonly<Record<string, string>>): StaticFileSystem {
  return {
    stat: (path) => {
      const content = files[path];
      return Promise.resolve(content === undefined ? null : { sizeBytes: content.length });
    },
    openReadStream: (path) => {
      const content = files[path] ?? '';
      return (async function* stream() {
        yield new TextEncoder().encode(content);
      })();
    },
  };
}

async function readAll(response: Awaited<ReturnType<typeof handleStaticWeb>>): Promise<string> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.stream?.() ?? []) {
    chunks.push(chunk);
  }
  return new TextDecoder().decode(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))));
}

describe('handleStaticWeb (D-C3-03)', () => {
  it('serves index.html for / with no-cache', async () => {
    const fs = fakeFileSystem({ [`${WEB_ROOT}/index.html`]: '<html>root</html>' });

    const response = await handleStaticWeb(WEB_ROOT, '/', fs);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(response.headers['cache-control']).toBe('no-cache');
    expect(await readAll(response)).toBe('<html>root</html>');
  });

  it('serves an existing hashed asset with a long-lived immutable cache header', async () => {
    const fs = fakeFileSystem({
      [`${WEB_ROOT}/index.html`]: '<html>root</html>',
      [`${WEB_ROOT}/assets/index-abc123.js`]: 'console.log(1)',
    });

    const response = await handleStaticWeb(WEB_ROOT, '/assets/index-abc123.js', fs);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('text/javascript; charset=utf-8');
    expect(response.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(await readAll(response)).toBe('console.log(1)');
  });

  it('falls back to index.html for a client-side route that is not a real file (SPA fallback)', async () => {
    const fs = fakeFileSystem({ [`${WEB_ROOT}/index.html`]: '<html>root</html>' });

    const response = await handleStaticWeb(WEB_ROOT, '/projects/acme-launch', fs);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(response.headers['cache-control']).toBe('no-cache');
    expect(await readAll(response)).toBe('<html>root</html>');
  });

  it('rejects a path that escapes webRoot with .. instead of serving a host file', async () => {
    const fs = fakeFileSystem({
      [`${WEB_ROOT}/index.html`]: '<html>root</html>',
      '/etc/passwd': 'root:x:0:0',
    });

    const response = await handleStaticWeb(WEB_ROOT, '/../../../../etc/passwd', fs);

    expect(response.status).toBe(200);
    expect(await readAll(response)).toBe('<html>root</html>');
  });

  it('rejects an absolute-looking escape path the same way', async () => {
    const fs = fakeFileSystem({ [`${WEB_ROOT}/index.html`]: '<html>root</html>' });

    const response = await handleStaticWeb(WEB_ROOT, '/%2e%2e/%2e%2e/etc/passwd', fs);

    expect(response.status).toBe(200);
    expect(await readAll(response)).toBe('<html>root</html>');
  });

  it('throws STATIC_WEB_NOT_FOUND when RENDER_API_WEB_ROOT has no index.html at all', async () => {
    const fs = fakeFileSystem({});

    await expect(handleStaticWeb(WEB_ROOT, '/', fs)).rejects.toMatchObject({
      code: 'STATIC_WEB_NOT_FOUND',
    });
  });

  it('decodes a percent-encoded asset path before resolving it', async () => {
    const fs = fakeFileSystem({
      [`${WEB_ROOT}/index.html`]: '<html>root</html>',
      [`${WEB_ROOT}/assets/logo copy.png`]: 'binary',
    });

    const response = await handleStaticWeb(WEB_ROOT, '/assets/logo%20copy.png', fs);

    expect(response.status).toBe(200);
    expect(await readAll(response)).toBe('binary');
  });
});
