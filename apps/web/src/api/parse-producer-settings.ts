import { isProducerModelOption } from './parse-producer';
import { OPENROUTER_MODEL_TIERS, PRODUCER_ENGINES } from './render-api-types';
import { responseShapeUnexpected } from './render-api-error';
import type {
  OpenRouterCatalogModel,
  OpenRouterKeyResult,
  OpenRouterModelBench,
  OpenRouterModelRecommendation,
  OpenRouterModelTier,
  OpenRouterModelsResult,
  ProducerClaudeEngineStatus,
  ProducerEngineId,
  ProducerModelOption,
  ProducerOpenRouterEngineStatus,
  ProducerSettings,
} from './render-api-types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isProducerEngineId(value: unknown): value is ProducerEngineId {
  return typeof value === 'string' && (PRODUCER_ENGINES as readonly string[]).includes(value);
}

function isProducerModelOptionArray(value: unknown): value is ProducerModelOption[] {
  return Array.isArray(value) && value.every(isProducerModelOption);
}

function isClaudeEngineStatus(value: unknown): value is ProducerClaudeEngineStatus {
  return (
    isRecord(value) &&
    typeof value['available'] === 'boolean' &&
    (value['reason'] === null || typeof value['reason'] === 'string') &&
    isProducerModelOptionArray(value['models'])
  );
}

function isOpenRouterEngineStatus(value: unknown): value is ProducerOpenRouterEngineStatus {
  return (
    isRecord(value) &&
    typeof value['keyPresent'] === 'boolean' &&
    (value['keyHint'] === null || typeof value['keyHint'] === 'string') &&
    isProducerModelOptionArray(value['models'])
  );
}

export function parseProducerSettings(value: unknown): ProducerSettings {
  if (
    !isRecord(value) ||
    !(value['engine'] === null || isProducerEngineId(value['engine'])) ||
    !(value['effectiveEngine'] === null || isProducerEngineId(value['effectiveEngine'])) ||
    !isRecord(value['engines']) ||
    !isClaudeEngineStatus(value['engines']['claudeCli']) ||
    !isOpenRouterEngineStatus(value['engines']['openrouter']) ||
    !isRecord(value['models']) ||
    !(value['models']['claude'] === null || typeof value['models']['claude'] === 'string') ||
    !(value['models']['openrouter'] === null || typeof value['models']['openrouter'] === 'string')
  ) {
    throw responseShapeUnexpected(200, 'producer settings');
  }
  return value as unknown as ProducerSettings;
}

export function parseOpenRouterKeyResult(value: unknown): OpenRouterKeyResult {
  if (
    !isRecord(value) ||
    typeof value['keyPresent'] !== 'boolean' ||
    (value['keyHint'] !== null && typeof value['keyHint'] !== 'string')
  ) {
    throw responseShapeUnexpected(200, 'an openrouter key result');
  }
  return value as OpenRouterKeyResult;
}

function isOpenRouterModelTier(value: unknown): value is OpenRouterModelTier {
  return typeof value === 'string' && (OPENROUTER_MODEL_TIERS as readonly string[]).includes(value);
}

function isOpenRouterModelBench(value: unknown): value is OpenRouterModelBench {
  return (
    isRecord(value) &&
    typeof value['successRate'] === 'number' &&
    typeof value['avgSteps'] === 'number' &&
    typeof value['avgSeconds'] === 'number' &&
    typeof value['avgCostUsd'] === 'number'
  );
}

function isOpenRouterModelRecommendation(value: unknown): value is OpenRouterModelRecommendation {
  return (
    isRecord(value) &&
    isOpenRouterModelTier(value['tier']) &&
    typeof value['notes'] === 'string' &&
    (value['bench'] === null || isOpenRouterModelBench(value['bench']))
  );
}

function isOpenRouterCatalogModel(value: unknown): value is OpenRouterCatalogModel {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    typeof value['name'] === 'string' &&
    typeof value['contextLength'] === 'number' &&
    isRecord(value['pricing']) &&
    typeof value['pricing']['promptPerMTokUsd'] === 'number' &&
    typeof value['pricing']['completionPerMTokUsd'] === 'number' &&
    typeof value['supportsImages'] === 'boolean' &&
    typeof value['isFree'] === 'boolean' &&
    typeof value['recommended'] === 'boolean' &&
    (value['recommendation'] === null || isOpenRouterModelRecommendation(value['recommendation']))
  );
}

export function parseOpenRouterModelsResult(value: unknown): OpenRouterModelsResult {
  if (
    !isRecord(value) ||
    !Array.isArray(value['models']) ||
    !value['models'].every(isOpenRouterCatalogModel) ||
    typeof value['fetchedAt'] !== 'string' ||
    typeof value['stale'] !== 'boolean'
  ) {
    throw responseShapeUnexpected(200, 'an openrouter models result');
  }
  return value as unknown as OpenRouterModelsResult;
}
