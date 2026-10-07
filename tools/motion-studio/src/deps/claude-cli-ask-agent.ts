import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { CommandRunner } from '@video-maker/media-local';
import { MotionStudioError } from '@video-maker/motion-graphics';
import type { AskResponse, AskStoryboardAgent, AutoStoryboardRequest } from '@video-maker/motion-graphics';

export interface ClaudeCliAskAgentOptions {
  runner: CommandRunner;
  binaryPath: string;
  model: string;
  timeoutMs: number;
}

const DEFAULT_DETAIL_CHARS = 400;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : 0;
}

export function claudeCliArgs(request: AutoStoryboardRequest, model: string): string[] {
  const schema = Object.fromEntries(Object.entries(request.jsonSchema).filter(([key]) => key !== '$schema' && key !== '$id'));
  return [
    '--print',
    request.userPrompt,
    '--system-prompt',
    request.systemPrompt,
    '--output-format',
    'json',
    '--json-schema',
    JSON.stringify(schema),
    '--tools',
    '',
    '--permission-mode',
    'dontAsk',
    '--disable-slash-commands',
    '--setting-sources',
    '',
    '--strict-mcp-config',
    '--no-session-persistence',
    '--model',
    model,
  ];
}

function readResponse(stdout: string): AskResponse {
  let payload: unknown;
  try {
    payload = JSON.parse(stdout.trim());
  } catch {
    throw new MotionStudioError('AI_FAILED', `the claude CLI did not print a JSON object: ${stdout.slice(0, DEFAULT_DETAIL_CHARS)}`);
  }
  if (!isRecord(payload)) throw new MotionStudioError('AI_FAILED', 'the claude CLI did not print a JSON object');
  if (payload['is_error'] === true) {
    throw new MotionStudioError('AI_FAILED', `the claude CLI reported an error: ${String(payload['result'] ?? payload['subtype'] ?? 'unknown').slice(0, DEFAULT_DETAIL_CHARS)}`);
  }
  if (!isRecord(payload['structured_output'])) throw new MotionStudioError('AI_FAILED', 'the claude CLI answered without structured_output matching the schema');
  const usage = isRecord(payload['usage']) ? payload['usage'] : {};
  const cost = payload['total_cost_usd'];
  return {
    json: payload['structured_output'],
    usage: {
      inputTokens: count(usage['input_tokens']) + count(usage['cache_creation_input_tokens']) + count(usage['cache_read_input_tokens']),
      outputTokens: count(usage['output_tokens']),
      costUsd: typeof cost === 'number' && Number.isFinite(cost) ? cost : null,
    },
  };
}

export function createClaudeCliAskAgent(options: ClaudeCliAskAgentOptions): AskStoryboardAgent {
  return async (request) => {
    const workDir = await mkdtemp(join(tmpdir(), 'motion-auto-'));
    try {
      const result = await options.runner.run(options.binaryPath, claudeCliArgs(request, options.model), { cwd: workDir, timeoutMs: options.timeoutMs });
      if (result.exitCode !== 0) throw new MotionStudioError('AI_FAILED', `the claude CLI exited with ${result.exitCode}: ${(result.stderr || result.stdout).slice(-DEFAULT_DETAIL_CHARS)}`);
      return readResponse(result.stdout);
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  };
}
