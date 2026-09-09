import { describe, expect, it } from 'vitest';

import { readJsonBody } from './read-json-body';

async function* toChunks(values: readonly string[]): AsyncGenerator<Uint8Array> {
  const encoder = new TextEncoder();
  for (const value of values) {
    yield encoder.encode(value);
  }
}

describe('readJsonBody', () => {
  it('parses a JSON object, reports invalid-json and stops consuming past the limit', async () => {
    const parsed = await readJsonBody(toChunks(['{"a":1,', '"b":2}']), 1024);
    expect(parsed).toEqual({ kind: 'parsed', value: { a: 1, b: 2 } });

    const invalid = await readJsonBody(toChunks(['not json']), 1024);
    expect(invalid).toEqual({ kind: 'invalid-json' });

    let pulledChunks = 0;
    async function* countedChunks(): AsyncGenerator<Uint8Array> {
      const encoder = new TextEncoder();
      const chunk = encoder.encode('x'.repeat(10));
      for (;;) {
        pulledChunks += 1;
        yield chunk;
      }
    }

    const tooLarge = await readJsonBody(countedChunks(), 25);
    expect(tooLarge).toEqual({ kind: 'too-large' });
    expect(pulledChunks).toBe(3);
  });
});
