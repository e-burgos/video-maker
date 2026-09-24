import { PipelineStageError } from '../errors/pipeline-stage-error';
import { AI_AGENT_BINARY_ENV_VAR, AI_AGENT_CWD_ENV_VAR, DEFAULT_AI_AGENT_BINARY } from './ai-agent-config';

export const PRODUCER_MODEL_ENV_VAR = 'PRODUCER_MODEL';
export const PRODUCER_MODELS_ENV_VAR = 'PRODUCER_MODELS';
export const PRODUCER_TURN_TIMEOUT_ENV_VAR = 'PRODUCER_TURN_TIMEOUT_MS';
export const PRODUCER_API_URL_ENV_VAR = 'RENDER_API_URL';
export const PRODUCER_ACCESS_TOKEN_ENV_VAR = 'RENDER_API_ACCESS_TOKEN';
export const STUDIO_MCP_ENTRY_ENV_VAR = 'STUDIO_MCP_ENTRY';

export const DEFAULT_PRODUCER_MODEL = 'sonnet';
export const DEFAULT_PRODUCER_MODELS = ['sonnet', 'opus', 'haiku'] as const;

export const DEFAULT_PRODUCER_TURN_TIMEOUT_MS = 1_800_000;

const PRODUCER_MODEL_CATALOG: Readonly<Record<string, { label: string; description: string }>> = {
  sonnet: { label: 'Sonnet', description: 'Balanced · faster, cheaper' },
  opus: { label: 'Opus', description: 'Most capable · slower, costlier' },
  haiku: { label: 'Haiku', description: 'Fastest · lightest' },
};

export interface ProducerModelOption {
  readonly id: string;
  readonly label: string;
  readonly description: string;
}

export function describeProducerModel(id: string): ProducerModelOption {
  const known = PRODUCER_MODEL_CATALOG[id];
  return known === undefined
    ? { id, label: id, description: 'Model alias configured for this server' }
    : { id, label: known.label, description: known.description };
}

export interface ProducerConfig {
  readonly binaryPath: string;
  readonly workingDirectory: string;
  readonly cliCwdBase: string;
  readonly model: string;
  readonly models: readonly string[];
  readonly timeoutMs: number;
  readonly apiUrl: string;
  readonly accessToken: string | null;
  readonly studioMcpEntryPath: string | null;
}

function readNonEmpty(env: NodeJS.ProcessEnv, name: string): string | null {
  const value = env[name];
  return value === undefined || value === '' ? null : value;
}

function readModels(env: NodeJS.ProcessEnv): readonly string[] {
  const raw = readNonEmpty(env, PRODUCER_MODELS_ENV_VAR);
  if (raw === null) {
    return [...DEFAULT_PRODUCER_MODELS];
  }

  const models = [...new Set(raw.split(',').map((entry) => entry.trim()).filter((entry) => entry !== ''))];
  if (models.length === 0) {
    throw new PipelineStageError({
      code: 'SERVER_CONFIG_INVALID',
      stage: null,
      resource: PRODUCER_MODELS_ENV_VAR,
      expected: 'a comma separated list of model aliases',
    });
  }

  return models;
}

function readTimeoutMs(env: NodeJS.ProcessEnv): number {
  const raw = readNonEmpty(env, PRODUCER_TURN_TIMEOUT_ENV_VAR);
  if (raw === null) {
    return DEFAULT_PRODUCER_TURN_TIMEOUT_MS;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new PipelineStageError({
      code: 'SERVER_CONFIG_INVALID',
      stage: null,
      resource: PRODUCER_TURN_TIMEOUT_ENV_VAR,
      expected: 'a positive integer number of milliseconds',
    });
  }

  return parsed;
}

export function readProducerConfig(
  env: NodeJS.ProcessEnv,
  workingDirectory: string,
  fallbackApiUrl: string,
  neutralCwdBase: string,
): ProducerConfig {
  const models = readModels(env);
  const model = readNonEmpty(env, PRODUCER_MODEL_ENV_VAR) ?? DEFAULT_PRODUCER_MODEL;
  if (!models.includes(model)) {
    throw new PipelineStageError({
      code: 'SERVER_CONFIG_INVALID',
      stage: null,
      resource: PRODUCER_MODEL_ENV_VAR,
      expected: `one of ${models.join(', ')}`,
    });
  }

  return {
    binaryPath: readNonEmpty(env, AI_AGENT_BINARY_ENV_VAR) ?? DEFAULT_AI_AGENT_BINARY,
    workingDirectory,
    cliCwdBase: readNonEmpty(env, AI_AGENT_CWD_ENV_VAR) ?? neutralCwdBase,
    model,
    models,
    timeoutMs: readTimeoutMs(env),
    apiUrl: readNonEmpty(env, PRODUCER_API_URL_ENV_VAR) ?? fallbackApiUrl,
    accessToken: readNonEmpty(env, PRODUCER_ACCESS_TOKEN_ENV_VAR),
    studioMcpEntryPath: readNonEmpty(env, STUDIO_MCP_ENTRY_ENV_VAR),
  };
}
