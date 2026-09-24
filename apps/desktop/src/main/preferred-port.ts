import { createServer } from 'node:net';

import { getFreePort } from './free-port';

export const PREFERRED_PORT_RANGE_MIN = 42000;
export const PREFERRED_PORT_RANGE_MAX = 42999;

const MAX_RANGE_ATTEMPTS = 5;

export function randomPortInRange(
  min: number = PREFERRED_PORT_RANGE_MIN,
  max: number = PREFERRED_PORT_RANGE_MAX,
): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

export type PortAvailabilityCheck = (host: string, port: number) => Promise<boolean>;

export const defaultIsPortFree: PortAvailabilityCheck = (host, port) =>
  new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.listen(port, host, () => {
      server.close(() => resolve(true));
    });
  });

export interface ResolvePreferredPortDeps {
  readonly isPortFree?: PortAvailabilityCheck;
  readonly getFreePortFn?: (host: string) => Promise<number>;
  readonly randomPort?: () => number;
}

export async function resolvePreferredPort(
  host: string,
  storedPort: number | null,
  deps: ResolvePreferredPortDeps = {},
): Promise<number> {
  const isPortFree = deps.isPortFree ?? defaultIsPortFree;
  const getFreePortFn = deps.getFreePortFn ?? getFreePort;
  const randomPort = deps.randomPort ?? randomPortInRange;

  if (storedPort !== null && (await isPortFree(host, storedPort))) {
    return storedPort;
  }

  for (let attempt = 0; attempt < MAX_RANGE_ATTEMPTS; attempt += 1) {
    const candidate = randomPort();
    if (await isPortFree(host, candidate)) {
      return candidate;
    }
  }

  return getFreePortFn(host);
}
