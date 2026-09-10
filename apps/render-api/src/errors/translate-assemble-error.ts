import type { AutoMontageErrorCode } from '@video-maker/auto-montage';
import type { StoryboardTimelineErrorCode } from '@video-maker/timeline-core';

import type { AssembleStage } from '../jobs/render-job';
import { PipelineStageError } from './pipeline-stage-error';
import { isRenderApiError } from './render-api-error';
import type { RenderApiError, RenderApiErrorCode } from './render-api-error';

const HANDLED_AUTO_MONTAGE_CODES = [
  'CATALOG_UNREADABLE',
  'TIMELINE_INVALID',
  'ASSEMBLE_INPUT_INVALID',
] as const satisfies readonly AutoMontageErrorCode[];

type HandledAutoMontageCode = (typeof HANDLED_AUTO_MONTAGE_CODES)[number];

const AUTO_MONTAGE_CODE_MAP: Readonly<Record<HandledAutoMontageCode, RenderApiErrorCode>> = {
  CATALOG_UNREADABLE: 'CATALOG_UNREADABLE',
  TIMELINE_INVALID: 'TIMELINE_INVALID',
  ASSEMBLE_INPUT_INVALID: 'ASSEMBLE_INPUT_INVALID',
};

const ASSEMBLE_REASON_CODE_MAP: Readonly<Record<string, RenderApiErrorCode>> = {
  'storyboard-missing': 'STORYBOARD_NOT_FOUND',
  'storyboard-invalid': 'STORYBOARD_INVALID',
  'catalog-missing': 'MONTAGE_RAW_MISSING',
  'voice-invalid': 'VOICE_INVALID',
  'assignment-invalid': 'SCENES_INVALID',
  'words-invalid': 'VOICE_INVALID',
};

const STORYBOARD_TIMELINE_CODES = [
  'EMPTY_STORYBOARD',
  'SCENE_WITHOUT_DURATION',
  'ASSET_NOT_IN_CATALOG',
] as const satisfies readonly StoryboardTimelineErrorCode[];

interface EngineErrorShape {
  readonly code: string;
  readonly reason: string | null;
  readonly resource: string | null;
}

function asEngineError(value: unknown): EngineErrorShape | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const candidate = value as { code?: unknown; reason?: unknown; resource?: unknown };
  if (typeof candidate.code !== 'string') {
    return null;
  }
  return {
    code: candidate.code,
    reason: typeof candidate.reason === 'string' ? candidate.reason : null,
    resource: typeof candidate.resource === 'string' ? candidate.resource : null,
  };
}

function isHandledAutoMontageCode(code: string): code is HandledAutoMontageCode {
  return (HANDLED_AUTO_MONTAGE_CODES as readonly string[]).includes(code);
}

function isStoryboardTimelineCode(code: string): boolean {
  return (STORYBOARD_TIMELINE_CODES as readonly string[]).includes(code);
}

export function translateAssembleError(
  cause: unknown,
  stage: AssembleStage,
  resource: string | null,
): RenderApiError {
  if (isRenderApiError(cause)) {
    return cause;
  }

  const engineError = asEngineError(cause);

  if (engineError !== null && isStoryboardTimelineCode(engineError.code)) {
    return new PipelineStageError({
      code: 'ASSEMBLE_INPUT_INVALID',
      stage,
      resource: engineError.resource ?? resource,
      expected: 'a storyboard whose scenes all resolve to a duration and to catalog assets',
      cause,
    });
  }

  if (engineError !== null && isHandledAutoMontageCode(engineError.code)) {
    const reasonCode = engineError.reason === null ? undefined : ASSEMBLE_REASON_CODE_MAP[engineError.reason];
    return new PipelineStageError({
      code: reasonCode ?? AUTO_MONTAGE_CODE_MAP[engineError.code],
      stage,
      resource: engineError.resource ?? resource,
      cause,
    });
  }

  return new PipelineStageError({ code: 'ASSEMBLE_FAILED', stage, resource, cause });
}
