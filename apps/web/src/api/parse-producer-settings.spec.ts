import { describe, expect, it } from 'vitest';

import { producerSettings } from './__fixtures__/producer';
import { parseOpenRouterKeyResult, parseProducerSettings } from './parse-producer-settings';
import { RenderApiError } from './render-api-error';

function shapeOf(value: object): string[] {
  return Object.keys(value).sort();
}

describe('parseProducerSettings', () => {
  it('accepts the exact shape EP-037 documents', () => {
    const parsed = parseProducerSettings(producerSettings());

    expect(shapeOf(parsed)).toEqual(['effectiveEngine', 'engine', 'engines', 'models']);
    expect(shapeOf(parsed.engines)).toEqual(['claudeCli', 'openrouter']);
    expect(parsed.effectiveEngine).toBe('claude-cli');
  });

  it('accepts no engine chosen and no key loaded', () => {
    const parsed = parseProducerSettings(
      producerSettings({
        engine: null,
        effectiveEngine: null,
        engines: {
          claudeCli: { available: false, reason: 'not installed', models: [] },
          openrouter: { keyPresent: false, keyHint: null, models: [] },
        },
      }),
    );

    expect(parsed.engine).toBeNull();
    expect(parsed.effectiveEngine).toBeNull();
    expect(parsed.engines.claudeCli.reason).toBe('not installed');
  });

  it.each([
    ['an unknown engine id', { engine: 'gpt5' }],
    ['claudeCli.available that is not a boolean', {
      engines: { claudeCli: { available: 'yes', reason: null, models: [] }, openrouter: { keyPresent: false, keyHint: null, models: [] } },
    }],
    ['an openrouter model without a description', {
      engines: {
        claudeCli: { available: true, reason: null, models: [] },
        openrouter: { keyPresent: true, keyHint: '1234', models: [{ id: 'x', label: 'X' }] },
      },
    }],
    ['a models block missing openrouter', { models: { claude: null } }],
  ])('rejects %s', (_label, overrides) => {
    expect(() =>
      parseProducerSettings(producerSettings(overrides as never)),
    ).toThrow(RenderApiError);
  });
});

describe('parseOpenRouterKeyResult', () => {
  it('accepts the 200 body of EP-039 and EP-040', () => {
    expect(parseOpenRouterKeyResult({ keyPresent: true, keyHint: 'ab12' })).toEqual({
      keyPresent: true,
      keyHint: 'ab12',
    });
    expect(parseOpenRouterKeyResult({ keyPresent: false, keyHint: null })).toEqual({
      keyPresent: false,
      keyHint: null,
    });
  });

  it('rejects a body without keyPresent', () => {
    expect(() => parseOpenRouterKeyResult({ keyHint: null })).toThrow(RenderApiError);
  });
});
