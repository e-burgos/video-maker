import { describe, expect, it, vi } from 'vitest';

import { isRenderApiError } from '../errors/render-api-error';
import { PipelineStageError } from '../errors/pipeline-stage-error';
import {
  checkpoint,
  isPhotoArollPipelineCanceled,
  PhotoArollPipelineCanceledError,
} from './photo-aroll-pipeline-observer';
import type { PhotoArollPipelineObserver } from './photo-aroll-pipeline-observer';

describe('PhotoArollPipelineCanceledError', () => {
  it('carries the stage that was about to start', () => {
    const error = new PhotoArollPipelineCanceledError('concat');

    expect(error.stage).toBe('concat');
    expect(error).toBeInstanceOf(Error);
  });

  it('stays outside the RenderApiError hierarchy', () => {
    const error = new PhotoArollPipelineCanceledError('mux');

    expect(isRenderApiError(error)).toBe(false);
  });
});

describe('isPhotoArollPipelineCanceled', () => {
  it('recognises its own cancellation error and rejects a plain Error', () => {
    expect(isPhotoArollPipelineCanceled(new PhotoArollPipelineCanceledError('clips'))).toBe(true);
    expect(isPhotoArollPipelineCanceled(new Error('boom'))).toBe(false);
  });

  it('rejects a PipelineStageError, the other error hierarchy of this project', () => {
    const stageError = new PipelineStageError({ code: 'PHOTO_AROLL_INPUT_INVALID', stage: null });

    expect(isPhotoArollPipelineCanceled(stageError)).toBe(false);
  });

  it('rejects null, undefined and a string', () => {
    expect(isPhotoArollPipelineCanceled(null)).toBe(false);
    expect(isPhotoArollPipelineCanceled(undefined)).toBe(false);
    expect(isPhotoArollPipelineCanceled('clips')).toBe(false);
  });
});

describe('PhotoArollPipelineObserver.clipProcessed', () => {
  it('accepts the totalClips known by the pipeline', () => {
    const received: number[] = [];
    const observer: PhotoArollPipelineObserver = {
      stageStarted: () => undefined,
      clipProcessed: (totalClips) => {
        received.push(totalClips);
      },
      cancellationRequested: () => false,
    };

    observer.clipProcessed(11);

    expect(received).toEqual([11]);
  });
});

describe('checkpoint', () => {
  function observerRequesting(cancellationRequested: boolean): PhotoArollPipelineObserver {
    return {
      stageStarted: () => undefined,
      clipProcessed: () => undefined,
      cancellationRequested: () => cancellationRequested,
    };
  }

  it('does nothing when cancellation was not requested', () => {
    expect(() => checkpoint(observerRequesting(false), 'concat')).not.toThrow();
  });

  it('throws PhotoArollPipelineCanceledError carrying the checkpoint stage when cancellation was requested', () => {
    let thrown: unknown;
    try {
      checkpoint(observerRequesting(true), 'mux');
    } catch (error) {
      thrown = error;
    }

    expect(isPhotoArollPipelineCanceled(thrown)).toBe(true);
    expect((thrown as PhotoArollPipelineCanceledError).stage).toBe('mux');
  });

  it('does nothing when there is no observer at all', () => {
    expect(() => checkpoint(undefined, 'clips')).not.toThrow();
  });

  it('only ever reads cancellationRequested, never stageStarted or clipProcessed', () => {
    const observer: PhotoArollPipelineObserver = {
      stageStarted: vi.fn(),
      clipProcessed: vi.fn(),
      cancellationRequested: () => false,
    };

    checkpoint(observer, 'clips');

    expect(observer.stageStarted).not.toHaveBeenCalled();
    expect(observer.clipProcessed).not.toHaveBeenCalled();
  });
});
