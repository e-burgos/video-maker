import { describe, expect, it } from 'vitest';

import { resolveMediaProject } from '@video-maker/auto-montage';
import { withVisualReview } from '@video-maker/timeline-core';
import type { ReviewReport } from '@video-maker/timeline-core';

import { createCallLog } from '../__fixtures__/call-log';
import { createFakeObjectStorage } from '../__fixtures__/fake-object-storage';
import { assertRenderReviewAllowsPublish, publishLanguageFromVoice } from './publish-preconditions';

describe('publishLanguageFromVoice', () => {
  it('takes the language prefix of the brand voice id', () => {
    expect(publishLanguageFromVoice('es_AR-daniela-high')).toBe('es');
    expect(publishLanguageFromVoice('en_US-amy-medium')).toBe('en');
  });

  it('falls back to es without a brand voice or with an unreadable id', () => {
    expect(publishLanguageFromVoice(null)).toBe('es');
    expect(publishLanguageFromVoice('')).toBe('es');
    expect(publishLanguageFromVoice('9999')).toBe('es');
  });
});

describe('assertRenderReviewAllowsPublish with the visual review (US-023-603)', () => {
  const project = resolveMediaProject('/media/demo');
  const report: ReviewReport = {
    version: 1,
    file: 'out/video.mp4',
    createdAt: '2026-10-12T10:00:00.000Z',
    status: 'fail',
    delivery: { kind: 'motion' },
    metrics: {},
    findings: [{ id: 'visual-not-reviewed-01', check: 'visual-not-reviewed', severity: 'critical', message: 'Nadie miró las escenas', proposedFix: 'Mirar' }],
    sceneFrames: [{ sceneId: 'hook', index: 1, startSec: 0, endSec: 4, atSec: 2, frame: 'out/video.review/scene-01.jpg' }],
  };

  function storageWith(stored: ReviewReport) {
    return createFakeObjectStorage(createCallLog(), {
      directories: ['/media/demo'],
      files: [{ path: '/media/demo/out/video.review.json', contents: JSON.stringify(stored) }],
    });
  }

  it('blocks publishing while nobody looked at the scenes, and lets ignoreReview through', async () => {
    const storage = storageWith(report);

    await expect(assertRenderReviewAllowsPublish(storage, project, 'out/video.mp4', false)).rejects.toMatchObject({
      code: 'RENDER_REVIEW_FAILED',
      hint: expect.stringContaining('Nadie miró las escenas') as string,
    });
    await expect(assertRenderReviewAllowsPublish(storage, project, 'out/video.mp4', true)).resolves.toBeUndefined();
  });

  it('blocks a fix scene and allows publishing once the visual review is clean', async () => {
    const draftScene = { sceneId: 'hook', shows: 'Título', matchesVoice: true, legible: true, couldBeOtherProduct: false };
    const flagged = withVisualReview(report, '2026-10-12T11:00:00.000Z', { scenes: [{ ...draftScene, verdict: 'fix', note: 'Cortar el título' }] });
    const clean = withVisualReview(report, '2026-10-12T11:00:00.000Z', { scenes: [{ ...draftScene, verdict: 'ok', note: '' }] });

    await expect(assertRenderReviewAllowsPublish(storageWith(flagged), project, 'out/video.mp4', false)).rejects.toMatchObject({ code: 'RENDER_REVIEW_FAILED' });
    await expect(assertRenderReviewAllowsPublish(storageWith(clean), project, 'out/video.mp4', false)).resolves.toBeUndefined();
  });
});
