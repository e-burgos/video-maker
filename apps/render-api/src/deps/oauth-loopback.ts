import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import type { OAuthLoopbackHandle, StartOAuthLoopbackInput } from './render-api-dependencies';

const LOOPBACK_HOST = '127.0.0.1';
const HTML_CONTENT_TYPE = 'text/html; charset=utf-8';
const PAGE_NOT_FOUND = 'No encontrado';

function queryOf(rawUrl: string | undefined): Readonly<Record<string, string>> {
  const parsed = new URL(rawUrl ?? '/', `http://${LOOPBACK_HOST}`);
  const query: Record<string, string> = {};
  parsed.searchParams.forEach((value, key) => {
    query[key] = value;
  });
  return query;
}

function hasOAuthParameters(query: Readonly<Record<string, string>>): boolean {
  return query.code !== undefined || query.error !== undefined;
}

export async function startOAuthLoopbackServer(input: StartOAuthLoopbackInput): Promise<OAuthLoopbackHandle> {
  let server: Server | null = null;
  let timer: NodeJS.Timeout | null = null;

  const close = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (server !== null) {
      server.close();
      server.closeAllConnections();
      server = null;
    }
  };

  const created = createServer((request, response) => {
    const query = queryOf(request.url);
    if (!hasOAuthParameters(query)) {
      response.writeHead(404, { 'content-type': HTML_CONTENT_TYPE });
      response.end(PAGE_NOT_FOUND);
      return;
    }
    void input
      .handler(query)
      .then((html) => {
        response.writeHead(200, { 'content-type': HTML_CONTENT_TYPE });
        response.end(html);
      })
      .catch(() => {
        response.writeHead(500, { 'content-type': HTML_CONTENT_TYPE });
        response.end(PAGE_NOT_FOUND);
      })
      .finally(close);
  });
  server = created;

  await new Promise<void>((resolve, reject) => {
    created.once('error', reject);
    created.listen(0, LOOPBACK_HOST, () => resolve());
  });

  timer = setTimeout(close, input.timeoutMs);
  timer.unref();

  return { port: (created.address() as AddressInfo).port, close };
}
