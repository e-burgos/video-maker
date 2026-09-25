import { APICallError } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { describe, expect, it } from 'vitest';

import { isRenderApiError } from '../errors/render-api-error';
import { createOpenRouterAiAgentFromModel } from './openrouter-ai-agent';

const REQUEST = {
  systemPrompt: 'You are a storyboard writer.',
  userPrompt: 'Write a storyboard about Nx.',
  jsonSchema: {
    type: 'object',
    properties: { title: { type: 'string' } },
    required: ['title'],
    additionalProperties: false,
  },
};

const USAGE = {
  inputTokens: { total: 120, noCache: 120, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 40, text: 40, reasoning: undefined },
};

function textResult(text: string, overrides: Record<string, unknown> = {}) {
  return {
    content: [{ type: 'text' as const, text }],
    finishReason: { unified: 'stop' as const, raw: 'stop' },
    usage: USAGE,
    response: { id: 'gen-1', timestamp: new Date(0), modelId: 'deepseek/deepseek-v4.1-flash' },
    ...overrides,
  };
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return 'NO_ERROR_THROWN';
  } catch (error) {
    return isRenderApiError(error) ? error.code : 'NOT_A_RENDER_API_ERROR';
  }
}

describe('createOpenRouterAiAgentFromModel', () => {
  it('devuelve el objeto estructurado, el uso de tokens, el costo y el model id real', async () => {
    const model = new MockLanguageModelV4({
      doGenerate: textResult(JSON.stringify({ title: 'Nx en 30 segundos' }), {
        providerMetadata: { openrouter: { usage: { promptTokens: 120, completionTokens: 40, totalTokens: 160, cost: 0.0012 } } },
      }),
    });

    const response = await createOpenRouterAiAgentFromModel(model)(REQUEST);

    expect(response.json).toEqual({ title: 'Nx en 30 segundos' });
    expect(response.usage.tokensIn).toBe(120);
    expect(response.usage.tokensOut).toBe(40);
    expect(response.usage.costUsd).toBe(0.0012);
    expect(response.usage.model).toBe('deepseek/deepseek-v4.1-flash');
    expect(typeof response.usage.durationMs).toBe('number');
  });

  it('deja costUsd en null cuando OpenRouter no reporta contabilidad de uso', async () => {
    const model = new MockLanguageModelV4({
      doGenerate: textResult(JSON.stringify({ title: 'Sin costo reportado' })),
    });

    const response = await createOpenRouterAiAgentFromModel(model)(REQUEST);

    expect(response.usage.costUsd).toBeNull();
  });

  it('mapea un 401 a OPENROUTER_KEY_MISSING', async () => {
    const model = new MockLanguageModelV4({
      doGenerate: () => {
        throw new APICallError({ message: 'Unauthorized', url: 'https://openrouter.ai', requestBodyValues: {}, statusCode: 401 });
      },
    });

    const code = await codeOf(createOpenRouterAiAgentFromModel(model)(REQUEST));

    expect(code).toBe('OPENROUTER_KEY_MISSING');
  });

  it('mapea un 429 con la marca de cuota gratis a OPENROUTER_FREE_QUOTA_EXHAUSTED', async () => {
    const model = new MockLanguageModelV4({
      doGenerate: () => {
        throw new APICallError({
          message: 'free-models-per-day limit reached',
          url: 'https://openrouter.ai',
          requestBodyValues: {},
          statusCode: 429,
        });
      },
    });

    const code = await codeOf(createOpenRouterAiAgentFromModel(model)(REQUEST));

    expect(code).toBe('OPENROUTER_FREE_QUOTA_EXHAUSTED');
  });

  it('mapea otro 429 a AI_AGENT_RATE_LIMITED', async () => {
    const model = new MockLanguageModelV4({
      doGenerate: () => {
        throw new APICallError({ message: 'Too many requests', url: 'https://openrouter.ai', requestBodyValues: {}, statusCode: 429 });
      },
    });

    const code = await codeOf(createOpenRouterAiAgentFromModel(model)(REQUEST));

    expect(code).toBe('AI_AGENT_RATE_LIMITED');
  });

  it('mapea una salida que no es JSON a AI_AGENT_INVALID_OUTPUT', async () => {
    const model = new MockLanguageModelV4({
      doGenerate: textResult('esto no es JSON'),
    });

    const code = await codeOf(createOpenRouterAiAgentFromModel(model)(REQUEST));

    expect(code).toBe('AI_AGENT_INVALID_OUTPUT');
  });

  it('pasa el objeto parseado tal cual, sin validar el schema (lo valida el pipeline aguas abajo)', async () => {
    const model = new MockLanguageModelV4({
      doGenerate: textResult(JSON.stringify({ notTitle: 'no tiene el campo requerido' })),
    });

    const response = await createOpenRouterAiAgentFromModel(model)(REQUEST);

    expect(response.json).toEqual({ notTitle: 'no tiene el campo requerido' });
  });

  it('mapea cualquier otro fallo a AI_AGENT_FAILED', async () => {
    const model = new MockLanguageModelV4({
      doGenerate: () => {
        throw new Error('network exploded');
      },
    });

    const code = await codeOf(createOpenRouterAiAgentFromModel(model)(REQUEST));

    expect(code).toBe('AI_AGENT_FAILED');
  });
});
