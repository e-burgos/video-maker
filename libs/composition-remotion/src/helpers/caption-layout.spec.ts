import { describe, expect, it } from 'vitest';
import { defaultFormat, safeZoneFor } from '@video-maker/timeline-core';
import { captionLayout } from './caption-layout';
import { buildExampleTimeline } from '../__fixtures__/example-timeline';

describe('captionLayout', () => {
  it('calcula la caja dentro del safe zone para 9:16', () => {
    const format = defaultFormat('reels-9x16');
    const safeZone = safeZoneFor(format);

    const box = captionLayout(safeZone, format);

    expect(box).toEqual({ x: 60, y: 220, width: 880, height: 1300 });
    expect(box.x).toBeGreaterThanOrEqual(safeZone.left);
    expect(box.y).toBeGreaterThanOrEqual(safeZone.top);
    expect(box.x + box.width).toBeLessThanOrEqual(format.width - safeZone.right);
    expect(box.y + box.height).toBeLessThanOrEqual(format.height - safeZone.bottom);
  });

  it('calcula la caja dentro del safe zone para 16:9', () => {
    const format = defaultFormat('youtube-16x9');
    const safeZone = safeZoneFor(format);

    const box = captionLayout(safeZone, format);

    expect(box).toEqual({ x: 60, y: 60, width: 1800, height: 960 });
    expect(box.x).toBeGreaterThanOrEqual(safeZone.left);
    expect(box.y).toBeGreaterThanOrEqual(safeZone.top);
    expect(box.x + box.width).toBeLessThanOrEqual(format.width - safeZone.right);
    expect(box.y + box.height).toBeLessThanOrEqual(format.height - safeZone.bottom);
  });

  it('da el mismo resultado que el box de la Timeline de ejemplo', () => {
    const timeline = buildExampleTimeline('reels-9x16');
    const safeZone = timeline.safeZone ?? safeZoneFor(timeline.format);

    expect(captionLayout(safeZone, timeline.format)).toEqual(timeline.tracks.captions[0].box);
  });
});
