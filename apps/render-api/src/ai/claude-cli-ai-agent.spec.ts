import { describe, expect, it } from 'vitest';

import type { AiAgentConfig } from '../config/ai-agent-config';
import { createFakeCommandRunner } from '../__fixtures__/fake-command-runner';
import { toErrorPayload } from '../errors/to-error-payload';
import { isRenderApiError } from '../errors/render-api-error';
import { AI_AGENT_DETAIL_MAX_CHARS, claudeCliArgs, createClaudeCliAiAgent } from './claude-cli-ai-agent';

const CONFIG: AiAgentConfig = {
  binaryPath: 'claude',
  workingDirectory: '/private/var/folders/neutral',
  timeoutMs: 120000,
  model: 'sonnet',
};

const REQUEST = {
  systemPrompt: 'You are a storyboard writer.',
  userPrompt: 'Write a storyboard about Nx.',
  jsonSchema: { type: 'object', properties: { title: { type: 'string' } } },
};

const HOST_PATH = '/Users/someone/github/personal-projects/video-maker';

function successStdout(structuredOutput: unknown): string {
  return `${JSON.stringify({
    type: 'result',
    subtype: 'success',
    is_error: false,
    duration_ms: 5578,
    result: '',
    total_cost_usd: 0.238,
    usage: {
      input_tokens: 4,
      cache_creation_input_tokens: 62993,
      cache_read_input_tokens: 100,
      output_tokens: 117,
    },
    modelUsage: { 'claude-sonnet-4-6': { inputTokens: 4, outputTokens: 117 } },
    structured_output: structuredOutput,
  })}\n`;
}

function agentWith(response: Parameters<typeof createFakeCommandRunner>[0][number]['response']) {
  const runner = createFakeCommandRunner([{ bin: 'claude', response }]);
  return { runner, agent: createClaudeCliAiAgent(runner, CONFIG) };
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return 'NO_ERROR_THROWN';
  } catch (error) {
    return isRenderApiError(error) ? error.code : 'NOT_A_RENDER_API_ERROR';
  }
}

describe('claudeCliArgs', () => {
  it('deshabilita las herramientas, fija el formato estructurado y no pide permisos', () => {
    const args = claudeCliArgs(REQUEST, CONFIG);

    expect(args).toEqual([
      '--print',
      REQUEST.userPrompt,
      '--system-prompt',
      REQUEST.systemPrompt,
      '--output-format',
      'json',
      '--json-schema',
      JSON.stringify(REQUEST.jsonSchema),
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
      'sonnet',
    ]);
  });

  it('aísla la llamada de los settings, plugins, hooks, MCP y sesiones del usuario de la máquina', () => {
    const args = claudeCliArgs(REQUEST, CONFIG);

    expect(args[args.indexOf('--setting-sources') + 1]).toBe('');
    expect(args).toContain('--strict-mcp-config');
    expect(args).not.toContain('--mcp-config');
    expect(args).toContain('--no-session-persistence');
  });

  it('nunca invoca el CLI sin modelo: sin pedido explícito manda el del servicio', () => {
    expect(claudeCliArgs(REQUEST, { ...CONFIG, model: 'opus' }).slice(-2)).toEqual(['--model', 'opus']);
    expect(claudeCliArgs({ ...REQUEST, model: null }, CONFIG).slice(-2)).toEqual(['--model', 'sonnet']);
  });

  it('el modelo del pedido gana sobre el del servicio', () => {
    expect(claudeCliArgs({ ...REQUEST, model: 'haiku' }, CONFIG).slice(-2)).toEqual(['--model', 'haiku']);
  });
});

