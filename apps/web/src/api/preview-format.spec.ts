import { describe, expect, it } from 'vitest';

import { previewTimelineFixture } from './__fixtures__/timeline';
import { PREVIEW_PRESETS, previewFormat, previewPresetFor } from './preview-format';

describe('previewFormat', () => {
  it('ofrece exactamente los dos formatos de la spec', () => {
    expect(PREVIEW_PRESETS).toEqual(['reels-9x16', 'youtube-16x9']);
  });

  it('devuelve la misma referencia cuando el preset pedido ya es el de la timeline', () => {
    const timeline = previewTimelineFixture();

    expect(previewFormat(timeline, 'reels-9x16')).toBe(timeline);
  });

  it('cambia formato y safeZone juntos: el safeZone 9:16 dejaria los captions fuera de un 16:9', () => {
    const timeline = previewTimelineFixture();
    const landscape = previewFormat(timeline, 'youtube-16x9');

    expect(landscape.format).toEqual({ preset: 'youtube-16x9', width: 1920, height: 1080, fps: 30 });
    expect(landscape.safeZone).toEqual({ top: 60, bottom: 60, left: 60, right: 60 });
    expect(timeline.safeZone).toEqual({ top: 220, bottom: 400, left: 60, right: 140 });
  });

  it('no toca pistas ni assets: es un override de preview, nunca una escritura', () => {
    const timeline = previewTimelineFixture();
    const landscape = previewFormat(timeline, 'youtube-16x9');

    expect(landscape.tracks).toEqual(timeline.tracks);
    expect(landscape.assets).toEqual(timeline.assets);
    expect(landscape.durationFrames).toBe(timeline.durationFrames);
  });

  it('deriva el preset inicial del documento persistido', () => {
    const timeline = previewTimelineFixture();

    expect(previewPresetFor(timeline)).toBe('reels-9x16');
    expect(previewPresetFor(previewFormat(timeline, 'youtube-16x9'))).toBe('youtube-16x9');
  });
});
