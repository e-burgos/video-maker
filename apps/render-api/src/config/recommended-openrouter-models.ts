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
}

const PLACEHOLDER_NOTES =
  'Placeholder pending the tool-calling benchmark (plan.md D-C4-06); the benchmark agent replaces this set.';

// Seed data pending TASK-006's benchmark (plan.md D-C4-06 note). Kept as a plain, JSON-shaped
// literal so the benchmark agent can replace it wholesale without touching the loader below.
const RAW_RECOMMENDED_OPENROUTER_MODELS: readonly unknown[] = [
  { id: 'anthropic/claude-haiku-4.5', tier: 'reference', notes: PLACEHOLDER_NOTES, bench: null },
  { id: 'openai/gpt-4o-mini', tier: 'reference', notes: PLACEHOLDER_NOTES, bench: null },
  { id: 'google/gemini-3.5-flash-lite', tier: 'reference', notes: PLACEHOLDER_NOTES, bench: null },
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
    (value['bench'] === null || isBench(value['bench']))
  );
}

export function readRecommendedOpenRouterModels(raw: unknown): readonly RecommendedOpenRouterModel[] {
  if (!Array.isArray(raw) || raw.length === 0 || !raw.every(isRecommendedOpenRouterModel)) {
    throw new PipelineStageError({
      code: 'SERVER_CONFIG_INVALID',
      stage: null,
      resource: 'config/recommended-openrouter-models',
      expected: 'a non-empty array of { id, tier: free|cheap|reference, notes, bench }',
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
