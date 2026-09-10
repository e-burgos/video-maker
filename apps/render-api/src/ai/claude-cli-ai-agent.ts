import type { CommandRunner } from '@video-maker/media-local';
import type { MediaLocalErrorCode } from '@video-maker/media-local';

import type { AiAgentPort, AiAgentRequest, AiAgentResponse, AiAgentUsage } from '../deps/render-api-dependencies';
import type { AiAgentConfig } from '../config/ai-agent-config';
import { PipelineStageError } from '../errors/pipeline-stage-error';

const BINARY_MISSING_CODES = ['BINARY_NOT_FOUND'] as const satisfies readonly MediaLocalErrorCode[];

const RATE_LIMIT_MARKERS = ['rate limit', 'rate_limit', 'usage limit', 'quota', '429', 'overloaded'] as const;

const UNAVAILABLE_HINT = `install the Claude Code CLI and sign it in, or set ${'CLAUDE_CLI_PATH'} to its absolute path`;
const RATE_LIMITED_HINT = 'the account plan limit was reached, wait for the window to reset and retry';
const FAILED_HINT = 'run the same prompt manually with the CLI to see the provider error';
const INVALID_OUTPUT_HINT = 'the agent answered without a structured payload matching the requested schema';

interface CliUsagePayload {
  readonly input_tokens?: unknown;
  readonly output_tokens?: unknown;
  readonly cache_creation_input_tokens?: unknown;
  readonly cache_read_input_tokens?: unknown;
}

interface CliResultPayload {
  readonly is_error?: unknown;
  readonly subtype?: unknown;
  readonly result?: unknown;
  readonly structured_output?: unknown;
  readonly usage?: unknown;
  readonly total_cost_usd?: unknown;
  readonly duration_ms?: unknown;
  readonly modelUsage?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asInteger(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : 0;
}

function asFiniteNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function errorCodeOf(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }
  return typeof value.code === 'string' ? value.code : null;
}

function isBinaryMissing(cause: unknown): boolean {
  const code = errorCodeOf(cause);
  return code !== null && (BINARY_MISSING_CODES as readonly string[]).includes(code);
}

function mentionsRateLimit(payload: CliResultPayload): boolean {
  const haystack = [payload.subtype, payload.result]
    .filter((entry): entry is string => typeof entry === 'string')
    .join(' ')
    .toLowerCase();

  return RATE_LIMIT_MARKERS.some((marker) => haystack.includes(marker));
}

function unavailable(cause: unknown): PipelineStageError {
  return new PipelineStageError({
    code: 'AI_AGENT_UNAVAILABLE',
    stage: null,
    resource: 'ai-agent',
    hint: UNAVAILABLE_HINT,
    cause,
  });
}

function failed(cause: unknown): PipelineStageError {
  return new PipelineStageError({
    code: 'AI_AGENT_FAILED',
    stage: null,
    resource: 'ai-agent',
    hint: FAILED_HINT,
    cause,
  });
}

function rateLimited(): PipelineStageError {
  return new PipelineStageError({
    code: 'AI_AGENT_RATE_LIMITED',
    stage: null,
    resource: 'ai-agent',
    hint: RATE_LIMITED_HINT,
  });
}

function invalidOutput(expected: string): PipelineStageError {
  return new PipelineStageError({
    code: 'AI_AGENT_INVALID_OUTPUT',
    stage: null,
    resource: 'ai-agent',
    expected,
    hint: INVALID_OUTPUT_HINT,
  });
}

export function claudeCliArgs(request: AiAgentRequest, config: AiAgentConfig): readonly string[] {
  return [
    '--print',
    request.userPrompt,
    '--system-prompt',
    request.systemPrompt,
    '--output-format',
    'json',
    '--json-schema',
    JSON.stringify(request.jsonSchema),
    '--tools',
    '',
    '--permission-mode',
    'dontAsk',
    '--disable-slash-commands',
    ...(config.model === null ? [] : ['--model', config.model]),
  ];
}

function readModelName(payload: CliResultPayload): string | null {
  if (!isRecord(payload.modelUsage)) {
    return null;
  }
  const [name] = Object.keys(payload.modelUsage);
  return name ?? null;
}

function readUsage(payload: CliResultPayload): AiAgentUsage {
  const usage: CliUsagePayload = isRecord(payload.usage) ? payload.usage : {};

  return {
    tokensIn:
      asInteger(usage.input_tokens) +
      asInteger(usage.cache_creation_input_tokens) +
      asInteger(usage.cache_read_input_tokens),
    tokensOut: asInteger(usage.output_tokens),
    costUsd: asFiniteNumberOrNull(payload.total_cost_usd),
    durationMs: asFiniteNumberOrNull(payload.duration_ms),
    model: readModelName(payload),
  };
}

export function createClaudeCliAiAgent(runner: CommandRunner, config: AiAgentConfig): AiAgentPort {
  return async (request: AiAgentRequest): Promise<AiAgentResponse> => {
    let stdout: string;
    let exitCode: number;

    try {
      const result = await runner.run(config.binaryPath, claudeCliArgs(request, config), {
        cwd: config.workingDirectory,
        timeoutMs: config.timeoutMs,
      });
      stdout = result.stdout;
      exitCode = result.exitCode;
    } catch (cause) {
      throw isBinaryMissing(cause) ? unavailable(cause) : failed(cause);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(stdout.trim());
    } catch (cause) {
      throw exitCode === 0 ? invalidOutput('a single JSON object on stdout') : failed(cause);
    }

    if (!isRecord(parsed)) {
      throw exitCode === 0 ? invalidOutput('a single JSON object on stdout') : failed(parsed);
    }

    const payload = parsed as CliResultPayload;

    if (exitCode !== 0 || payload.is_error === true) {
      throw mentionsRateLimit(payload) ? rateLimited() : failed(payload.subtype);
    }

    if (!isRecord(payload.structured_output)) {
      throw invalidOutput('a structured_output object matching the requested JSON Schema');
    }

    return { json: payload.structured_output, usage: readUsage(payload) };
  };
}
