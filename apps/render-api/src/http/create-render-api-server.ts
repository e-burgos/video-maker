import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import type { ServerConfig } from '../config/server-config';
import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import { toErrorPayload } from '../errors/to-error-payload';
import { handleRequest } from './handle-request';
import { JSON_CONTENT_TYPE } from './http-message';
import type { HttpRequestLine, HttpResponse } from './http-message';

const PATH_PARSE_BASE = 'http://render-api.invalid';

export interface ServerAddress {
  readonly host: string;
  readonly port: number;
}

export interface RenderApiServer {
  readonly listen: () => Promise<ServerAddress>;
  readonly close: () => Promise<void>;
}

function toRequestLine(incoming: IncomingMessage): HttpRequestLine {
  const pathname = new URL(incoming.url ?? '/', PATH_PARSE_BASE).pathname;
  return { method: incoming.method ?? 'GET', path: pathname };
}

function writeResponse(response: HttpResponse, outgoing: ServerResponse): void {
  outgoing.writeHead(response.status, response.headers);
  outgoing.end(JSON.stringify(response.body));
}

export function createRenderApiServer(
  deps: RenderApiDependencies,
  config: ServerConfig,
): RenderApiServer {
  const server = createServer((incoming, outgoing) => {
    void (async () => {
      try {
        const response = await handleRequest(toRequestLine(incoming), deps);
        writeResponse(response, outgoing);
      } catch (cause) {
        const error = toErrorPayload(cause);
        writeResponse(
          { status: 500, headers: { 'content-type': JSON_CONTENT_TYPE }, body: { error } },
          outgoing,
        );
      }
    })();
  });

  return {
    listen: () =>
      new Promise((resolve) => {
        server.listen(config.port, config.host, () => {
          const address = server.address() as AddressInfo;
          resolve({ host: address.address, port: address.port });
        });
      }),

    close: () =>
      new Promise((resolve, reject) => {
        server.close((cause) => {
          if (cause) {
            reject(cause);
            return;
          }
          resolve();
        });
      }),
  };
}