describe('createClaudeCliAiAgent', () => {
  it('invoca el binario en el directorio neutro configurado y con su timeout', async () => {
    const { runner, agent } = agentWith({ stdout: successStdout({ title: 'Nx' }) });

    await agent(REQUEST);

    expect(runner.calls[0]?.bin).toBe('claude');
    expect(runner.calls[0]?.opts).toEqual({ cwd: '/private/var/folders/neutral', timeoutMs: 120000 });
    expect(runner.calls[0]?.opts?.cwd).not.toBe(process.cwd());
  });

  it('devuelve structured_output y el consumo agregando los tokens de caché', async () => {
    const { agent } = agentWith({ stdout: successStdout({ title: 'Nx' }) });

    const response = await agent(REQUEST);

    expect(response.json).toEqual({ title: 'Nx' });
    expect(response.usage).toEqual({
      tokensIn: 63097,
      tokensOut: 117,
      costUsd: 0.238,
      durationMs: 5578,
      model: 'claude-sonnet-4-6',
    });
  });

  it('reporta AI_AGENT_UNAVAILABLE cuando el binario no existe', async () => {
    const { agent } = agentWith({ reject: { code: 'BINARY_NOT_FOUND', message: `spawn ${HOST_PATH}/claude ENOENT` } });

    expect(await codeOf(agent(REQUEST))).toBe('AI_AGENT_UNAVAILABLE');
  });

  it('reporta AI_AGENT_RATE_LIMITED cuando el CLI informa el límite del plan', async () => {
    const { agent } = agentWith({
      exitCode: 1,
      stdout: JSON.stringify({
        type: 'result',
        subtype: 'error_during_execution',
        is_error: true,
        result: 'Claude AI usage limit reached. Your limit will reset at 5pm.',
      }),
    });

    expect(await codeOf(agent(REQUEST))).toBe('AI_AGENT_RATE_LIMITED');
  });

  it('reporta AI_AGENT_FAILED cuando el CLI termina con is_error sin marcador de cuota', async () => {
    const { agent } = agentWith({
      stdout: JSON.stringify({
        type: 'result',
        subtype: 'error_during_execution',
        is_error: true,
        result: 'The provider returned an internal error.',
      }),
    });

    expect(await codeOf(agent(REQUEST))).toBe('AI_AGENT_FAILED');
  });

  it('reporta AI_AGENT_FAILED cuando el runner falla por timeout', async () => {
    const { agent } = agentWith({ reject: { code: 'COMMAND_FAILED', message: 'timed out' } });

    expect(await codeOf(agent(REQUEST))).toBe('AI_AGENT_FAILED');
  });

  it('reporta AI_AGENT_FAILED cuando sale con exit code no cero y stdout ilegible', async () => {
    const { agent } = agentWith({ exitCode: 2, stdout: 'not json at all' });

    expect(await codeOf(agent(REQUEST))).toBe('AI_AGENT_FAILED');
  });

  it('reporta AI_AGENT_INVALID_OUTPUT cuando termina bien pero stdout no es JSON', async () => {
    const { agent } = agentWith({ stdout: 'Sure! Here is your storyboard.' });

    expect(await codeOf(agent(REQUEST))).toBe('AI_AGENT_INVALID_OUTPUT');
  });

  it('reporta AI_AGENT_INVALID_OUTPUT cuando stdout es JSON pero no un objeto', async () => {
    const { agent } = agentWith({ stdout: '["a","b"]' });

    expect(await codeOf(agent(REQUEST))).toBe('AI_AGENT_INVALID_OUTPUT');
  });

  it('reporta AI_AGENT_INVALID_OUTPUT cuando falta structured_output', async () => {
    const { agent } = agentWith({
      stdout: JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: 'texto suelto' }),
    });

    expect(await codeOf(agent(REQUEST))).toBe('AI_AGENT_INVALID_OUTPUT');
  });

  it('reporta consumo en cero cuando el CLI no publica usage', async () => {
    const { agent } = agentWith({
      stdout: JSON.stringify({ type: 'result', is_error: false, structured_output: { title: 'Nx' } }),
    });

    expect((await agent(REQUEST)).usage).toEqual({
      tokensIn: 0,
      tokensOut: 0,
      costUsd: null,
      durationMs: null,
      model: null,
    });
  });

  it('nunca filtra stderr ni stack en el payload del error', async () => {
    const { agent } = agentWith({
      exitCode: 1,
      stderr: `Error: cannot read ${HOST_PATH}/CLAUDE.md`,
      stdout: JSON.stringify({
        type: 'result',
        subtype: 'error_during_execution',
        is_error: true,
        result: 'the provider returned an internal error',
      }),
    });

    try {
      await agent(REQUEST);
      expect.unreachable('el agente debe fallar');
    } catch (error) {
      const payload = toErrorPayload(error);
      const serialized = JSON.stringify(payload);

      expect(payload.code).toBe('AI_AGENT_FAILED');
      expect(serialized).not.toContain('cannot read');
      expect(serialized).not.toContain('stack');
    }
  });

  it('publica el detalle del proveedor en subtype y result', async () => {
    const { agent } = agentWith({
      exitCode: 1,
      stdout: JSON.stringify({
        type: 'result',
        subtype: 'error_during_execution',
        is_error: true,
        result: 'API Error: 400 {"type":"error","error":{"message":"claude_code_version_too_old"}}',
      }),
    });

    try {
      await agent(REQUEST);
      expect.unreachable('el agente debe fallar');
    } catch (error) {
      const payload = toErrorPayload(error);

      expect(payload.code).toBe('AI_AGENT_FAILED');
      expect(payload.subtype).toBe('error_during_execution');
      expect(payload.result).toContain('claude_code_version_too_old');
      expect(payload.hint).toBe('update Claude Code: run `claude update`');
    }
  });

  it('recorta el detalle del proveedor y deja el hint genérico sin marcador conocido', async () => {
    const { agent } = agentWith({
      exitCode: 1,
      stdout: JSON.stringify({
        type: 'result',
        subtype: 'error_during_execution',
        is_error: true,
        result: 'x'.repeat(AI_AGENT_DETAIL_MAX_CHARS + 40),
      }),
    });

    try {
      await agent(REQUEST);
      expect.unreachable('el agente debe fallar');
    } catch (error) {
      const payload = toErrorPayload(error);

      expect(payload.result).toBe(`${'x'.repeat(AI_AGENT_DETAIL_MAX_CHARS)}...`);
      expect(payload.hint).toBe('run the same prompt manually with the CLI to see the provider error');
    }
  });

  it('no publica detalle cuando el CLI no lo informa', async () => {
    const { agent } = agentWith({
      exitCode: 1,
      stdout: JSON.stringify({ type: 'result', is_error: true, result: '   ' }),
    });

    try {
      await agent(REQUEST);
      expect.unreachable('el agente debe fallar');
    } catch (error) {
      const payload = toErrorPayload(error);

      expect(Object.keys(payload).sort()).toEqual(['code', 'hint', 'message', 'resource', 'stage']);
    }
  });
});
