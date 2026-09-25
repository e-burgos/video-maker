import { describe, expect, it } from 'vitest';

import { createCallLog } from '../__fixtures__/call-log';
import { createFakeFetchRemote, jsonBodyChunks } from '../__fixtures__/fake-fetch-remote';
import { createFakeRenderApiDependencies } from '../__fixtures__/fake-render-api-dependencies';
import { OPENROUTER_MODELS_SAMPLE_PAYLOAD } from '../__fixtures__/openrouter-models-sample';
import { defaultRecommendedOpenRouterModel } from '../config/recommended-openrouter-models';
import type { AiAgentPort, AiAgentRequest, AiAgentResponse } from '../deps/render-api-dependencies';
import { isRenderApiError } from '../errors/render-api-error';
import {
  OPENROUTER_SECRET_NAME,
  PRODUCER_ENGINE_SETTING_KEY,
  PRODUCER_MODEL_OPENROUTER_SETTING_KEY,
} from '../http/handlers/producer-settings-handler';
import type { OpenRouterAiAgentConfig } from './openrouter-ai-agent';
import { createEffectiveAiAgent } from './effective-ai-agent';
import type { CreateOpenRouterAiAgent } from './effective-ai-agent';

const REQUEST: AiAgentRequest = {
  systemPrompt: 'You are a storyboard writer.',
  userPrompt: 'Write a storyboard about Nx.',
  jsonSchema: { type: 'object', properties: { title: { type: 'string' } } },
  model: null,
};

const KNOWN_CATALOG_MODEL = 'openai/gpt-4o-mini';
const CLAUDE_ALIAS = 'sonnet';
const OPENROUTER_SECRET = 'sk-or-v1-never-leak-this-exact-string';

function fakeClaudeAgent(): { agent: AiAgentPort; requests: AiAgentRequest[] } {
  const requests: AiAgentRequest[] = [];
  const agent: AiAgentPort = async (request) => {
    requests.push(request);
    return { json: { via: 'claude' }, usage: { tokensIn: 1, tokensOut: 2, costUsd: null, durationMs: 10, model: 'sonnet' } };
  };
  return { agent, requests };
}

function fakeOpenRouterAgentFactory(): { factory: CreateOpenRouterAiAgent; configs: OpenRouterAiAgentConfig[] } {
  const configs: OpenRouterAiAgentConfig[] = [];
  const factory: CreateOpenRouterAiAgent = (config) => {
    configs.push(config);
    const agent: AiAgentPort = async (): Promise<AiAgentResponse> => ({
      json: { via: 'openrouter' },
      usage: { tokensIn: 3, tokensOut: 4, costUsd: 0.001, durationMs: 20, model: config.model },
    });
    return agent;
  };
  return { factory, configs };
}

function scenario(overrides: Parameters<typeof createFakeRenderApiDependencies>[1] = {}) {
  const callLog = createCallLog();
  const deps = createFakeRenderApiDependencies(callLog, {
    fetchRemote: createFakeFetchRemote({ status: 200, bodyChunks: jsonBodyChunks(OPENROUTER_MODELS_SAMPLE_PAYLOAD) })
      .fetchRemote,
    ...overrides,
  });
  return { deps };
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return 'NO_ERROR_THROWN';
  } catch (error) {
    return isRenderApiError(error) ? error.code : 'NOT_A_RENDER_API_ERROR';
  }
}

