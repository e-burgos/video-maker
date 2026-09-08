import { describe, expect, it } from 'vitest';

import { PipelineStageError } from './pipeline-stage-error';
import type { RenderApiErrorCode, RenderPipelineStage } from './render-api-error';
import { translateEngineError } from './translate-engine-error';

interface TranslationCase {
  readonly engineError: string;
  readonly ownCode: RenderApiErrorCode;
  readonly stage: RenderPipelineStage;
  readonly stages: readonly RenderPipelineStage[];
  readonly input: unknown;
  readonly expected?: string;
  readonly hint?: string;
}

const TRANSLATION_CASES: readonly TranslationCase[] = [
  {
    engineError: 'RenderTimelineError INVALID_TIMELINE',
    ownCode: 'INVALID_TIMELINE',
    stage: 'render',
    stages: ['render'],
    input: { code: 'INVALID_TIMELINE' },
    expected: 'a timeline accepted by validateTimeline',
  },
  {
    engineError: 'RenderTimelineError BUNDLE_FAILED',
    ownCode: 'RENDER_BUNDLE_FAILED',
    stage: 'render',
    stages: ['render'],
    input: { code: 'BUNDLE_FAILED' },
  },
  {
    engineError: 'RenderTimelineError COMPOSITION_NOT_FOUND',
    ownCode: 'COMPOSITION_NOT_FOUND',
    stage: 'render',
    stages: ['render'],
    input: { code: 'COMPOSITION_NOT_FOUND' },
  },
  {
    engineError: 'RenderTimelineError RENDER_FAILED',
    ownCode: 'RENDER_FAILED',
    stage: 'render',
    stages: ['render'],
    input: { code: 'RENDER_FAILED' },
  },
  {
    engineError: 'UnresolvedAudioAssetError',
    ownCode: 'UNRESOLVED_AUDIO_ASSET',
    stage: 'mix',
    stages: ['mix'],
    input: { code: 'UNRESOLVED_AUDIO_ASSET' },
  },
  {
    engineError: 'MissingMediaStreamError stream=audio',
    ownCode: 'MISSING_AUDIO_STREAM',
    stage: 'mix',
    stages: ['mix'],
    input: { code: 'MISSING_MEDIA_STREAM', stream: 'audio' },
    expected: 'a voice asset carrying an audio stream',
  },
  {
    engineError: 'MissingMediaStreamError stream=video',
    ownCode: 'MISSING_VIDEO_STREAM',
    stage: 'mux',
    stages: ['mux'],
    input: { code: 'MISSING_MEDIA_STREAM', stream: 'video' },
    expected: 'a file carrying a video stream',
  },
  {
    engineError: 'CommandFailedError',
    ownCode: 'MEDIA_COMMAND_FAILED',
    stage: 'mix',
    stages: ['mix', 'mux', 'verify'],
    input: { code: 'COMMAND_FAILED' },
  },
  {
    engineError: 'UnparseableOutputError',
    ownCode: 'MEDIA_OUTPUT_UNPARSEABLE',
    stage: 'mix',
    stages: ['mix', 'verify'],
    input: { code: 'UNPARSEABLE_OUTPUT' },
  },
  {
    engineError: 'BinaryNotFoundError',
    ownCode: 'MEDIA_BINARY_NOT_FOUND',
    stage: 'mix',
    stages: ['mix', 'mux', 'verify'],
    input: { code: 'BINARY_NOT_FOUND' },
    hint: 'set FFMPEG_PATH and FFPROBE_PATH or install ffmpeg in PATH',
  },
];

describe('translateEngineError', () => {
  it.each(TRANSLATION_CASES)(
    'translates $engineError to $ownCode at stage $stage',
    ({ ownCode, stages, input, expected, hint }) => {
      for (const stage of stages) {
        const resource = `resource-for-${stage}`;
        const result = translateEngineError(input, stage, resource);

        expect(result).toBeInstanceOf(PipelineStageError);
        expect(result.code).toBe(ownCode);
        expect(result.stage).toBe(stage);
        expect(result.resource).toBe(resource);
        expect(result.cause).toBe(input);
        expect(result.expected).toBe(expected ?? null);
        expect(result.hint).toBe(hint ?? null);

        const alreadyTranslated = translateEngineError(result, stage, resource);
        expect(alreadyTranslated).toBe(result);
      }
    },
  );

  it('falls back to INTERNAL_ERROR for an unrecognised thrown value', () => {
    const unrecognisedValues: readonly unknown[] = [
      new Error('boom'),
      null,
      'plain string',
      { code: 'SOME_UNKNOWN_CODE' },
      { code: 42 },
    ];

    for (const value of unrecognisedValues) {
      const result = translateEngineError(value, 'render', 'resource.mp4');
      expect(result.code).toBe('INTERNAL_ERROR');
      expect(result.stage).toBe('render');
      expect(result.cause).toBe(value);
    }
  });

  it('uses WORKDIR_UNWRITABLE as the prepare-stage fallback', () => {
    const cause = new Error('EACCES');
    const result = translateEngineError(cause, 'prepare', 'work/renders/r1', 'WORKDIR_UNWRITABLE');

    expect(result.code).toBe('WORKDIR_UNWRITABLE');
    expect(result.stage).toBe('prepare');
    expect(result.cause).toBe(cause);

    const defaulted = translateEngineError(cause, 'prepare', 'work/renders/r1');
    expect(defaulted.code).toBe('INTERNAL_ERROR');
  });
});
