import { describe, expect, it } from 'vitest';

import { RAW_PREVIEW_TIMELINE, previewTimelineFixture } from './__fixtures__/timeline';
import { parseTimelineDocument } from './parse-timeline';

describe('parseTimelineDocument', () => {
  it('valida el documento de EP-007 contra TimelineSchema', () => {
    expect(parseTimelineDocument(RAW_PREVIEW_TIMELINE)).toEqual(previewTimelineFixture());
  });

  it('convierte un documento que no valida en RESPONSE_SHAPE_UNEXPECTED, no en un error de zod', () => {
    expect(() => parseTimelineDocument({ schemaVersion: 1, id: 'broken', tracks: {} })).toThrow(
      /not a timeline document that validates/,
    );

    try {
      parseTimelineDocument({ schemaVersion: 1, tracks: {} });
    } catch (error) {
      expect(error).toMatchObject({ code: 'RESPONSE_SHAPE_UNEXPECTED', status: 200 });
    }
  });
});
