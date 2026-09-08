import { describe, expect, it } from 'vitest';
import { buildExampleTimeline } from '../__fixtures__/example-timeline';
import {
  TIMELINE_COMPOSITION_ID,
  calculateTimelineMetadata,
} from './timeline-composition';
import type { TimelineCompositionProps } from './timeline-composition';

const TIMELINE = buildExampleTimeline('reels-9x16');

function metadataOptionsFor(props: TimelineCompositionProps) {
  return {
    props,
    defaultProps: props,
    abortSignal: new AbortController().signal,
    compositionId: TIMELINE_COMPOSITION_ID,
    isRendering: false,
  };
}

describe('calculateTimelineMetadata', () => {
  it('preserva las props de caption al reemplazar timeline en el resultado (D-23, R-13)', async () => {
    const props: TimelineCompositionProps = {
      timeline: TIMELINE,
      captionPreset: 'clean-sans',
      captionPlatform: 'tiktok',
      captionAnchor: 'top',
    };

    const result = await calculateTimelineMetadata(metadataOptionsFor(props));

    expect(result.props).toBeDefined();
    expect(result.props?.captionPreset).toBe('clean-sans');
    expect(result.props?.captionPlatform).toBe('tiktok');
    expect(result.props?.captionAnchor).toBe('top');
  });

  it('reemplaza timeline por la versión parseada, no por la instancia original', async () => {
    const props: TimelineCompositionProps = { timeline: TIMELINE };

    const result = await calculateTimelineMetadata(metadataOptionsFor(props));

    expect(result.props?.timeline).toEqual(TIMELINE);
    expect(result.props?.timeline).not.toBe(TIMELINE);
  });

  it('sin props de caption, no las inventa: quedan ausentes en el resultado', async () => {
    const props: TimelineCompositionProps = { timeline: TIMELINE };

    const result = await calculateTimelineMetadata(metadataOptionsFor(props));

    expect(result.props?.captionPreset).toBeUndefined();
    expect(result.props?.captionPlatform).toBeUndefined();
    expect(result.props?.captionAnchor).toBeUndefined();
  });

  it('deriva duration/fps/width/height de la Timeline (comportamiento preexistente, sin romper)', async () => {
    const props: TimelineCompositionProps = { timeline: TIMELINE };

    const result = await calculateTimelineMetadata(metadataOptionsFor(props));

    expect(result.durationInFrames).toBe(TIMELINE.durationFrames);
    expect(result.fps).toBe(TIMELINE.format.fps);
    expect(result.width).toBe(TIMELINE.format.width);
    expect(result.height).toBe(TIMELINE.format.height);
  });
});
