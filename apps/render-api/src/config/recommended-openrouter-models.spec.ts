import { describe, expect, it } from 'vitest';

import {
  RECOMMENDED_OPENROUTER_MODELS,
  defaultRecommendedOpenRouterModel,
  isRecommendedOpenRouterModelId,
  readRecommendedOpenRouterModels,
  recommendedOpenRouterModelById,
} from './recommended-openrouter-models';

describe('RECOMMENDED_OPENROUTER_MODELS', () => {
  it('has exactly one entry marked isDefault', () => {
    const defaults = RECOMMENDED_OPENROUTER_MODELS.filter((model) => model.isDefault);
    expect(defaults).toHaveLength(1);
  });

  it('defaultRecommendedOpenRouterModel returns that one entry', () => {
    const model = defaultRecommendedOpenRouterModel();
    expect(model.isDefault).toBe(true);
    expect(RECOMMENDED_OPENROUTER_MODELS.find((entry) => entry.isDefault)).toBe(model);
  });

  it('knows the real benchmarked ids', () => {
    expect(isRecommendedOpenRouterModelId('deepseek/deepseek-v4.1-flash')).toBe(true);
    expect(isRecommendedOpenRouterModelId('anthropic/claude-haiku-4.5')).toBe(true);
    expect(isRecommendedOpenRouterModelId('openai/gpt-4o-mini')).toBe(false);
  });

  it('recommendedOpenRouterModelById returns null for an unknown id', () => {
    expect(recommendedOpenRouterModelById('nope/nope')).toBeNull();
  });
});

describe('readRecommendedOpenRouterModels', () => {
  const VALID_ENTRY = {
    id: 'a/a',
    tier: 'cheap',
    notes: 'n',
    bench: null,
    isDefault: true,
  };

  it('rejects an array with no isDefault entry', () => {
    expect(() => readRecommendedOpenRouterModels([{ ...VALID_ENTRY, isDefault: false }])).toThrow();
  });

  it('rejects an array with more than one isDefault entry', () => {
    expect(() =>
      readRecommendedOpenRouterModels([VALID_ENTRY, { ...VALID_ENTRY, id: 'b/b' }]),
    ).toThrow();
  });

  it('rejects an entry missing isDefault entirely', () => {
    const withoutIsDefault: Record<string, unknown> = { ...VALID_ENTRY };
    delete withoutIsDefault['isDefault'];
    expect(() => readRecommendedOpenRouterModels([withoutIsDefault])).toThrow();
  });

  it('accepts a single well-formed entry', () => {
    expect(readRecommendedOpenRouterModels([VALID_ENTRY])).toEqual([VALID_ENTRY]);
  });
});
