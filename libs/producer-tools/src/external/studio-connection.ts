import { StudioToolRuntimeError } from '../errors/studio-tool-runtime-error';
import { StudioNotFoundError, resolveStudioEndpoint } from './studio-endpoint';
import type { StudioEndpoint } from './studio-endpoint';

export interface StudioConnection {
  endpoint(): Promise<StudioEndpoint>;
  invalidate(): void;
}

export interface StudioConnectionOptions {
  readonly apiUrlArgument: string | null;
  readonly env: NodeJS.ProcessEnv;
  readonly fetchImpl?: typeof fetch;
  readonly isProcessAlive?: (pid: number) => boolean;
}

export function createStudioConnection(options: StudioConnectionOptions): StudioConnection {
  let cached: Promise<StudioEndpoint> | null = null;

  return {
    endpoint: () => {
      cached ??= resolveStudioEndpoint({
        apiUrlArgument: options.apiUrlArgument,
        env: options.env,
        ...(options.fetchImpl === undefined ? {} : { fetchImpl: options.fetchImpl }),
        ...(options.isProcessAlive === undefined ? {} : { isProcessAlive: options.isProcessAlive }),
      }).catch((cause: unknown) => {
        cached = null;
        throw cause instanceof StudioNotFoundError ? new StudioToolRuntimeError('STUDIO_UNAVAILABLE', cause.message) : cause;
      });
      return cached;
    },
    invalidate: () => {
      cached = null;
    },
  };
}
