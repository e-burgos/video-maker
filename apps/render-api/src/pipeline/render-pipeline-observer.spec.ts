import { describe, expect, it } from 'vitest';

import { isRenderApiError } from '../errors/render-api-error';
import { isRenderPipelineCanceled, RenderPipelineCanceledError } from './render-pipeline-observer';

describe('RenderPipelineCanceledError', () => {
  it('carries the stage that was about to start', () => {
    const error = new RenderPipelineCanceledError('mix');

    expect(error.stage).toBe('mix');
    expect(error).toBeInstanceOf(Error);
  });

  it('stays outside the RenderApiError hierarchy', () => {
    const error = new RenderPipelineCanceledError('verify');

    expect(isRenderApiError(error)).toBe(false);
  });
});

describe('isRenderPipelineCanceled', () => {
  it('recognises its own cancellation error and rejects any other value', () => {
    expect(isRenderPipelineCanceled(new RenderPipelineCanceledError('render'))).toBe(true);
    expect(isRenderPipelineCanceled(new Error('boom'))).toBe(false);
    expect(isRenderPipelineCanceled(null)).toBe(false);
    expect(isRenderPipelineCanceled(undefined)).toBe(false);
    expect(isRenderPipelineCanceled('render')).toBe(false);
  });
});
