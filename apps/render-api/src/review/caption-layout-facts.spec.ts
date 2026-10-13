import { describe, expect, it } from 'vitest';

import { footageTimeline } from '../__fixtures__/review-project-fixtures';
import { buildCaptionLayoutFacts } from './caption-layout-facts';

describe('buildCaptionLayoutFacts', () => {
  it('places the subtitle inside the frame and the logo in its corner', () => {
    const layout = buildCaptionLayoutFacts(footageTimeline);

    const caption = layout?.captions[0]?.rect;
    expect(caption?.y).toBeGreaterThan(900);
    expect(caption?.x).toBeGreaterThan(0);
    expect((caption?.x ?? 0) + (caption?.width ?? 0)).toBeLessThan(1920);
    expect(layout?.logo).toMatchObject({ x: 1920 - 58 - 384, width: 384 });
    expect(layout?.chatButton).toBeNull();
  });

  it('reserves the chat button zone only for tutorials', () => {
    const layout = buildCaptionLayoutFacts({ ...footageTimeline, delivery: { kind: 'tutorial' } });

    expect(layout?.chatButton).toEqual({ x: 1747, y: 929, width: 173, height: 151 });
  });

  it('turns picture-in-picture b-roll into overlay boxes', () => {
    const clip = { id: 'pip-1', assetId: 'raw/aroll.mp4', from: 30, durationFrames: 60, trimStartMs: 0, fit: 'pip' as const, transform: { scale: 1, translateX: 0, translateY: 0 } };
    const layout = buildCaptionLayoutFacts({ ...footageTimeline, tracks: { ...footageTimeline.tracks, broll: [clip] } });

    expect(layout?.overlays).toHaveLength(1);
    expect(layout?.overlays[0]?.rect.width).toBe(614);
    expect(layout?.overlays[0]?.startSec).toBeCloseTo(2 + 1, 5);
  });

  it('has nothing to compute without subtitles', () => {
    expect(buildCaptionLayoutFacts({ ...footageTimeline, captionStyle: 'off' })).toBeNull();
    expect(buildCaptionLayoutFacts({ ...footageTimeline, tracks: { ...footageTimeline.tracks, captions: [] } })).toBeNull();
  });
});
