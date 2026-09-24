import { APICallError, RetryError } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { describe, expect, it, vi } from 'vitest';

import { createFakeRenderApiClient } from '../__fixtures__/fake-render-api-client';
import { buildMinimalTimeline } from '../__fixtures__/minimal-timeline';
import { StudioToolRuntimeError } from '../errors/studio-tool-runtime-error';
import {
  DEFAULT_MAX_STEPS,
  OpenRouterProducerRuntimeError,
  runOpenRouterProducerTurn,
  runProducerTurnWithModel,
} from './openrouter-producer-runtime';
import type { ProducerRuntimeEvent } from './openrouter-producer-runtime';

const NULL_USAGE = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 4, text: 4, reasoning: undefined },
};

function textResult(text: string, cost?: number) {
  return {
    content: [{ type: 'text' as const, text }],
    finishReason: { unified: 'stop' as const, raw: 'stop' },
    usage: NULL_USAGE,
    ...(cost === undefined
      ? {}
      : { providerMetadata: { openrouter: { usage: { promptTokens: 10, completionTokens: 4, totalTokens: 14, cost } } } }),
  };
}

function toolCallResult(toolName: string, input: unknown, toolCallId = 'call-1') {
  return {
    content: [{ type: 'tool-call' as const, toolCallId, toolName, input: JSON.stringify(input) }],
    finishReason: { unified: 'tool-calls' as const, raw: 'tool_calls' },
    usage: NULL_USAGE,
  };
}

function baseOptions(overrides: Partial<Parameters<typeof runProducerTurnWithModel>[0]> = {}) {
  const client = createFakeRenderApiClient(overrides.client === undefined ? {} : {});
  return {
    systemPrompt: 'You are the producer.',
    history: [],
    userText: 'Start the montage job.',
    client,
    turnModel: 'sonnet',
    ...overrides,
  };
}

