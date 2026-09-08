import { describe, expect, it } from 'vitest';

import { isRenderCliError, RenderCliError } from './render-cli-error';
import type { RenderCliErrorCode, Stage } from './render-cli-error';

class FakeRenderCliError extends RenderCliError {
  readonly code: RenderCliErrorCode = 'CLI_USAGE';
  readonly stage: Stage | null = null;
  readonly resource: string | null = null;
  readonly reason = 'fake-reason';
  readonly expected: string | null = null;
  readonly hint: string | null = null;
}

describe('isRenderCliError', () => {
  it('returns true for an instance of the abstract hierarchy', () => {
    expect(isRenderCliError(new FakeRenderCliError('fake-reason'))).toBe(true);
  });

  it('returns false for a plain Error', () => {
    expect(isRenderCliError(new Error('plain'))).toBe(false);
  });

  it('returns false for a non-error value', () => {
    expect(isRenderCliError('not-an-error')).toBe(false);
  });
});
