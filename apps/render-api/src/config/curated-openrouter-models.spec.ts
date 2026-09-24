import { describe, expect, it } from 'vitest';

import {
  CURATED_OPENROUTER_MODELS,
  curatedOpenRouterModelById,
  isCuratedOpenRouterModel,
} from './curated-openrouter-models';

describe('CURATED_OPENROUTER_MODELS', () => {
  it('has between 2 and 4 models, each with a non-empty id, label and description', () => {
    expect(CURATED_OPENROUTER_MODELS.length).toBeGreaterThanOrEqual(2);
    expect(CURATED_OPENROUTER_MODELS.length).toBeLessThanOrEqual(4);
    for (const model of CURATED_OPENROUTER_MODELS) {
      expect(model.id.length).toBeGreaterThan(0);
      expect(model.label.length).toBeGreaterThan(0);
      expect(model.description.length).toBeGreaterThan(0);
      expect(typeof model.supportsImages).toBe('boolean');
    }
  });

  it('has no duplicate ids', () => {
    const ids = CURATED_OPENROUTER_MODELS.map((model) => model.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('isCuratedOpenRouterModel', () => {
  it('accepts a curated id', () => {
    expect(isCuratedOpenRouterModel(CURATED_OPENROUTER_MODELS[0]?.id ?? '')).toBe(true);
  });

  it('rejects an unknown id', () => {
    expect(isCuratedOpenRouterModel('acme/ghost-model')).toBe(false);
  });
});

describe('curatedOpenRouterModelById', () => {
  it('returns the model for a curated id', () => {
    const first = CURATED_OPENROUTER_MODELS[0];
    expect(curatedOpenRouterModelById(first?.id ?? '')).toEqual(first);
  });

  it('returns null for an unknown id', () => {
    expect(curatedOpenRouterModelById('acme/ghost-model')).toBeNull();
  });
});