describe('runProducerTurnWithModel', () => {
  it('runs a tool call through the handler and returns the final text', async () => {
    const timeline = buildMinimalTimeline();
    const client = createFakeRenderApiClient({ getTimeline: async () => timeline });
    const model = new MockLanguageModelV4({
      doGenerate: [toolCallResult('mcp__studio__get_timeline', {}), textResult('Timeline read, all good.')],
    });

    const events: ProducerRuntimeEvent[] = [];
    const result = await runProducerTurnWithModel({
      ...baseOptions({ client }),
      model,
      onEvent: (event) => events.push(event),
    });

    expect(result.finalText).toBe('Timeline read, all good.');
    expect(result.steps).toBe(2);
    expect(result.usage).toEqual({ inputTokens: 20, outputTokens: 8, costUsd: null });

    const toolEvents = events.filter((event) => event.type === 'tool');
    expect(toolEvents).toEqual([{ type: 'tool', name: 'mcp__studio__get_timeline', input: {} }]);
    const toolResultEvents = events.filter((event) => event.type === 'tool-result');
    expect(toolResultEvents).toEqual([{ type: 'tool-result', name: 'mcp__studio__get_timeline', isError: false }]);
    const textEvents = events.filter((event) => event.type === 'text');
    expect(textEvents).toEqual([{ type: 'text', text: 'Timeline read, all good.' }]);
  });

  it('sums OpenRouter usage-accounting cost across steps into costUsd', async () => {
    const timeline = buildMinimalTimeline();
    const client = createFakeRenderApiClient({ getTimeline: async () => timeline });
    const model = new MockLanguageModelV4({
      doGenerate: [
        { ...toolCallResult('mcp__studio__get_timeline', {}), providerMetadata: { openrouter: { usage: { cost: 0.001 } } } },
        textResult('Done.', 0.002),
      ],
    });

    const result = await runProducerTurnWithModel({ ...baseOptions({ client }), model });

    expect(result.usage.costUsd).toBeCloseTo(0.003, 6);
  });

  it('returns an extract_frames image result and lets the turn keep going', async () => {
    const client = createFakeRenderApiClient({
      extractFrames: async () => [{ atSeconds: 1, path: 'work/producer/frames/t1000.jpg' }],
      readFileBytes: async () => ({ bytes: new Uint8Array([9, 9, 9]), mimeType: 'image/jpeg' }),
    });
    const model = new MockLanguageModelV4({
      doGenerate: [
        toolCallResult('mcp__studio__extract_frames', { path: 'raw/aroll/a.mp4', atSeconds: [1] }),
        textResult('I looked at the frame.'),
      ],
    });

    const events: ProducerRuntimeEvent[] = [];
    const result = await runProducerTurnWithModel({
      ...baseOptions({ client }),
      model,
      supportsImages: true,
      onEvent: (event) => events.push(event),
    });

    expect(result.finalText).toBe('I looked at the frame.');
    expect(events).toContainEqual({
      type: 'tool-result',
      name: 'mcp__studio__extract_frames',
      isError: false,
    });
  });

  it('returns a tool error as data instead of throwing, so the turn can recover', async () => {
    const client = createFakeRenderApiClient({
      probeMedia: async () => {
        throw new StudioToolRuntimeError('FILE_NOT_FOUND', 'raw/aroll/missing.mp4 does not exist');
      },
    });
    const model = new MockLanguageModelV4({
      doGenerate: [
        toolCallResult('mcp__studio__probe_media', { path: 'raw/aroll/missing.mp4' }),
        textResult('That file is missing, let me ask for another one.'),
      ],
    });

    const events: ProducerRuntimeEvent[] = [];
    const result = await runProducerTurnWithModel({
      ...baseOptions({ client }),
      model,
      onEvent: (event) => events.push(event),
    });

    expect(result.finalText).toBe('That file is missing, let me ask for another one.');
    expect(events).toContainEqual({ type: 'tool-result', name: 'mcp__studio__probe_media', isError: true });
  });

  it('aborts through the AbortSignal without falling into the OpenRouter error mapping', async () => {
    const controller = new AbortController();
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        controller.abort();
        const error = new Error('The operation was aborted.');
        error.name = 'AbortError';
        throw error;
      },
    });

    await expect(
      runProducerTurnWithModel({ ...baseOptions(), model, abortSignal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('stops at the step limit without throwing', async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => toolCallResult('mcp__studio__get_timeline', {}, `call-${Math.random()}`),
    });
    const client = createFakeRenderApiClient({ getTimeline: async () => buildMinimalTimeline() });

    const result = await runProducerTurnWithModel({ ...baseOptions({ client }), model, maxSteps: 3 });

    expect(result.steps).toBe(3);
  });

  it('defaults maxSteps to DEFAULT_MAX_STEPS', () => {
    expect(DEFAULT_MAX_STEPS).toBe(60);
  });

  it.each([
    [401, undefined, 'OPENROUTER_KEY_INVALID'],
    [429, undefined, 'OPENROUTER_RATE_LIMITED'],
    [404, undefined, 'OPENROUTER_MODEL_UNAVAILABLE'],
    [400, 'model not found: acme/ghost', 'OPENROUTER_MODEL_UNAVAILABLE'],
    [400, 'malformed request body', 'OPENROUTER_FAILED'],
    [500, undefined, 'OPENROUTER_FAILED'],
  ])('maps a %s API call error (%s) to %s', async (statusCode, message, expectedCode) => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new APICallError({
          message: message ?? `request failed with status ${statusCode}`,
          url: 'https://openrouter.ai/api/v1/chat/completions',
          requestBodyValues: {},
          statusCode,
          responseBody: '{"error":{"message":"do not leak this raw body"}}',
          isRetryable: false,
        });
      },
    });

    await expect(runProducerTurnWithModel({ ...baseOptions(), model })).rejects.toMatchObject({
      code: expectedCode,
    });
  });

  it('unwraps a RetryError from exhausted retries and maps its last 429 to OPENROUTER_RATE_LIMITED', async () => {
    const lastError = new APICallError({
      message: 'Rate limit exceeded: temporary-burst-limit',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      requestBodyValues: {},
      statusCode: 429,
      responseBody: '{"error":{"message":"Rate limit exceeded: temporary-burst-limit"}}',
      isRetryable: true,
    });
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new RetryError({ message: 'Failed after 3 attempts.', reason: 'maxRetriesExceeded', errors: [lastError] });
      },
    });

    await expect(runProducerTurnWithModel({ ...baseOptions(), model })).rejects.toMatchObject({
      code: 'OPENROUTER_RATE_LIMITED',
    });
  });

  it('unwraps a RetryError whose last error is a free-tier daily quota 429 to OPENROUTER_FREE_QUOTA_EXHAUSTED with a Spanish hint', async () => {
    const lastError = new APICallError({
      message: 'Rate limit exceeded: free-models-per-day-high-balance.',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      requestBodyValues: {},
      statusCode: 429,
      responseBody: '{"error":{"message":"Rate limit exceeded: free-models-per-day-high-balance."}}',
      isRetryable: true,
    });
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new RetryError({ message: 'Failed after 3 attempts.', reason: 'maxRetriesExceeded', errors: [lastError] });
      },
    });

    await expect(runProducerTurnWithModel({ ...baseOptions(), model })).rejects.toMatchObject({
      code: 'OPENROUTER_FREE_QUOTA_EXHAUSTED',
      message: expect.stringContaining('cuota diaria'),
    });
  });

  it('maps a non-API-call failure to OPENROUTER_FAILED', async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new Error('socket hang up');
      },
    });

    await expect(runProducerTurnWithModel({ ...baseOptions(), model })).rejects.toBeInstanceOf(
      OpenRouterProducerRuntimeError,
    );
  });

  it('never puts the response body into the mapped error hint', async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new APICallError({
          message: 'unauthorized',
          url: 'https://openrouter.ai/api/v1/chat/completions',
          requestBodyValues: {},
          statusCode: 401,
          responseBody: '{"error":"sk-or-super-secret-body-leak"}',
          isRetryable: false,
        });
      },
    });

    await expect(runProducerTurnWithModel({ ...baseOptions(), model })).rejects.toMatchObject({
      code: 'OPENROUTER_KEY_INVALID',
      message: expect.not.stringContaining('sk-or-super-secret-body-leak'),
    });
  });
});

