import { PipelineStageError } from '../errors/pipeline-stage-error';

export const RECOMMENDED_OPENROUTER_MODEL_TIERS = ['free', 'cheap', 'reference'] as const;

export type RecommendedOpenRouterModelTier = (typeof RECOMMENDED_OPENROUTER_MODEL_TIERS)[number];

export interface RecommendedOpenRouterModelBench {
  readonly successRate: number;
  readonly avgSteps: number;
  readonly avgSeconds: number;
  readonly avgCostUsd: number;
}

export interface RecommendedOpenRouterModel {
  readonly id: string;
  readonly tier: RecommendedOpenRouterModelTier;
  readonly notes: string;
  readonly bench: RecommendedOpenRouterModelBench | null;
  readonly isDefault: boolean;
}

// Real results from TASK-006's benchmark (plan.md D-C4-06), 2 runs per model against the real
// producer runtime — see sdd/specs/spec-e-burgos-017-desktop-app/cycles/cycle-04/artifacts/
// openrouter-model-bench.md. The 4 free candidates could not be scored: this OpenRouter account
// had already hit its free-models-per-day quota (account-wide, not per-model) on 2026-09-24; a
// free tier entry lands here once a free-tier re-run passes after the daily reset.
const RAW_RECOMMENDED_OPENROUTER_MODELS: readonly unknown[] = [
  {
    id: 'anthropic/claude-haiku-4.5',
    tier: 'reference',
    notes: '2/2 en el benchmark real. La más rápida y confiable, pero ~21x el costo de deepseek por turno.',
    bench: { successRate: 1, avgSteps: 7, avgSeconds: 70.8, avgCostUsd: 0.097188 },
    isDefault: false,
  },
  {
    id: 'deepseek/deepseek-v4.1-flash',
    tier: 'cheap',
    notes: '2/2 en el benchmark real, la más barata que pasó limpio las dos corridas. Motor por defecto de OpenRouter.',
    bench: { successRate: 1, avgSteps: 9.5, avgSeconds: 118.2, avgCostUsd: 0.0045477663 },
    isDefault: true,
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTier(value: unknown): value is RecommendedOpenRouterModelTier {
  return typeof value === 'string' && (RECOMMENDED_OPENROUTER_MODEL_TIERS as readonly string[]).includes(value);
}

function isBench(value: unknown): value is RecommendedOpenRouterModelBench {
  return (
    isRecord(value) &&
    typeof value['successRate'] === 'number' &&
    typeof value['avgSteps'] === 'number' &&
    typeof value['avgSeconds'] === 'number' &&
    typeof value['avgCostUsd'] === 'number'
  );
}

function isRecommendedOpenRouterModel(value: unknown): value is RecommendedOpenRouterModel {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    value['id'] !== '' &&
    isTier(value['tier']) &&
    typeof value['notes'] === 'string' &&
    (value['bench'] === null || isBench(value['bench'])) &&
    typeof value['isDefault'] === 'boolean'
  );
}

export function readRecommendedOpenRouterModels(raw: unknown): readonly RecommendedOpenRouterModel[] {
  if (!Array.isArray(raw) || raw.length === 0 || !raw.every(isRecommendedOpenRouterModel)) {
    throw new PipelineStageError({
      code: 'SERVER_CONFIG_INVALID',
      stage: null,
      resource: 'config/recommended-openrouter-models',
      expected: 'a non-empty array of { id, tier: free|cheap|reference, notes, bench, isDefault }',
    });
  }
  if (raw.filter((model) => model.isDefault).length !== 1) {
    throw new PipelineStageError({
      code: 'SERVER_CONFIG_INVALID',
      stage: null,
      resource: 'config/recommended-openrouter-models',
      expected: 'exactly one entry with isDefault: true',
    });
  }
  return raw;
}

export const RECOMMENDED_OPENROUTER_MODELS: readonly RecommendedOpenRouterModel[] = readRecommendedOpenRouterModels(
  RAW_RECOMMENDED_OPENROUTER_MODELS,
);

export function isRecommendedOpenRouterModelId(id: string): boolean {
  return RECOMMENDED_OPENROUTER_MODELS.some((model) => model.id === id);
}

export function recommendedOpenRouterModelById(id: string): RecommendedOpenRouterModel | null {
  return RECOMMENDED_OPENROUTER_MODELS.find((model) => model.id === id) ?? null;
}

export function defaultRecommendedOpenRouterModel(): RecommendedOpenRouterModel {
  const found = RECOMMENDED_OPENROUTER_MODELS.find((model) => model.isDefault);
  if (found === undefined) {
    throw new PipelineStageError({
      code: 'SERVER_CONFIG_INVALID',
      stage: null,
      resource: 'config/recommended-openrouter-models',
      expected: 'exactly one entry with isDefault: true',
    });
  }
  return found;
}
