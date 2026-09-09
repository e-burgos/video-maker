import type { MediaLocalErrorCode } from '@video-maker/media-local';
import type { RenderTimelineErrorCode } from '@video-maker/composition-remotion/render';

import { PipelineStageError } from './pipeline-stage-error';
import { isRenderApiError } from './render-api-error';
import type { RenderApiError, RenderApiErrorCode, RenderPipelineStage } from './render-api-error';

const HANDLED_MEDIA_LOCAL_CODES = [
  'BINARY_NOT_FOUND',
  'COMMAND_FAILED',
  'UNPARSEABLE_OUTPUT',
  'UNRESOLVED_AUDIO_ASSET',
  'MISSING_MEDIA_STREAM',
] as const satisfies readonly MediaLocalErrorCode[];

const HANDLED_RENDER_CODES = [
  'INVALID_TIMELINE',
  'BUNDLE_FAILED',
  'COMPOSITION_NOT_FOUND',
  'RENDER_FAILED',
] as const satisfies readonly RenderTimelineErrorCode[];

type HandledMediaLocalCode = (typeof HANDLED_MEDIA_LOCAL_CODES)[number];
type HandledRenderCode = (typeof HANDLED_RENDER_CODES)[number];

interface EngineErrorShape {
  readonly code: string;
  readonly stream?: string;
}

function asEngineError(value: unknown): EngineErrorShape | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const candidate = value as { code?: unknown; stream?: unknown };
  if (typeof candidate.code !== 'string') {
    return null;
  }
  return typeof candidate.stream === 'string'
    ? { code: candidate.code, stream: candidate.stream }
    : { code: candidate.code };
}

function isHandledMediaLocalCode(code: string): code is HandledMediaLocalCode {
  return (HANDLED_MEDIA_LOCAL_CODES as readonly string[]).includes(code);
}

function isHandledRenderCode(code: string): code is HandledRenderCode {
  return (HANDLED_RENDER_CODES as readonly string[]).includes(code);
}

const RENDER_CODE_MAP: Readonly<Record<HandledRenderCode, RenderApiErrorCode>> = {
  INVALID_TIMELINE: 'INVALID_TIMELINE',
  BUNDLE_FAILED: 'RENDER_BUNDLE_FAILED',
  COMPOSITION_NOT_FOUND: 'COMPOSITION_NOT_FOUND',
  RENDER_FAILED: 'RENDER_FAILED',
};

const MEDIA_LOCAL_CODE_MAP: Readonly<
  Record<Exclude<HandledMediaLocalCode, 'MISSING_MEDIA_STREAM'>, RenderApiErrorCode>
> = {
  BINARY_NOT_FOUND: 'MEDIA_BINARY_NOT_FOUND',
  COMMAND_FAILED: 'MEDIA_COMMAND_FAILED',
  UNPARSEABLE_OUTPUT: 'MEDIA_OUTPUT_UNPARSEABLE',
  UNRESOLVED_AUDIO_ASSET: 'UNRESOLVED_AUDIO_ASSET',
};

export function translateEngineError(
  cause: unknown,
  stage: RenderPipelineStage | null,
  resource: string,
  fallbackCode: RenderApiErrorCode = 'INTERNAL_ERROR',
): RenderApiError {
  if (isRenderApiError(cause)) {
    return cause;
  }

  const engineError = asEngineError(cause);

  if (engineError !== null && isHandledRenderCode(engineError.code)) {
    return new PipelineStageError({
      code: RENDER_CODE_MAP[engineError.code],
      stage,
      resource,
      ...(engineError.code === 'INVALID_TIMELINE'
        ? { expected: 'a timeline accepted by validateTimeline' }
        : {}),
      cause,
    });
  }

  if (engineError !== null && isHandledMediaLocalCode(engineError.code)) {
    if (engineError.code === 'MISSING_MEDIA_STREAM') {
      return new PipelineStageError({
        code: engineError.stream === 'video' ? 'MISSING_VIDEO_STREAM' : 'MISSING_AUDIO_STREAM',
        stage,
        resource,
        expected:
          engineError.stream === 'video'
            ? 'a file carrying a video stream'
            : 'a voice asset carrying an audio stream',
        cause,
      });
    }

    return new PipelineStageError({
      code: MEDIA_LOCAL_CODE_MAP[engineError.code],
      stage,
      resource,
      ...(engineError.code === 'BINARY_NOT_FOUND'
        ? { hint: 'set FFMPEG_PATH and FFPROBE_PATH or install ffmpeg in PATH' }
        : {}),
      cause,
    });
  }

  return new PipelineStageError({ code: fallbackCode, stage, resource, cause });
}