describe('runOpenRouterProducerTurn', () => {
  it('wires apiKey and model into the OpenRouter provider without leaking the key in any event or error', async () => {
    const SECRET_KEY = 'sk-or-v1-do-not-leak-me';
    const events: ProducerRuntimeEvent[] = [];

    const fakeFetch = vi.fn(async () =>
      new Response(JSON.stringify({ error: { message: 'Invalid API key' } }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    );

    let thrown: unknown;
    try {
      await runOpenRouterProducerTurn({
        ...baseOptions(),
        apiKey: SECRET_KEY,
        model: 'openrouter/some-model',
        fetch: fakeFetch as unknown as typeof fetch,
        onEvent: (event) => events.push(event),
      });
    } catch (cause) {
      thrown = cause;
    }

    expect(thrown).toBeInstanceOf(OpenRouterProducerRuntimeError);
    expect((thrown as OpenRouterProducerRuntimeError).code).toBe('OPENROUTER_KEY_INVALID');
    expect((thrown as Error).message).not.toContain(SECRET_KEY);
    expect(events.some((event) => JSON.stringify(event).includes(SECRET_KEY))).toBe(false);

    const [, requestInit] = fakeFetch.mock.calls[0] as [unknown, RequestInit];
    const headers = new Headers(requestInit.headers);
    expect(headers.get('authorization')).toBe(`Bearer ${SECRET_KEY}`);
  });

  it('never retries a 429 whose body reports the free-tier daily quota is exhausted, and maps it to OPENROUTER_FREE_QUOTA_EXHAUSTED', async () => {
    const fakeFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({ error: { message: 'Rate limit exceeded: free-models-per-day-high-balance.' } }),
        { status: 429, headers: { 'content-type': 'application/json' } },
      ),
    );

    let thrown: unknown;
    try {
      await runOpenRouterProducerTurn({
        ...baseOptions(),
        apiKey: 'sk-or-v1-does-not-matter-here',
        model: 'openrouter/some-free-model:free',
        fetch: fakeFetch as unknown as typeof fetch,
      });
    } catch (cause) {
      thrown = cause;
    }

    expect(thrown).toBeInstanceOf(OpenRouterProducerRuntimeError);
    expect((thrown as OpenRouterProducerRuntimeError).code).toBe('OPENROUTER_FREE_QUOTA_EXHAUSTED');
    expect(fakeFetch).toHaveBeenCalledTimes(1);
  });
});
