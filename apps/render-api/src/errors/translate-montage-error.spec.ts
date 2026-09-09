import { CatalogUnreadableError } from '@video-maker/auto-montage';
import { describe, expect, it } from 'vitest';

import type { MontageStage } from '../jobs/render-job';
import { httpStatusFor } from './http-status-for';
import { PipelineStageError } from './pipeline-stage-error';
import type { RenderApiErrorCode } from './render-api-error';
import { toErrorPayload } from './to-error-payload';
import { translateMontageError } from './translate-montage-error';

interface TranslationCase {
  readonly engineError: string;
  readonly ownCode: RenderApiErrorCode;
  readonly status: number;
  readonly input: unknown;
}

const TRANSLATION_CASES: readonly TranslationCase[] = [
  { engineError: 'BinaryNotFoundError (BINARY_NOT_FOUND)', ownCode: 'MEDIA_BINARY_NOT_FOUND', status: 503, input: { code: 'BINARY_NOT_FOUND' } },
  { engineError: 'CatalogUnreadableError (CATALOG_UNREADABLE)', ownCode: 'CATALOG_UNREADABLE', status: 500, input: { code: 'CATALOG_UNREADABLE' } },
  { engineError: 'TimelineInvalidError (TIMELINE_INVALID)', ownCode: 'TIMELINE_INVALID', status: 422, input: { code: 'TIMELINE_INVALID' } },
  { engineError: 'EditDecisionListInvalidError (EDL_INVALID)', ownCode: 'EDL_INVALID', status: 422, input: { code: 'EDL_INVALID' } },
  { engineError: 'MontageInputError (MONTAGE_INPUT_INVALID)', ownCode: 'MONTAGE_INPUT_INVALID', status: 422, input: { code: 'MONTAGE_INPUT_INVALID' } },
  { engineError: 'ProjectLayoutError (PROJECT_LAYOUT_INVALID)', ownCode: 'MONTAGE_FAILED', status: 500, input: { code: 'PROJECT_LAYOUT_INVALID' } },
  { engineError: 'PathEscapesProjectError (PATH_ESCAPES_PROJECT)', ownCode: 'MONTAGE_FAILED', status: 500, input: { code: 'PATH_ESCAPES_PROJECT' } },
  { engineError: 'ReadOnlyRawPathError (READ_ONLY_RAW_PATH)', ownCode: 'MONTAGE_FAILED', status: 500, input: { code: 'READ_ONLY_RAW_PATH' } },
  { engineError: 'TranscriptionFailedError (TRANSCRIPTION_FAILED)', ownCode: 'MONTAGE_FAILED', status: 500, input: { code: 'TRANSCRIPTION_FAILED' } },
  { engineError: 'AssetProbeFailedError (ASSET_PROBE_FAILED)', ownCode: 'MONTAGE_FAILED', status: 500, input: { code: 'ASSET_PROBE_FAILED' } },
  { engineError: 'CommandFailedError (COMMAND_FAILED)', ownCode: 'MONTAGE_FAILED', status: 500, input: { code: 'COMMAND_FAILED' } },
  { engineError: 'UnparseableOutputError (UNPARSEABLE_OUTPUT)', ownCode: 'MONTAGE_FAILED', status: 500, input: { code: 'UNPARSEABLE_OUTPUT' } },
  { engineError: 'UnresolvedAudioAssetError (UNRESOLVED_AUDIO_ASSET)', ownCode: 'MONTAGE_FAILED', status: 500, input: { code: 'UNRESOLVED_AUDIO_ASSET' } },
  { engineError: 'MissingMediaStreamError (MISSING_MEDIA_STREAM)', ownCode: 'MONTAGE_FAILED', status: 500, input: { code: 'MISSING_MEDIA_STREAM' } },
];

describe('translateMontageError', () => {
  it.each(TRANSLATION_CASES)('maps $engineError to $ownCode ($status)', ({ ownCode, status, input }) => {
    const translated = translateMontageError(input, 'plan', 'work/catalog.json');

    expect(translated.code).toBe(ownCode);
    expect(httpStatusFor(translated.code)).toBe(status);
  });

  it('returns an already-translated RenderApiError unchanged', () => {
    const already = new PipelineStageError({ code: 'MONTAGE_INPUT_INVALID', stage: 'plan' });

    expect(translateMontageError(already, 'plan', 'work/catalog.json')).toBe(already);
  });

  it.each([
    { title: 'a plain Error', cause: new Error('boom') },
    { title: 'a string', cause: 'boom' },
    { title: 'null', cause: null },
    { title: 'undefined', cause: undefined },
    { title: 'an object without a code', cause: { message: 'boom' } },
  ])('translates $title to the MONTAGE_FAILED catch-all without throwing', ({ cause }) => {
    const translated = translateMontageError(cause, 'discover', null);

    expect(translated.code).toBe('MONTAGE_FAILED');
    expect(httpStatusFor(translated.code)).toBe(500);
  });

  it('never leaks a searched binary path carried by a BinaryNotFoundError-shaped cause', () => {
    // shaped like media-local's BinaryNotFoundError; that lib's values may only be imported in node-render-api-dependencies.ts
    const cause = {
      code: 'BINARY_NOT_FOUND',
      message: 'No se encontró el binario "whisper-cli".',
      searchedPaths: ['/opt/homebrew/bin/whisper-cli', '/usr/local/bin/whisper-cli'],
    };

    const translated = translateMontageError(cause, 'transcribe', 'raw/aroll/clip01.mp4');
    const payload = toErrorPayload(translated);
    const serialized = JSON.stringify(payload);

    expect(translated.code).toBe('MEDIA_BINARY_NOT_FOUND');
    expect(serialized).not.toContain('/opt/homebrew');
    expect(serialized).not.toContain('/usr/local');
    expect(serialized).not.toContain(cause.message);
  });

  it('never leaks the Spanish message or the absolute catalog path from a real CatalogUnreadableError', () => {
    const cause = new CatalogUnreadableError({
      catalogPath: '/var/data/media/acme-launch/work/catalog.json',
      issues: ['invalid JSON'],
    });

    const translated = translateMontageError(cause, 'plan', 'work/catalog.json');
    const payload = toErrorPayload(translated);
    const serialized = JSON.stringify(payload);

    expect(translated.code).toBe('CATALOG_UNREADABLE');
    expect(serialized).not.toContain('/var/data/media');
    expect(serialized).not.toContain(cause.message);
  });

  it('carries the stage and resource it was given through to the translated error', () => {
    const translated = translateMontageError({ code: 'MONTAGE_INPUT_INVALID' }, 'plan' satisfies MontageStage, 'work/catalog.json');

    expect(translated.stage).toBe('plan');
    expect(translated.resource).toBe('work/catalog.json');
  });
});
