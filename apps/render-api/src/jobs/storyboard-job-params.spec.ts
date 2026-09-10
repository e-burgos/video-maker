import { describe, expect, it } from 'vitest';

import { isRenderApiError } from '../errors/render-api-error';
import { parseStoryboardInput, parseStoryboardOverwrite } from './storyboard-job-params';

function codeOf(run: () => unknown): string {
  try {
    run();
    return 'NO_ERROR_THROWN';
  } catch (error) {
    return isRenderApiError(error) ? error.code : 'NOT_A_RENDER_API_ERROR';
  }
}

describe('parseStoryboardInput', () => {
  it('acepta sólo brief', () => {
    expect(parseStoryboardInput({ brief: '  Un video sobre Nx.  ' })).toEqual({
      brief: 'Un video sobre Nx.',
      scriptText: null,
    });
  });

  it('acepta sólo scriptText', () => {
    expect(parseStoryboardInput({ scriptText: 'Hola. Hoy vemos Nx.' })).toEqual({
      brief: null,
      scriptText: 'Hola. Hoy vemos Nx.',
    });
  });

  it('rechaza los dos a la vez', () => {
    expect(codeOf(() => parseStoryboardInput({ brief: 'idea', scriptText: 'guion' }))).toBe(
      'STORYBOARD_INPUT_INVALID',
    );
  });

  it('rechaza que no venga ninguno', () => {
    expect(codeOf(() => parseStoryboardInput({}))).toBe('STORYBOARD_INPUT_INVALID');
    expect(codeOf(() => parseStoryboardInput({ brief: null, scriptText: null }))).toBe(
      'STORYBOARD_INPUT_INVALID',
    );
  });

  it.each([
    ['brief vacío', { brief: '' }],
    ['brief en blanco', { brief: '   ' }],
    ['brief no string', { brief: 42 }],
    ['scriptText vacío', { scriptText: '' }],
    ['scriptText no string', { scriptText: ['a'] }],
  ])('rechaza %s', (_title, body) => {
    expect(codeOf(() => parseStoryboardInput(body))).toBe('STORYBOARD_INPUT_INVALID');
  });
});

describe('parseStoryboardOverwrite', () => {
  it('es false por default y respeta el booleano recibido', () => {
    expect(parseStoryboardOverwrite(undefined)).toBe(false);
    expect(parseStoryboardOverwrite(false)).toBe(false);
    expect(parseStoryboardOverwrite(true)).toBe(true);
  });

  it.each(['true', 1, null, {}])('rechaza el valor no booleano %o', (value) => {
    expect(codeOf(() => parseStoryboardOverwrite(value))).toBe('STORYBOARD_OVERWRITE_INVALID');
  });
});
