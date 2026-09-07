import { describe, expect, it } from 'vitest';
import { computeTimelineMetadata } from './timeline-metadata';
import { buildExampleTimeline } from '../__fixtures__/example-timeline';

describe('computeTimelineMetadata', () => {
  it('deriva duración y formato 9:16 desde la Timeline de ejemplo', () => {
    const timeline = buildExampleTimeline('reels-9x16');

    expect(computeTimelineMetadata(timeline)).toEqual({
      timeline,
      durationInFrames: 265,
      fps: 30,
      width: 1080,
      height: 1920,
    });
  });

  it('deriva duración y formato 16:9 desde la Timeline de ejemplo', () => {
    const timeline = buildExampleTimeline('youtube-16x9');

    expect(computeTimelineMetadata(timeline)).toEqual({
      timeline,
      durationInFrames: 265,
      fps: 30,
      width: 1920,
      height: 1080,
    });
  });

  it('rechaza una Timeline que no cumple el schema', () => {
    const timeline = buildExampleTimeline('reels-9x16');
    const invalid: Record<string, unknown> = { ...timeline };
    delete invalid.format;

    expect(() => computeTimelineMetadata(invalid as never)).toThrow();
  });
});
