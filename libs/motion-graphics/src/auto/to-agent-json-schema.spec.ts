import { describe, expect, it } from 'vitest';

import { toAgentJsonSchema } from './to-agent-json-schema';

describe('toAgentJsonSchema', () => {
  it('quita format y default de los esquemas, que el CLI del agente rechaza en silencio', () => {
    const schema = {
      type: 'object',
      properties: {
        measuredAt: { type: 'string', format: 'date-time' },
        source: { type: 'string', default: 'given' },
      },
    };

    expect(toAgentJsonSchema(schema)).toEqual({
      type: 'object',
      properties: { measuredAt: { type: 'string' }, source: { type: 'string' } },
    });
  });

  it('conserva una propiedad que se llama format o default', () => {
    const schema = {
      type: 'object',
      properties: { format: { type: 'string', enum: ['16:9', '9:16'] }, default: { type: 'boolean' } },
      required: ['format'],
    };

    expect(toAgentJsonSchema(schema)).toEqual(schema);
  });

  it('convierte una tupla prefixItems de un solo tipo en un items equivalente', () => {
    const image = { type: 'string', minLength: 1 };
    const schema = { type: 'array', prefixItems: [image, image, image], minItems: 3, maxItems: 3 };

    expect(toAgentJsonSchema(schema)).toEqual({ type: 'array', minItems: 3, maxItems: 3, items: image });
  });

  it('une en anyOf los tipos distintos de una tupla', () => {
    const schema = { type: 'array', prefixItems: [{ type: 'string' }, { type: 'number' }] };

    expect(toAgentJsonSchema(schema)).toEqual({ type: 'array', items: { anyOf: [{ type: 'string' }, { type: 'number' }] } });
  });

  it('desciende por oneOf y $defs', () => {
    const schema = { oneOf: [{ type: 'string', format: 'uri' }], $defs: { x: { type: 'string', default: 'a' } } };

    expect(toAgentJsonSchema(schema)).toEqual({ oneOf: [{ type: 'string' }], $defs: { x: { type: 'string' } } });
  });
});
