import { PipelineStageError } from '../errors/pipeline-stage-error';
import { AI_AGENT_BINARY_ENV_VAR, DEFAULT_AI_AGENT_BINARY } from './ai-agent-config';

export const PRODUCER_MODEL_ENV_VAR = 'PRODUCER_MODEL';
export const PRODUCER_TURN_TIMEOUT_ENV_VAR = 'PRODUCER_TURN_TIMEOUT_MS';
export const PRODUCER_SKILL_PATH_ENV_VAR = 'PRODUCER_SKILL_PATH';
export const PRODUCER_API_URL_ENV_VAR = 'RENDER_API_URL';

export const DEFAULT_PRODUCER_MODEL = 'sonnet';
export const DEFAULT_PRODUCER_TURN_TIMEOUT_MS = 1_800_000;
export const DEFAULT_PRODUCER_SKILL_PATH = 'sdd/skills/video-producer/SKILL.md';

export interface ProducerConfig {
  readonly binaryPath: string;
  readonly workingDirectory: string;
  readonly model: string;
  readonly timeoutMs: number;
  readonly skillPath: string;
  readonly apiUrl: string;
}

function readNonEmpty(env: NodeJS.ProcessEnv, name: string): string | null {
  const value = env[name];
  return value === undefined || value === '' ? null : value;
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
): ProducerConfig {
  return {
    binaryPath: readNonEmpty(env, AI_AGENT_BINARY_ENV_VAR) ?? DEFAULT_AI_AGENT_BINARY,
    workingDirectory,
    model: readNonEmpty(env, PRODUCER_MODEL_ENV_VAR) ?? DEFAULT_PRODUCER_MODEL,
    timeoutMs: readTimeoutMs(env),
    skillPath: readNonEmpty(env, PRODUCER_SKILL_PATH_ENV_VAR) ?? DEFAULT_PRODUCER_SKILL_PATH,
    apiUrl: readNonEmpty(env, PRODUCER_API_URL_ENV_VAR) ?? fallbackApiUrl,
  };
}
