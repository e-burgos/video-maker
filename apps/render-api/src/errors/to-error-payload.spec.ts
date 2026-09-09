import { describe, expect, it, vi } from 'vitest';

import { PipelineStageError } from './pipeline-stage-error';
import { RENDER_API_ERROR_CODES } from './render-api-error';
import type { RenderApiErrorCode } from './render-api-error';
import { toErrorPayload } from './to-error-payload';

const FORBIDDEN_SPANISH_TOKENS = ['No se', 'El comando', 'La Timeline'];

function isAsciiOnly(text: string): boolean {
  return Array.from(text).every((character) => character.charCodeAt(0) < 128);
}

const ENGINE_DERIVED_RESOURCES = [
  { code: 'INVALID_TIMELINE', resource: 'work/renders/r1/timeline.json' },
  { code: 'RENDER_BUNDLE_FAILED', resource: 'work/renders/r1/muted.mp4' },
  { code: 'COMPOSITION_NOT_FOUND', resource: 'timeline-composition' },
  { code: 'RENDER_FAILED', resource: 'work/renders/r1/muted.mp4' },
  { code: 'UNRESOLVED_AUDIO_ASSET', resource: 'work/renders/r1/mix/master.wav' },
  { code: 'MISSING_AUDIO_STREAM', resource: 'work/renders/r1/voice.wav' },
  { code: 'MISSING_VIDEO_STREAM', resource: 'work/renders/r1/muted.mp4' },
  { code: 'MEDIA_COMMAND_FAILED', resource: 'ffmpeg' },
  { code: 'MEDIA_OUTPUT_UNPARSEABLE', resource: 'ffprobe' },
  { code: 'MEDIA_BINARY_NOT_FOUND', resource: 'ffmpeg' },
  { code: 'PROJECT_NOT_FOUND', resource: 'smoke-ingest' },
  { code: 'PROJECT_SLUG_INVALID', resource: 'Not_A_Slug' },
  { code: 'PROJECT_ALREADY_EXISTS', resource: 'smoke-ingest' },
  { code: 'PROJECT_LAYOUT_INVALID', resource: 'raw' },
  { code: 'ASSET_ROLE_INVALID', resource: 'video' },
  { code: 'ASSET_PATH_INVALID', resource: '../escape.mp4' },
  { code: 'ASSET_ALREADY_EXISTS', resource: 'raw/aroll/clip01.mp4' },
  { code: 'ASSET_CONTENT_LENGTH_REQUIRED', resource: 'content-length' },
  { code: 'ASSET_CONTENT_TYPE_REQUIRED', resource: 'content-type' },
  { code: 'ASSET_TOO_LARGE', resource: 'raw/aroll/clip01.mp4' },
  { code: 'ASSET_UPLOAD_ABORTED', resource: 'raw/aroll/clip01.mp4' },
  { code: 'TIMELINE_NOT_FOUND', resource: 'work/timeline.json' },
  { code: 'TIMELINE_INVALID', resource: 'work/timeline.json' },
  { code: 'EDL_NOT_FOUND', resource: 'work/edl.json' },
  { code: 'EDL_INVALID', resource: 'work/edl.json' },
  { code: 'ARTIFACT_NOT_FOUND', resource: 'raw/aroll/clip01.mp4' },
  { code: 'RANGE_NOT_SATISFIABLE', resource: 'out/render-1.mp4' },
  { code: 'CATALOG_UNREADABLE', resource: 'work/catalog.json' },
] as const satisfies readonly { code: RenderApiErrorCode; resource: string }[];

describe('toErrorPayload', () => {
  it('never reads .stack', () => {
    const error = new PipelineStageError({ code: 'INTERNAL_ERROR', stage: null });
    const stackSpy = vi.spyOn(error, 'stack', 'get');

    toErrorPayload(error);

    expect(stackSpy).not.toHaveBeenCalled();
  });

  it('emits an ASCII English message for every code in RENDER_API_ERROR_CODES', () => {
    for (const code of RENDER_API_ERROR_CODES) {
      const error = new PipelineStageError({ code, stage: null });
      const payload = toErrorPayload(error);

      expect(isAsciiOnly(payload.message)).toBe(true);
      for (const token of FORBIDDEN_SPANISH_TOKENS) {
        expect(payload.message).not.toContain(token);
      }
    }
  });

  it('never emits an absolute host path in resource', () => {
    for (const { code, resource } of ENGINE_DERIVED_RESOURCES) {
      const error = new PipelineStageError({ code, stage: null, resource });
      const payload = toErrorPayload(error);

      if (payload.resource === undefined) {
        throw new Error(`expected a resource in the payload for ${code}`);
      }

      expect(payload.resource.startsWith('/')).toBe(false);
      expect(payload.resource).not.toContain(':\\');
    }
  });

  it('omits resource, expected and hint instead of emitting null', () => {
    const error = new PipelineStageError({ code: 'INTERNAL_ERROR', stage: null });
    const payload = toErrorPayload(error);

    expect('resource' in payload).toBe(false);
    expect('expected' in payload).toBe(false);
    expect('hint' in payload).toBe(false);
  });

  it('includes expected and hint verbatim when the error carries them', () => {
    const error = new PipelineStageError({
      code: 'INVALID_TIMELINE',
      stage: 'render',
      expected: 'a timeline accepted by validateTimeline',
      hint: 'set FFMPEG_PATH and FFPROBE_PATH or install ffmpeg in PATH',
    });

    const payload = toErrorPayload(error);

    expect(payload.expected).toBe('a timeline accepted by validateTimeline');
    expect(payload.hint).toBe('set FFMPEG_PATH and FFPROBE_PATH or install ffmpeg in PATH');
  });

  it('spreads assetPersisted and catalogUpdated at the top level and omits details when null', () => {
    const withDetails = new PipelineStageError({
      code: 'MEDIA_BINARY_NOT_FOUND',
      stage: null,
      details: { assetPersisted: true, catalogUpdated: true },
    });

    const payloadWithDetails = toErrorPayload(withDetails);
    expect(payloadWithDetails.assetPersisted).toBe(true);
    expect(payloadWithDetails.catalogUpdated).toBe(true);

    const withoutDetails = new PipelineStageError({ code: 'MEDIA_BINARY_NOT_FOUND', stage: null });
    const payloadWithoutDetails = toErrorPayload(withoutDetails);

    expect('assetPersisted' in payloadWithoutDetails).toBe(false);
    expect('catalogUpdated' in payloadWithoutDetails).toBe(false);
  });

  it('falls back to the INTERNAL_ERROR payload without reading .stack or exposing a resource for a value outside its own hierarchy', () => {
    const referenceMessage = toErrorPayload(
      new PipelineStageError({ code: 'INTERNAL_ERROR', stage: null }),
    ).message;

    const plainError = new Error('unexpected crash');
    const stackSpy = vi.spyOn(plainError, 'stack', 'get');
    const payloadFromError = toErrorPayload(plainError);

    expect(stackSpy).not.toHaveBeenCalled();
    expect(payloadFromError).toEqual({ code: 'INTERNAL_ERROR', stage: null, message: referenceMessage });
    expect('resource' in payloadFromError).toBe(false);

    const payloadFromNonError = toErrorPayload('not-an-error-value');
    expect(payloadFromNonError).toEqual({ code: 'INTERNAL_ERROR', stage: null, message: referenceMessage });
    expect('resource' in payloadFromNonError).toBe(false);
  });
});
