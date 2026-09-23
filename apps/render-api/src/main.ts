import { tmpdir } from 'node:os';

import { readProducerConfig } from './config/producer-config';
import { readServerConfig } from './config/server-config';
import { readStoreConfig } from './config/store-config';
import { createNodeRenderApiDependencies } from './deps/node-render-api-dependencies';
import { toErrorPayload } from './errors/to-error-payload';
import { isRenderApiError } from './errors/render-api-error';
import { createRenderApiServer } from './http/create-render-api-server';

const SHUTDOWN_SIGNALS = ['SIGINT', 'SIGTERM'] as const;
const CONFIG_EXIT_CODE = 78;

function isServerConfigError(cause: unknown): boolean {
  return isRenderApiError(cause) && cause.code === 'SERVER_CONFIG_INVALID';
}

async function main(): Promise<void> {
  const config = readServerConfig(process.env);
  const store = readStoreConfig(process.env, process.cwd());
  const deps = createNodeRenderApiDependencies(process.env, store);

  await deps.preloadEngineModules();

  const producer = readProducerConfig(
    process.env,
    process.cwd(),
    `http://${config.host}:${config.port}`,
    tmpdir(),
  );
  const server = createRenderApiServer(deps, config, store, producer);
  const address = await server.listen();

  process.stdout.write(`${JSON.stringify({ event: 'listening', host: address.host, port: address.port })}\n`);

  for (const signal of SHUTDOWN_SIGNALS) {
    process.once(signal, () => {
      void server.close().then(() => {
        process.exitCode = 0;
      });
    });
  }
}

void main().catch((cause: unknown) => {
  process.stderr.write(`${JSON.stringify({ event: 'startup-failed', error: toErrorPayload(cause) })}\n`);
  process.exitCode = isServerConfigError(cause) ? CONFIG_EXIT_CODE : 1;
});
