import { defaultRecommendedOpenRouterModel } from '../config/recommended-openrouter-models';
import type { AiAgentPort, AiAgentRequest, AiAgentResponse, RenderApiDependencies } from '../deps/render-api-dependencies';
import { openRouterKeyMissing, producerUnavailable } from '../errors/translate-producer-error';
import {
  OPENROUTER_SECRET_NAME,
  PRODUCER_MODEL_OPENROUTER_SETTING_KEY,
  readEngineSetting,
  readModelSetting,
  resolveEffectiveProducerEngine,
} from '../http/handlers/producer-settings-handler';
import { createOpenRouterModelCatalog } from '../producer/openrouter-model-catalog';
import type { OpenRouterModelCatalog } from '../producer/openrouter-model-catalog';
import { loadOpenRouterModelKnowledge } from '../producer/openrouter-model-knowledge';
import { createOpenRouterAiAgent } from './openrouter-ai-agent';
import type { OpenRouterAiAgentConfig } from './openrouter-ai-agent';

export type CreateOpenRouterAiAgent = (config: OpenRouterAiAgentConfig) => AiAgentPort;

async function resolveStoryboardOpenRouterModel(
  requestedModel: string | null,
  deps: RenderApiDependencies,
  catalog: OpenRouterModelCatalog,
): Promise<string> {
  const knowledge = await loadOpenRouterModelKnowledge(deps, catalog);

  if (requestedModel !== null && knowledge.isKnownId(requestedModel)) {
    return requestedModel;
  }

  const configured = readModelSetting(deps, PRODUCER_MODEL_OPENROUTER_SETTING_KEY);
  if (configured !== null && knowledge.isKnownId(configured)) {
    return configured;
  }

  return defaultRecommendedOpenRouterModel().id;
}

export function createEffectiveAiAgent(
  deps: RenderApiDependencies,
  claudeAgent: AiAgentPort,
  openRouterCatalog: OpenRouterModelCatalog = createOpenRouterModelCatalog(),
  openRouterAgentFactory: CreateOpenRouterAiAgent = createOpenRouterAiAgent,
): AiAgentPort {
  return async (request: AiAgentRequest): Promise<AiAgentResponse> => {
    const claudeAvailable = await deps.probeProducerBinary();
    const storedOpenRouterKey = await deps.secretStore.get(OPENROUTER_SECRET_NAME);
    const engine = resolveEffectiveProducerEngine(readEngineSetting(deps), claudeAvailable, storedOpenRouterKey !== null);

    if (engine === null || (engine === 'claude-cli' && !claudeAvailable)) {
      throw producerUnavailable();
    }

    if (engine === 'claude-cli') {
      return claudeAgent(request);
    }

    if (storedOpenRouterKey === null) {
      throw openRouterKeyMissing();
    }

    const model = await resolveStoryboardOpenRouterModel(request.model ?? null, deps, openRouterCatalog);
    const agent = openRouterAgentFactory({ apiKey: storedOpenRouterKey, model });
    return agent(request);
  };
}
