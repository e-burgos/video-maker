import { existsSync } from 'node:fs';

import type { CommandResult, CommandRunner } from '@video-maker/media-local';
import type { AutoStoryboardRequest } from '@video-maker/motion-graphics';
import { describe, expect, it } from 'vitest';

import { claudeCliArgs, createClaudeCliAskAgent } from './claude-cli-ask-agent';

const request: AutoStoryboardRequest = {
  systemPrompt: 'system',
  userPrompt: 'user',
  jsonSchema: { $schema: 'https://json-schema.org/draft/2020-12/schema', $id: 'x', type: 'object' },
};

function fakeRunner(result: Partial<CommandResult>) {
  const calls: Array<{ bin: string; args: readonly string[]; cwd: string | undefined }> = [];
  const runner: CommandRunner = {
    run: async (bin, args, opts) => {
      calls.push({ bin, args, cwd: opts?.cwd });
      return { exitCode: 0, stdout: '', stderr: '', ...result } as CommandResult;
    },
  };
  return { runner, calls };
}

const options = (runner: CommandRunner) => ({ runner, binaryPath: 'claude', model: 'sonnet', timeoutMs: 1000 });

describe('claudeCliArgs', () => {
  it('passes prompts, schema without identity keys, no tools and the model', () => {
    const args = claudeCliArgs(request, 'haiku');
    expect(args.slice(0, 5)).toEqual(['--print', 'user', '--system-prompt', 'system', '--output-format']);
    expect(args[args.indexOf('--json-schema') + 1]).toBe('{"type":"object"}');
    expect(args[args.indexOf('--tools') + 1]).toBe('');
    expect(args[args.indexOf('--model') + 1]).toBe('haiku');
  });

  it('isolates the call from the user settings, plugins, hooks and MCP servers of the machine', () => {
    const args = claudeCliArgs(request, 'haiku');
    expect(args[args.indexOf('--setting-sources') + 1]).toBe('');
    expect(args).toContain('--strict-mcp-config');
    expect(args).toContain('--no-session-persistence');
  });
});

describe('createClaudeCliAskAgent', () => {
  it('reads structured_output and sums every kind of input token, running in a throwaway directory', async () => {
    const stdout = JSON.stringify({ structured_output: { a: 1 }, total_cost_usd: 0.05, usage: { input_tokens: 10, cache_creation_input_tokens: 20, cache_read_input_tokens: 30, output_tokens: 7 } });
    const { runner, calls } = fakeRunner({ stdout });
    const response = await createClaudeCliAskAgent(options(runner))(request);
    expect(response).toEqual({ json: { a: 1 }, usage: { inputTokens: 60, outputTokens: 7, costUsd: 0.05 } });
    expect(calls[0]?.bin).toBe('claude');
    expect(calls[0]?.cwd).toMatch(/motion-auto-/u);
    expect(existsSync(calls[0]?.cwd ?? '')).toBe(false);
  });

  it('fails when structured_output is missing even if the CLI reports success', async () => {
    const { runner } = fakeRunner({ stdout: JSON.stringify({ is_error: false, result: 'prose' }) });
    await expect(createClaudeCliAskAgent(options(runner))(request)).rejects.toThrow(/structured_output/u);
  });

  it('fails on a CLI error payload, a non-zero exit and non-JSON output, cleaning up each time', async () => {
    const run = (result: Partial<CommandResult>) => createClaudeCliAskAgent(options(fakeRunner(result).runner))(request);
    await expect(run({ stdout: JSON.stringify({ is_error: true, result: 'usage limit' }) })).rejects.toThrow(/usage limit/u);
    await expect(run({ exitCode: 1, stderr: 'boom' })).rejects.toThrow(/exited with 1: boom/u);
    await expect(run({ stdout: 'not json' })).rejects.toThrow(/did not print a JSON/u);
  });
});
