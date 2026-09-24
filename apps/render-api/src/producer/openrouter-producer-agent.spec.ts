import { resolveMediaProject } from '@video-maker/auto-montage';
import { OpenRouterProducerRuntimeError } from '@video-maker/producer-tools';
import type { ProducerRuntimeEvent } from '@video-maker/producer-tools';
import { describe, expect, it, vi } from 'vitest';

import type { ProducerTurnStart } from './producer-agent';
import { createOpenRouterProducerAgent } from './openrouter-producer-agent';
import type { CreateOpenRouterProducerAgentOptions, RunOpenRouterProducerTurn } from './openrouter-producer-agent';

const PROJECT = resolveMediaProject('/media/demo-01');

const START: ProducerTurnStart = {
  text: 'Armá el montaje',
  model: 'anthropic/claude-haiku-4.5',
  systemPrompt: 'You are the producer.',
  sessionId: 'session-1',
  resume: false,
  mcpConfig: '',
  cwd: '/media/demo-01',
};

function baseOptions(
  run: RunOpenRouterProducerTurn,
  overrides: Partial<CreateOpenRouterProducerAgentOptions> = {},
): CreateOpenRouterProducerAgentOptions {
  return {
    project: PROJECT,
    apiUrl: 'http://127.0.0.1:4399',
    accessToken: 'token-abc',
    apiKey: 'sk-or-v1-should-never-leak',
    chatModel: 'anthropic/claude-haiku-4.5',
    turnModel: 'sonnet',
    supportsImages: true,
    history: [],
    run,
    ...overrides,
  };
}

function collectLines(onLine: ReturnType<typeof vi.fn>): readonly Record<string, unknown>[] {
  return onLine.mock.calls.map(([line]: [string]) => JSON.parse(line) as Record<string, unknown>);
}

