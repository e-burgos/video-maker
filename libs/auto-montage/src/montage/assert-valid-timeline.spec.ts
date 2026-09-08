import { buildTimeline, defaultFormat } from '@video-maker/timeline-core';
import type { EditDecisionList, MediaAsset } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { TimelineInvalidError } from '../errors/timeline-invalid-error';
import { assertValidTimeline } from './assert-valid-timeline';

function buildFixtureTimeline() {
  const edl: EditDecisionList = {
    schemaVersion: 1,
    sourceAssetId: 'raw/aroll/camara.mp4',
    format: defaultFormat('reels-9x16'),
    generatedBy: { tool: 'auto-montage', params: { preset: 'software-demo', seed: 1 } },
    decisions: [{ id: 'keep-0001', type: 'keep', startMs: 0, endMs: 2000 }],
  };
  const assets: MediaAsset[] = [
    {
      id: 'raw/aroll/camara.mp4',
      kind: 'video',
      path: 'raw/aroll/camara.mp4',
      durationMs: 5000,
      fps: 30,
      width: 1920,
      height: 1080,
      hasAudio: true,
      probedAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  return buildTimeline(edl, assets);
}

describe('assertValidTimeline (D-20)', () => {
  it('devuelve la Timeline sin cambios cuando validateTimeline no reporta issues', () => {
    const timeline = buildFixtureTimeline();

    expect(assertValidTimeline(timeline)).toBe(timeline);
  });

  it('lanza TimelineInvalidError con el timelineId y los issues cuando validateTimeline falla', () => {
    const timeline = { ...buildFixtureTimeline(), assets: [] };

    expect(() => assertValidTimeline(timeline)).toThrow(TimelineInvalidError);

    try {
      assertValidTimeline(timeline);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(TimelineInvalidError);
      expect((error as TimelineInvalidError).timelineId).toBe(timeline.id);
      expect((error as TimelineInvalidError).issues.length).toBeGreaterThan(0);
    }
  });
});
