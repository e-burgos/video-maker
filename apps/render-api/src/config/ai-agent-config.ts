import { PipelineStageError } from '../errors/pipeline-stage-error';

export const AI_AGENT_BINARY_ENV_VAR = 'CLAUDE_CLI_PATH';
export const AI_AGENT_CWD_ENV_VAR = 'CLAUDE_CLI_CWD';
export const AI_AGENT_TIMEOUT_ENV_VAR = 'CLAUDE_CLI_TIMEOUT_MS';
export const AI_AGENT_MODEL_ENV_VAR = 'CLAUDE_CLI_MODEL';

export const DEFAULT_AI_AGENT_BINARY = 'claude';
export const DEFAULT_AI_AGENT_TIMEOUT_MS = 600_000;

export interface AiAgentConfig {
  readonly binaryPath: string;
  readonly workingDirectory: string;
  readonly timeoutMs: number;
  readonly model: string | null;
}

function readNonEmpty(env: NodeJS.ProcessEnv, name: string): string | null {
  const value = env[name];
  return value === undefined || value === '' ? null : value;
}

function readTimeoutMs(env: NodeJS.ProcessEnv): number {
  const raw = readNonEmpty(env, AI_AGENT_TIMEOUT_ENV_VAR);
  if (raw === null) {
    return DEFAULT_AI_AGENT_TIMEOUT_MS;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new PipelineStageError({
      code: 'SERVER_CONFIG_INVALID',
      stage: null,
      resource: AI_AGENT_TIMEOUT_ENV_VAR,
      expected: 'a positive integer number of milliseconds',
    });
  }

  return parsed;
}

export function readAiAgentConfig(env: NodeJS.ProcessEnv, neutralDirectory: string): AiAgentConfig {
  return {
    binaryPath: readNonEmpty(env, AI_AGENT_BINARY_ENV_VAR) ?? DEFAULT_AI_AGENT_BINARY,
    workingDirectory: readNonEmpty(env, AI_AGENT_CWD_ENV_VAR) ?? neutralDirectory,
    timeoutMs: readTimeoutMs(env),
    model: readNonEmpty(env, AI_AGENT_MODEL_ENV_VAR),
  };
}
