import { defaultRecommendedOpenRouterModel } from '../config/recommended-openrouter-models';
import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import {
  OPENROUTER_SECRET_NAME,
  PRODUCER_MODEL_OPENROUTER_SETTING_KEY,
  readEngineSetting,
  readModelSetting,
  resolveEffectiveProducerEngine,
} from '../http/handlers/producer-settings-handler';
import type { RenderApiRuntime } from '../http/render-api-runtime';
import type { ProducerEngineForEstimate } from './estimate-production';

async function openRouterPricing(
  deps: RenderApiDependencies,
  runtime: RenderApiRuntime,
  modelId: string,
): Promise<{ readonly promptPerMTokUsd: number; readonly completionPerMTokUsd: number } | null> {
  try {
    const { models } = await runtime.openRouterModelCatalog.load(deps.fetchRemote, Date.parse(deps.clock.nowIso()));
    return models.find((model) => model.id === modelId)?.pricing ?? null;
  } catch {
    return null;
  }
}

export async function resolveProducerEngineForEstimate(
  deps: RenderApiDependencies,
  runtime: RenderApiRuntime,
): Promise<ProducerEngineForEstimate> {
  const engine = resolveEffectiveProducerEngine(
    readEngineSetting(deps),
    await deps.probeProducerBinary(),
    (await deps.secretStore.get(OPENROUTER_SECRET_NAME)) !== null,
  );
  if (engine === null) {
    return { kind: 'none' };
  }
  if (engine === 'claude-cli') {
    return { kind: 'claude-cli' };
  }
  const model =
    readModelSetting(deps, PRODUCER_MODEL_OPENROUTER_SETTING_KEY) ?? defaultRecommendedOpenRouterModel().id;
  return { kind: 'openrouter', model, pricing: await openRouterPricing(deps, runtime, model) };
}
