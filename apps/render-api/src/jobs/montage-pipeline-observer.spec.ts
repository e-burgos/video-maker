import { describe, expect, it, vi } from 'vitest';

import { isRenderApiError } from '../errors/render-api-error';
import { PipelineStageError } from '../errors/pipeline-stage-error';
import {
  checkpoint,
  isMontagePipelineCanceled,
  MontagePipelineCanceledError,
} from './montage-pipeline-observer';
import type { MontagePipelineObserver } from './montage-pipeline-observer';

describe('MontagePipelineCanceledError', () => {
  it('carries the stage that was about to start', () => {
    const error = new MontagePipelineCanceledError('plan');

    expect(error.stage).toBe('plan');
    expect(error).toBeInstanceOf(Error);
  });

  it('stays outside the RenderApiError hierarchy', () => {
    const error = new MontagePipelineCanceledError('transcribe');

    expect(isRenderApiError(error)).toBe(false);
  });
});

describe('isMontagePipelineCanceled', () => {
  it('recognises its own cancellation error and rejects a plain Error', () => {
    expect(isMontagePipelineCanceled(new MontagePipelineCanceledError('discover'))).toBe(true);
    expect(isMontagePipelineCanceled(new Error('boom'))).toBe(false);
  });

  it('rejects a PipelineStageError, the other error hierarchy of this project', () => {
    const stageError = new PipelineStageError({ code: 'MONTAGE_FAILED', stage: 'probe' });

    expect(isMontagePipelineCanceled(stageError)).toBe(false);
  });

  it('rejects null, undefined and a string', () => {
    expect(isMontagePipelineCanceled(null)).toBe(false);
    expect(isMontagePipelineCanceled(undefined)).toBe(false);
    expect(isMontagePipelineCanceled('discover')).toBe(false);
  });

  it('rejects a plain object that merely imitates the shape', () => {
    const impostor = { name: 'MontagePipelineCanceledError', stage: 'plan', message: 'fake' };

    expect(isMontagePipelineCanceled(impostor)).toBe(false);
  });
});

describe('MontagePipelineObserver.assetProcessed', () => {
  it('accepts the totalAssets known by the pipeline alongside the stage', () => {
    const received: Array<readonly [('probe' | 'transcribe'), number]> = [];
    const observer: MontagePipelineObserver = {
      stageStarted: () => undefined,
      assetProcessed: (stage, totalAssets) => {
        received.push([stage, totalAssets]);
      },
      cancellationRequested: () => false,
    };

    observer.assetProcessed('probe', 7);

    expect(received).toEqual([['probe', 7]]);
  });
});

describe('checkpoint', () => {
  function observerRequesting(cancellationRequested: boolean): MontagePipelineObserver {
    return {
      stageStarted: () => undefined,
      assetProcessed: () => undefined,
      cancellationRequested: () => cancellationRequested,
    };
  }

  it('does nothing when cancellation was not requested', () => {
    expect(() => checkpoint(observerRequesting(false), 'plan')).not.toThrow();
  });

  it('throws MontagePipelineCanceledError carrying the checkpoint stage when cancellation was requested', () => {
    let thrown: unknown;
    try {
      checkpoint(observerRequesting(true), 'plan');
    } catch (error) {
      thrown = error;
    }

    expect(isMontagePipelineCanceled(thrown)).toBe(true);
    expect((thrown as MontagePipelineCanceledError).stage).toBe('plan');
  });

  it('does nothing when there is no observer at all', () => {
    expect(() => checkpoint(undefined, 'discover')).not.toThrow();
  });

  it('only ever reads cancellationRequested, never stageStarted or assetProcessed', () => {
    const observer: MontagePipelineObserver = {
      stageStarted: vi.fn(),
      assetProcessed: vi.fn(),
      cancellationRequested: () => false,
    };

    checkpoint(observer, 'probe');

    expect(observer.stageStarted).not.toHaveBeenCalled();
    expect(observer.assetProcessed).not.toHaveBeenCalled();
  });
});