describe('createOpenRouterProducerAgent', () => {
  it('emits a synthetic system init line with the given sessionId before anything else', () => {
    const run = vi.fn(async () => ({ finalText: 'ok', usage: { inputTokens: 1, outputTokens: 1, costUsd: null }, steps: 1 }));
    const onLine = vi.fn();
    createOpenRouterProducerAgent(baseOptions(run))(START, onLine);

    const [first] = collectLines(onLine);
    expect(first).toEqual({ type: 'system', subtype: 'init', session_id: 'session-1' });
  });

  it('passes the render-api client, history, turnModel, chatModel and abortSignal through to run', () => {
    const run = vi.fn(async () => ({ finalText: 'ok', usage: { inputTokens: 1, outputTokens: 1, costUsd: null }, steps: 1 }));
    const history = [{ role: 'user' as const, content: 'previo' }];
    createOpenRouterProducerAgent(baseOptions(run, { history, maxSteps: 12 }))(START, vi.fn());

    expect(run).toHaveBeenCalledTimes(1);
    const call = run.mock.calls[0]?.[0];
    expect(call?.apiKey).toBe('sk-or-v1-should-never-leak');
    expect(call?.model).toBe('anthropic/claude-haiku-4.5');
    expect(call?.turnModel).toBe('sonnet');
    expect(call?.systemPrompt).toBe('You are the producer.');
    expect(call?.userText).toBe('Armá el montaje');
    expect(call?.history).toBe(history);
    expect(call?.supportsImages).toBe(true);
    expect(call?.maxSteps).toBe(12);
    expect(call?.abortSignal).toBeInstanceOf(AbortSignal);
    expect(typeof call?.client.getTimeline).toBe('function');
    expect(typeof call?.client.createJob).toBe('function');
  });

  it('translates a text runtime event into an assistant text stream line', async () => {
    let onEvent: ((event: ProducerRuntimeEvent) => void) | undefined;
    const run = vi.fn(async (options: Parameters<RunOpenRouterProducerTurn>[0]) => {
      onEvent = options.onEvent;
      onEvent?.({ type: 'text', text: 'Reviso el material.' });
      return { finalText: 'listo', usage: { inputTokens: 1, outputTokens: 1, costUsd: null }, steps: 1 };
    });
    const onLine = vi.fn();
    const agent = createOpenRouterProducerAgent(baseOptions(run));
    const runResult = agent(START, onLine);
    await runResult.completed;

    const lines = collectLines(onLine);
    expect(lines).toContainEqual({
      type: 'assistant',
      message: { content: [{ type: 'text', text: 'Reviso el material.' }] },
    });
  });

  it('translates a tool runtime event into an mcp__studio__-named tool_use stream line', async () => {
    const run = vi.fn(async (options: Parameters<RunOpenRouterProducerTurn>[0]) => {
      options.onEvent?.({ type: 'tool', name: 'mcp__studio__probe_media', input: { path: 'raw/aroll/a.mp4' } });
      return { finalText: 'listo', usage: { inputTokens: 1, outputTokens: 1, costUsd: null }, steps: 1 };
    });
    const onLine = vi.fn();
    await createOpenRouterProducerAgent(baseOptions(run))(START, onLine).completed;

    const lines = collectLines(onLine);
    const toolLine = lines.find(
      (line) => (line as { message?: { content?: readonly Record<string, unknown>[] } }).message?.content?.[0]?.type === 'tool_use',
    ) as { message: { content: readonly Record<string, unknown>[] } };
    expect(toolLine.message.content[0]).toMatchObject({
      type: 'tool_use',
      name: 'mcp__studio__probe_media',
      input: { path: 'raw/aroll/a.mp4' },
    });
  });

  it('translates a failed tool-result runtime event into a user tool_result is_error line, and ignores successful ones', async () => {
    const run = vi.fn(async (options: Parameters<RunOpenRouterProducerTurn>[0]) => {
      options.onEvent?.({ type: 'tool-result', name: 'mcp__studio__probe_media', isError: false });
      options.onEvent?.({ type: 'tool-result', name: 'mcp__studio__start_job', isError: true });
      return { finalText: 'listo', usage: { inputTokens: 1, outputTokens: 1, costUsd: null }, steps: 1 };
    });
    const onLine = vi.fn();
    await createOpenRouterProducerAgent(baseOptions(run))(START, onLine).completed;

    const lines = collectLines(onLine);
    const toolResultLines = lines.filter((line) => line.type === 'user');
    expect(toolResultLines).toEqual([{ type: 'user', message: { content: [{ type: 'tool_result', is_error: true }] } }]);
  });

  it('emits a success result line with the final text and usage, and settles exitCode 0', async () => {
    const usage = { inputTokens: 120, outputTokens: 40, costUsd: 0.0012 };
    const run = vi.fn(async () => ({ finalText: 'Job en marcha.', usage, steps: 3 }));
    const onLine = vi.fn();
    const result = await createOpenRouterProducerAgent(baseOptions(run))(START, onLine).completed;

    const lines = collectLines(onLine);
    expect(lines.at(-1)).toEqual({ type: 'result', subtype: 'success', is_error: false, result: 'Job en marcha.', usage });
    expect(result).toEqual({ exitCode: 0, canceled: false, timedOut: false, spawnFailed: false, stderr: '' });
  });

  it('maps a typed OpenRouterProducerRuntimeError into an openrouter:<code> failed result line', async () => {
    const run = vi.fn(async () => {
      throw new OpenRouterProducerRuntimeError('OPENROUTER_RATE_LIMITED', 'rate limited, retry later');
    });
    const onLine = vi.fn();
    const result = await createOpenRouterProducerAgent(baseOptions(run))(START, onLine).completed;

    const lines = collectLines(onLine);
    expect(lines.at(-1)).toEqual({
      type: 'result',
      subtype: 'openrouter:OPENROUTER_RATE_LIMITED',
      is_error: true,
      result: 'rate limited, retry later',
    });
    expect(result).toEqual({ exitCode: 1, canceled: false, timedOut: false, spawnFailed: false, stderr: '' });
  });

  it('maps a non-typed failure to openrouter:OPENROUTER_FAILED', async () => {
    const run = vi.fn(async () => {
      throw new Error('socket hang up');
    });
    const onLine = vi.fn();
    await createOpenRouterProducerAgent(baseOptions(run))(START, onLine).completed;

    const lines = collectLines(onLine);
    expect(lines.at(-1)).toMatchObject({ subtype: 'openrouter:OPENROUTER_FAILED', is_error: true });
  });

  it('cancel() aborts the AbortSignal passed to run and settles canceled with no failed result line', async () => {
    let capturedSignal: AbortSignal | undefined;
    const run = vi.fn(
      (options: Parameters<RunOpenRouterProducerTurn>[0]) =>
        new Promise<never>((_resolve, reject) => {
          capturedSignal = options.abortSignal;
          options.abortSignal?.addEventListener('abort', () => {
            const error = new Error('The operation was aborted.');
            error.name = 'AbortError';
            reject(error);
          });
        }),
    );
    const onLine = vi.fn();
    const run_ = createOpenRouterProducerAgent(baseOptions(run))(START, onLine);

    run_.cancel();
    const result = await run_.completed;

    expect(capturedSignal?.aborted).toBe(true);
    expect(result).toEqual({ exitCode: null, canceled: true, timedOut: false, spawnFailed: false, stderr: '' });
    expect(collectLines(onLine).some((line) => line.type === 'result')).toBe(false);
  });

  it('never puts the apiKey in any emitted stream line', async () => {
    const SECRET = 'sk-or-v1-should-never-leak';
    const run = vi.fn(async (options: Parameters<RunOpenRouterProducerTurn>[0]) => {
      options.onEvent?.({ type: 'text', text: 'hola' });
      options.onEvent?.({ type: 'tool', name: 'mcp__studio__get_timeline', input: {} });
      return { finalText: 'listo', usage: { inputTokens: 1, outputTokens: 1, costUsd: null }, steps: 1 };
    });
    const onLine = vi.fn();
    await createOpenRouterProducerAgent(baseOptions(run, { apiKey: SECRET }))(START, onLine).completed;

    for (const call of onLine.mock.calls) {
      expect((call[0] as string).includes(SECRET)).toBe(false);
    }
  });
});
