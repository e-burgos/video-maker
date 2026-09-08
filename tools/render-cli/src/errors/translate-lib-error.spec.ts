import {
  AssetProbeFailedError,
  CatalogUnreadableError,
  EditDecisionListInvalidError,
  MontageInputError,
  PathEscapesProjectError,
  ProjectLayoutError,
  ReadOnlyRawPathError,
  TimelineInvalidError,
  TranscriptionFailedError,
} from '@video-maker/auto-montage';
import { BinaryNotFoundError, CommandFailedError, UnparseableOutputError } from '@video-maker/media-local';
import { describe, expect, it } from 'vitest';

import { StageFailedError } from './stage-failed-error';
import { translateLibError } from './translate-lib-error';

describe('translateLibError', () => {
  it.each([
    ['PROJECT_LAYOUT_INVALID', new ProjectLayoutError({ projectRoot: '/media/p', missingPath: 'raw' })],
    [
      'PATH_ESCAPES_PROJECT',
      new PathEscapesProjectError({ projectRoot: '/media/p', attemptedPath: '/etc/passwd' }),
    ],
    [
      'READ_ONLY_RAW_PATH',
      new ReadOnlyRawPathError({ projectRoot: '/media/p', attemptedPath: 'raw/aroll/clip01.mp4' }),
    ],
    [
      'CATALOG_UNREADABLE',
      new CatalogUnreadableError({ catalogPath: 'work/catalog.json', issues: ['schema-invalid'] }),
    ],
    [
      'TRANSCRIPTION_FAILED',
      new TranscriptionFailedError({ assetId: 'aroll-1', stage: 'transcribe' }),
    ],
    ['ASSET_PROBE_FAILED', new AssetProbeFailedError({ path: 'raw/broll/clip09.mp4' })],
    [
      'MONTAGE_INPUT_INVALID',
      new MontageInputError({ projectRoot: '/media/p', reason: 'no-aroll-asset' }),
    ],
    [
      'EDL_INVALID',
      new EditDecisionListInvalidError({ sourceAssetId: 'aroll-1', issues: ['negative-duration'] }),
    ],
    [
      'TIMELINE_INVALID',
      new TimelineInvalidError({
        timelineId: 'timeline-1',
        issues: [{ code: 'EMPTY_AROLL', path: 'scenes', message: 'sin escenas' }],
      }),
    ],
    ['BINARY_NOT_FOUND', new BinaryNotFoundError({ binary: 'whisper-cli' })],
    [
      'COMMAND_FAILED',
      new CommandFailedError({ command: 'ffmpeg', args: ['-i', 'in.mp4'], exitCode: 1, stderr: 'boom' }),
    ],
    [
      'UNPARSEABLE_OUTPUT',
      new UnparseableOutputError({ command: 'ffprobe', reason: 'invalid-json', sample: '{' }),
    ],
  ] as const)('translates %s to a StageFailedError carrying the lib cause', (code, cause) => {
    const translated = translateLibError(cause, 'ingest', 'raw');

    expect(translated).toBeInstanceOf(StageFailedError);
    expect(translated.code).toBe('STAGE_FAILED');
    expect(translated.stage).toBe('ingest');
    expect(translated.resource).toBe('raw');
    expect(translated.reason).toBe(code);
    expect(translated.cause).toBe(cause);
  });

  it('rethrows a value that is neither an AutoMontageError nor a MediaLocalError', () => {
    const untyped = new TypeError('boom');

    expect(() => translateLibError(untyped, 'plan', null)).toThrow(untyped);
  });
});
