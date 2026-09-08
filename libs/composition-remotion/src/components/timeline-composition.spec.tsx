import { Children, isValidElement } from 'react';
import { describe, expect, it } from 'vitest';
import { buildExampleTimeline } from '../__fixtures__/example-timeline';
import { AudioTrack } from './audio-track';
import {
  TIMELINE_COMPOSITION_ID,
  TimelineComposition,
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

function mountsAudioTrack(props: TimelineCompositionProps): boolean {
  const tree = TimelineComposition(props);

  if (!isValidElement(tree)) {
    throw new Error('expected TimelineComposition to return an AbsoluteFill element');
  }

  const fragmentProps = tree.props as { children?: unknown };
  return Children.toArray(fragmentProps.children).some(
    (child) => isValidElement(child) && child.type === AudioTrack,
  );
}

describe('calculateTimelineMetadata', () => {
  it('preserva las props de caption y audio al reemplazar timeline en el resultado (D-23, R-13, CA-011)', async () => {
    const props: TimelineCompositionProps = {
      timeline: TIMELINE,
      audio: 'muted',
      captionPreset: 'clean-sans',
      captionPlatform: 'tiktok',
      captionAnchor: 'top',
    };

    const result = await calculateTimelineMetadata(metadataOptionsFor(props));

    expect(result.props).toBeDefined();
    expect(result.props?.audio).toBe('muted');
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

    expect(result.props?.audio).toBeUndefined();
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

describe('TimelineComposition', () => {
  it('sin audio monta AudioTrack (comportamiento preexistente, sin romper) (CA-011)', () => {
    expect(mountsAudioTrack({ timeline: TIMELINE })).toBe(true);
  });

  it("con audio: 'mix' monta AudioTrack, igual que sin la prop (CA-011)", () => {
    expect(mountsAudioTrack({ timeline: TIMELINE, audio: 'mix' })).toBe(true);
  });

  it("con audio: 'muted' no monta AudioTrack (CA-011)", () => {
    expect(mountsAudioTrack({ timeline: TIMELINE, audio: 'muted' })).toBe(false);
  });
});
