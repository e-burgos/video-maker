import {
  CatalogUnreadableError,
  EditDecisionListInvalidError,
  MontageInputError,
  PathEscapesProjectError,
  ProjectLayoutError,
  ReadOnlyRawPathError,
  TimelineInvalidError,
} from '@video-maker/auto-montage';
import { describe, expect, it } from 'vitest';

import { httpStatusFor } from './http-status-for';
import type { RenderApiErrorCode } from './render-api-error';
import { translateAutoMontageError } from './translate-store-error';

const RESOURCE = 'work/catalog.json';

interface TranslationCase {
  readonly name: string;
  readonly cause: unknown;
  readonly ownCode: RenderApiErrorCode;
}

const TRANSLATION_CASES: readonly TranslationCase[] = [
  {
    name: 'CatalogUnreadableError',
    cause: new CatalogUnreadableError({ catalogPath: RESOURCE, issues: ['broken'] }),
    ownCode: 'CATALOG_UNREADABLE',
  },
  {
    name: 'ProjectLayoutError',
    cause: new ProjectLayoutError({ projectRoot: '/media/smoke-ingest', missingPath: 'raw' }),
    ownCode: 'PROJECT_LAYOUT_INVALID',
  },
  {
    name: 'PathEscapesProjectError',
    cause: new PathEscapesProjectError({
      projectRoot: '/media/smoke-ingest',
      attemptedPath: '/etc/passwd',
    }),
    ownCode: 'ASSET_PATH_INVALID',
  },
  {
    name: 'ReadOnlyRawPathError',
    cause: new ReadOnlyRawPathError({
      projectRoot: '/media/smoke-ingest',
      attemptedPath: 'raw/aroll/clip01.mp4',
    }),
    ownCode: 'ASSET_PATH_INVALID',
  },
  {
    name: 'TimelineInvalidError',
    cause: new TimelineInvalidError({ timelineId: 'work/timeline.json', issues: [] }),
    ownCode: 'TIMELINE_INVALID',
  },
  {
    name: 'EditDecisionListInvalidError',
    cause: new EditDecisionListInvalidError({ sourceAssetId: 'work/edl.json', issues: [] }),
    ownCode: 'EDL_INVALID',
  },
  {
    name: 'MontageInputError (an AutoMontageError outside the handled list)',
    cause: new MontageInputError({ projectRoot: '/media/smoke-ingest', reason: 'catalog-missing' }),
    ownCode: 'INTERNAL_ERROR',
  },
];

describe('translateAutoMontageError', () => {
  it.each(TRANSLATION_CASES)('translates $name to $ownCode', ({ cause, ownCode }) => {
    const result = translateAutoMontageError(cause, RESOURCE);

    expect(result.code).toBe(ownCode);
    expect(result.stage).toBeNull();
    expect(result.resource).toBe(RESOURCE);
    expect(result.cause).toBe(cause);
    expect(httpStatusFor(result.code)).toBeGreaterThanOrEqual(400);
  });

  it('falls back to INTERNAL_ERROR for a value outside the AutoMontageError hierarchy', () => {
    const unrecognisedValues: readonly unknown[] = [new Error('boom'), null, 'plain string', 42];

    for (const value of unrecognisedValues) {
      const result = translateAutoMontageError(value, RESOURCE);

      expect(result.code).toBe('INTERNAL_ERROR');
      expect(result.stage).toBeNull();
      expect(result.cause).toBe(value);
    }
  });
});
