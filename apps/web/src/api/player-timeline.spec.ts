import { describe, expect, it } from 'vitest';

import { previewTimelineFixture } from './__fixtures__/timeline';
import { playerTimeline } from './player-timeline';

const ORIGIN = 'http://localhost:4207';

describe('playerTimeline', () => {
  it('reescribe cada asset a la URL absoluta same-origin de EP-011', () => {
    const result = playerTimeline(previewTimelineFixture(), 'smoke-ingest', ORIGIN);

    expect(result.assets.map((asset) => asset.path)).toEqual([
      'http://localhost:4207/api/projects/smoke-ingest/files/raw/aroll/clip%2001.mp4',
      'http://localhost:4207/api/projects/smoke-ingest/files/raw/audio/music01.mp3',
    ]);
  });

  it('deja el resto del documento intacto: ids, pistas, formato y audioMix', () => {
    const timeline = previewTimelineFixture();
    const result = playerTimeline(timeline, 'smoke-ingest', ORIGIN);

    expect(result.tracks).toEqual(timeline.tracks);
    expect(result.format).toEqual(timeline.format);
    expect(result.audioMix).toEqual(timeline.audioMix);
    expect(result.assets.map((asset) => asset.id)).toEqual(timeline.assets.map((asset) => asset.id));
  });

  it('no muta la timeline recibida', () => {
    const timeline = previewTimelineFixture();

    playerTimeline(timeline, 'smoke-ingest', ORIGIN);

    expect(timeline.assets[0]?.path).toBe('raw/aroll/clip 01.mp4');
  });

  it('produce una URL que assetSrc devuelve tal cual, sin staticFile ni file://', () => {
    const [asset] = playerTimeline(previewTimelineFixture(), 'smoke-ingest', ORIGIN).assets;

    expect(asset?.path.startsWith('http://')).toBe(true);
    expect(asset?.path.startsWith('file://')).toBe(false);
  });
});
