import { describe, expect, it } from 'vitest';
import { isRenderApiError } from './render-api-error';
import type { RenderApiErrorPayload } from './render-api-error';
import { PipelineStageError } from './pipeline-stage-error';

describe('isRenderApiError', () => {
  it('distinguishes the own hierarchy from a plain Error and a non-error value', () => {
    const ownError = new PipelineStageError({ code: 'INTERNAL_ERROR', stage: null });
    const plainError = new Error('boom');

    expect(isRenderApiError(ownError)).toBe(true);
    expect(isRenderApiError(plainError)).toBe(false);
    expect(isRenderApiError(null)).toBe(false);
    expect(isRenderApiError('not-an-error')).toBe(false);
  });
});

describe('RenderApiErrorPayload.stage', () => {
  it('accepts a montage stage in addition to a render pipeline stage', () => {
    const payload: RenderApiErrorPayload = {
      code: 'MONTAGE_INPUT_INVALID',
      stage: 'plan',
      message: 'The montage input does not have enough usable assets to build a timeline.',
    };

    expect(payload.stage).toBe('plan');
  });
});
