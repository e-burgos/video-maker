import { describe, expect, it } from 'vitest';

import {
  isStoryboardPipelineCanceled,
  storyboardCheckpoint,
  StoryboardPipelineCanceledError,
} from './storyboard-pipeline-observer';

describe('storyboardCheckpoint', () => {
  it('no hace nada sin observer', () => {
    expect(() => storyboardCheckpoint(undefined, 'collect')).not.toThrow();
  });

  it('no hace nada cuando no se pidió cancelar', () => {
    expect(() =>
      storyboardCheckpoint({ stageStarted: () => undefined, cancellationRequested: () => false }, 'propose'),
    ).not.toThrow();
  });

  it('corta con la etapa en la que se pidió cancelar', () => {
    try {
      storyboardCheckpoint(
        { stageStarted: () => undefined, cancellationRequested: () => true },
        'persist',
      );
      expect.unreachable('el checkpoint debe cortar');
    } catch (error) {
      expect(isStoryboardPipelineCanceled(error)).toBe(true);
      expect(error instanceof StoryboardPipelineCanceledError && error.stage).toBe('persist');
    }
  });

  it('no confunde otro error con una cancelación', () => {
    expect(isStoryboardPipelineCanceled(new Error('otra cosa'))).toBe(false);
  });
});
