import { describe, expect, it } from 'vitest';

import { RAW_STORYBOARD, storyboardFixture } from './__fixtures__/storyboard';
import { parseStoryboardDocument } from './parse-storyboard';
import { RenderApiError } from './render-api-error';

describe('parseStoryboardDocument', () => {
  it('accepts the document the service publishes and keeps every scene', () => {
    const document = parseStoryboardDocument(RAW_STORYBOARD);

    expect(document.scenes.map((scene) => scene.id)).toEqual(['scene-01', 'scene-02', 'scene-03']);
    expect(document.characters[0]?.name).toBe('Nina');
  });

  it('rejects a document whose scene index does not match its position', () => {
    const broken = storyboardFixture();
    const scenes = broken.scenes.map((scene, position) =>
      position === 1 ? { ...scene, index: 7 } : scene,
    );

    expect(() => parseStoryboardDocument({ ...broken, scenes })).toThrowError(RenderApiError);
  });

  it('reports the transport code when the body is not a storyboard at all', () => {
    try {
      parseStoryboardDocument({ schemaVersion: 1 });
      expect.unreachable('a partial document must not parse');
    } catch (error) {
      expect((error as RenderApiError).code).toBe('RESPONSE_SHAPE_UNEXPECTED');
    }
  });
});
