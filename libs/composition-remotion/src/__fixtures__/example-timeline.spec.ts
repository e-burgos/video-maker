import { validateTimeline } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';
import { buildExampleTimeline } from './example-timeline';

describe('buildExampleTimeline', () => {
  it('produce una Timeline 9:16 válida de 265 frames', () => {
    const timeline = buildExampleTimeline('reels-9x16');

    expect(validateTimeline(timeline)).toEqual({ ok: true });
    expect(timeline.durationFrames).toBe(265);
    expect(timeline.format).toMatchObject({ width: 1080, height: 1920, fps: 30 });
  });

  it('produce una Timeline 16:9 válida de 265 frames', () => {
    const timeline = buildExampleTimeline('youtube-16x9');

    expect(validateTimeline(timeline)).toEqual({ ok: true });
    expect(timeline.durationFrames).toBe(265);
    expect(timeline.format).toMatchObject({ width: 1920, height: 1080, fps: 30 });
  });
});