describe('createEffectiveAiAgent', () => {
  it('usa el agente de Claude cuando no hay setting de motor y Claude está disponible', async () => {
    const { deps } = scenario();
    const claude = fakeClaudeAgent();
    const openRouter = fakeOpenRouterAgentFactory();

    const response = await createEffectiveAiAgent(deps, claude.agent, undefined, openRouter.factory)(REQUEST);

    expect(response.json).toEqual({ via: 'claude' });
    expect(claude.requests).toEqual([REQUEST]);
    expect(openRouter.configs).toEqual([]);
  });

  it('rechaza con PRODUCER_UNAVAILABLE cuando el setting es claude-cli pero el binario no está disponible', async () => {
    const { deps } = scenario({ probeProducerBinary: async () => false });
    deps.localStore.settings.set(PRODUCER_ENGINE_SETTING_KEY, 'claude-cli');
    const claude = fakeClaudeAgent();
    const openRouter = fakeOpenRouterAgentFactory();

    const code = await codeOf(createEffectiveAiAgent(deps, claude.agent, undefined, openRouter.factory)(REQUEST));

    expect(code).toBe('PRODUCER_UNAVAILABLE');
  });

  it('rechaza con PRODUCER_UNAVAILABLE cuando no hay setting, Claude no está disponible y no hay key guardada', async () => {
    const { deps } = scenario({ probeProducerBinary: async () => false });
    const claude = fakeClaudeAgent();
    const openRouter = fakeOpenRouterAgentFactory();

    const code = await codeOf(createEffectiveAiAgent(deps, claude.agent, undefined, openRouter.factory)(REQUEST));

    expect(code).toBe('PRODUCER_UNAVAILABLE');
  });

  it('cae a OpenRouter cuando no hay setting, Claude no está disponible y hay una key guardada', async () => {
    const { deps } = scenario({ probeProducerBinary: async () => false });
    await deps.secretStore.set(OPENROUTER_SECRET_NAME, OPENROUTER_SECRET);
    const claude = fakeClaudeAgent();
    const openRouter = fakeOpenRouterAgentFactory();

    const response = await createEffectiveAiAgent(deps, claude.agent, undefined, openRouter.factory)(REQUEST);

    expect(response.json).toEqual({ via: 'openrouter' });
    expect(claude.requests).toEqual([]);
    expect(openRouter.configs).toHaveLength(1);
  });

  it('rechaza con OPENROUTER_KEY_MISSING cuando el motor es openrouter y no hay key guardada', async () => {
    const { deps } = scenario();
    deps.localStore.settings.set(PRODUCER_ENGINE_SETTING_KEY, 'openrouter');
    const claude = fakeClaudeAgent();
    const openRouter = fakeOpenRouterAgentFactory();

    const code = await codeOf(createEffectiveAiAgent(deps, claude.agent, undefined, openRouter.factory)(REQUEST));

    expect(code).toBe('OPENROUTER_KEY_MISSING');
    expect(openRouter.configs).toEqual([]);
  });

  it('usa el model del request cuando es un id de OpenRouter conocido por el catálogo', async () => {
    const { deps } = scenario();
    deps.localStore.settings.set(PRODUCER_ENGINE_SETTING_KEY, 'openrouter');
    await deps.secretStore.set(OPENROUTER_SECRET_NAME, OPENROUTER_SECRET);
    const claude = fakeClaudeAgent();
    const openRouter = fakeOpenRouterAgentFactory();

    await createEffectiveAiAgent(deps, claude.agent, undefined, openRouter.factory)({
      ...REQUEST,
      model: KNOWN_CATALOG_MODEL,
    });

    expect(openRouter.configs[0]?.model).toBe(KNOWN_CATALOG_MODEL);
    expect(openRouter.configs[0]?.apiKey).toBe(OPENROUTER_SECRET);
  });

  it('ignora un alias de Claude en el request y usa el modelo de OpenRouter configurado', async () => {
    const { deps } = scenario();
    deps.localStore.settings.set(PRODUCER_ENGINE_SETTING_KEY, 'openrouter');
    deps.localStore.settings.set(PRODUCER_MODEL_OPENROUTER_SETTING_KEY, KNOWN_CATALOG_MODEL);
    await deps.secretStore.set(OPENROUTER_SECRET_NAME, OPENROUTER_SECRET);
    const claude = fakeClaudeAgent();
    const openRouter = fakeOpenRouterAgentFactory();

    await createEffectiveAiAgent(deps, claude.agent, undefined, openRouter.factory)({ ...REQUEST, model: CLAUDE_ALIAS });

    expect(openRouter.configs[0]?.model).toBe(KNOWN_CATALOG_MODEL);
  });

  it('cae al modelo recomendado por defecto cuando no hay model en el request ni setting configurado', async () => {
    const { deps } = scenario();
    deps.localStore.settings.set(PRODUCER_ENGINE_SETTING_KEY, 'openrouter');
    await deps.secretStore.set(OPENROUTER_SECRET_NAME, OPENROUTER_SECRET);
    const claude = fakeClaudeAgent();
    const openRouter = fakeOpenRouterAgentFactory();

    await createEffectiveAiAgent(deps, claude.agent, undefined, openRouter.factory)(REQUEST);

    expect(openRouter.configs[0]?.model).toBe(defaultRecommendedOpenRouterModel().id);
  });
});
