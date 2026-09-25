import { RECOMMENDED_OPENROUTER_MODELS, isRecommendedOpenRouterModelId } from '../config/recommended-openrouter-models';
import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import type { OpenRouterModelCatalog } from './openrouter-model-catalog';

export interface OpenRouterModelKnowledge {
  readonly isKnownId: (id: string) => boolean;
  readonly supportsImagesFor: (id: string) => boolean;
  readonly describeKnownIds: () => string;
}

export async function loadOpenRouterModelKnowledge(
  deps: RenderApiDependencies,
  catalog: OpenRouterModelCatalog,
): Promise<OpenRouterModelKnowledge> {
  const nowMs = Date.parse(deps.clock.nowIso());
  const catalogModels = await catalog.load(deps.fetchRemote, nowMs).then(
    (result) => result.models,
    () => null,
  );

  return {
    isKnownId: (id) =>
      catalogModels !== null ? catalogModels.some((entry) => entry.id === id) : isRecommendedOpenRouterModelId(id),
    supportsImagesFor: (id) => catalogModels?.find((entry) => entry.id === id)?.supportsImages ?? false,
    describeKnownIds: () =>
      catalogModels !== null
        ? 'a tool-capable OpenRouter model id'
        : `one of ${RECOMMENDED_OPENROUTER_MODELS.map((entry) => entry.id).join(', ')}`,
  };
}
