import { PipelineStageError } from '../errors/pipeline-stage-error';

export const DEFAULT_HOST = '127.0.0.1';
export const DEFAULT_PORT = 4310;
export const HOST_ENV_VAR = 'RENDER_API_HOST';
export const PORT_ENV_VAR = 'RENDER_API_PORT';
export const WEB_ROOT_ENV_VAR = 'RENDER_API_WEB_ROOT';
export const ACCESS_TOKEN_ENV_VAR = 'RENDER_API_ACCESS_TOKEN';

const MIN_PORT = 0;
const MAX_PORT = 65535;

export interface ServerConfig {
  readonly host: string;
  readonly port: number;
  readonly webRoot: string | null;
  readonly accessToken: string | null;
}

function readNonEmpty(env: NodeJS.ProcessEnv, name: string): string | null {
  const value = env[name];
  return value === undefined || value === '' ? null : value;
}

function readHost(env: NodeJS.ProcessEnv): string {
  return readNonEmpty(env, HOST_ENV_VAR) ?? DEFAULT_HOST;
}

function readPort(env: NodeJS.ProcessEnv): number {
  const raw = readNonEmpty(env, PORT_ENV_VAR);
  if (raw === null) {
    return DEFAULT_PORT;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < MIN_PORT || parsed > MAX_PORT) {
    throw new PipelineStageError({
      code: 'SERVER_CONFIG_INVALID',
      stage: null,
      resource: PORT_ENV_VAR,
      expected: `integer between ${MIN_PORT} and ${MAX_PORT}`,
    });
  }

  return parsed;
}

export function readServerConfig(env: NodeJS.ProcessEnv): ServerConfig {
  return {
    host: readHost(env),
    port: readPort(env),
    webRoot: readNonEmpty(env, WEB_ROOT_ENV_VAR),
    accessToken: readNonEmpty(env, ACCESS_TOKEN_ENV_VAR),
  };
}
