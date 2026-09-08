import { PipelineStageError } from '../errors/pipeline-stage-error';

export const DEFAULT_HOST = '127.0.0.1';
export const DEFAULT_PORT = 4310;
export const HOST_ENV_VAR = 'RENDER_API_HOST';
export const PORT_ENV_VAR = 'RENDER_API_PORT';

const MIN_PORT = 0;
const MAX_PORT = 65535;

export interface ServerConfig {
  readonly host: string;
  readonly port: number;
}

function readHost(env: NodeJS.ProcessEnv): string {
  const value = env[HOST_ENV_VAR];
  return value !== undefined && value !== '' ? value : DEFAULT_HOST;
}

function readPort(env: NodeJS.ProcessEnv): number {
  const raw = env[PORT_ENV_VAR];
  if (raw === undefined || raw === '') {
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
  return { host: readHost(env), port: readPort(env) };
}
