import { once } from 'node:events';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import type { ProducerConfig } from '../config/producer-config';
import type { ServerConfig } from '../config/server-config';
import type { StoreConfig } from '../config/store-config';
import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import { toErrorPayload } from '../errors/to-error-payload';
import { handleRequest } from './handle-request';
import { JSON_CONTENT_TYPE } from './http-message';
import type { HttpRequestLine, HttpResponse } from './http-message';
import { createRenderApiRuntime } from './render-api-runtime';

const PATH_PARSE_BASE = 'http://render-api.invalid';

export interface ServerAddress {
  readonly host: string;
  readonly port: number;
}

export interface RenderApiServer {
  readonly listen: () => Promise<ServerAddress>;
  readonly close: () => Promise<void>;
}

function toHeaders(incoming: IncomingMessage): Readonly<Record<string, string>> {
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(incoming.headers)) {
    if (value === undefined) {
      continue;
    }
    headers[name] = Array.isArray(value) ? value.join(', ') : value;
  }
  return headers;
}

function toRequestLine(incoming: IncomingMessage): HttpRequestLine {
  const requested = new URL(incoming.url ?? '/', PATH_PARSE_BASE);
  return {
    method: incoming.method ?? 'GET',
    path: `${requested.pathname}${requested.search}`,
    headers: toHeaders(incoming),
    body: { stream: () => incoming },
  };
}

async function writeResponse(response: HttpResponse, outgoing: ServerResponse): Promise<void> {
  outgoing.writeHead(response.status, response.headers);

  if (response.stream === undefined) {
    outgoing.end(JSON.stringify(response.body));
    return;
  }

  for await (const chunk of response.stream()) {
    if (!outgoing.write(chunk)) {
      await once(outgoing, 'drain');
    }
  }
  outgoing.end();
}

export function createRenderApiServer(
  deps: RenderApiDependencies,
  config: ServerConfig,
  store: StoreConfig,
  producer?: ProducerConfig,
): RenderApiServer {
  const runtime = createRenderApiRuntime(deps, producer, store);
  const server = createServer((incoming, outgoing) => {
    void (async () => {
      try {
        const response = await handleRequest(toRequestLine(incoming), deps, store, runtime, config);
        await writeResponse(response, outgoing);
      } catch (cause) {
        const error = toErrorPayload(cause);
        await writeResponse(
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
          runtime.publishQueue.start();
          const address = server.address() as AddressInfo;
          resolve({ host: address.address, port: address.port });
        });
      }),

    close: () => {
      runtime.publishQueue.stop();
      runtime.producerTurns.cancelAll();
      return new Promise((resolve, reject) => {
        server.close((cause) => {
          if (cause) {
            reject(cause);
            return;
          }
          deps.localStore.close();
          resolve();
        });
      });
    },
  };
}
