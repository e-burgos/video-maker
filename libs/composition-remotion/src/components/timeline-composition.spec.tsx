import { Children, isValidElement } from 'react';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { Sequence } from 'remotion';
import type { LogoBumper, Timeline } from '@video-maker/timeline-core';
import { LogoBumperScene } from './logo-bumper-scene';
import { buildExampleTimeline } from '../__fixtures__/example-timeline';
import { AudioTrack } from './audio-track';
import { KineticCaptions } from './kinetic-captions';
import { LogoOverlay } from './logo-overlay';
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

function childTypes(props: TimelineCompositionProps): unknown[] {
  const tree = TimelineComposition(props);

  if (!isValidElement(tree)) {
    throw new Error('expected TimelineComposition to return an AbsoluteFill element');
  }

  const fragmentProps = tree.props as { children?: unknown };
  return Children.toArray(fragmentProps.children)
    .filter((child) => isValidElement(child))
    .map((child) => (child as { type: unknown }).type);
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

describe('TimelineComposition — capa de logo (spec-014)', () => {
  const withLogo: TimelineCompositionProps = {
    timeline: {
      ...TIMELINE,
      logo: {
        assetId: 'broll-shot-01',
        position: 'bottom-right',
        widthRatio: 0.32,
        marginRatio: 0.035,
        opacity: 1,
      },
    },
  };

  it('sin logo en la Timeline no monta LogoOverlay', () => {
    expect(childTypes({ timeline: TIMELINE })).not.toContain(LogoOverlay);
  });

  it('con logo monta LogoOverlay debajo de las captions y encima del B-roll', () => {
    const types = childTypes(withLogo);

    expect(types).toContain(LogoOverlay);
    expect(types.indexOf(LogoOverlay)).toBeLessThan(types.indexOf(KineticCaptions));
  });

  it('el logo se monta también con el audio muteado', () => {
    expect(childTypes({ ...withLogo, audio: 'muted' })).toContain(LogoOverlay);
  });
});

describe('TimelineComposition — captionStyle del documento (FIX-e-burgos-003-003)', () => {
  function captionPresetOf(props: TimelineCompositionProps): unknown {
    const tree = TimelineComposition(props);
    if (!isValidElement(tree)) {
      throw new Error('expected TimelineComposition to return an AbsoluteFill element');
    }
    const fragmentProps = tree.props as { children?: unknown };
    const captions = Children.toArray(fragmentProps.children).find(
      (child) => isValidElement(child) && child.type === KineticCaptions,
    );
    return isValidElement(captions) ? (captions.props as { preset?: unknown }).preset : undefined;
  }

  it('el captionStyle de la Timeline elige el preset tipográfico', () => {
    expect(captionPresetOf({ timeline: { ...TIMELINE, captionStyle: 'subtle-lower' } })).toBe(
      'subtle-lower',
    );
  });

  it('el captionStyle de la Timeline gana sobre la prop de preview', () => {
    expect(
      captionPresetOf({
        timeline: { ...TIMELINE, captionStyle: 'outline-pop' },
        captionPreset: 'clean-sans',
      }),
    ).toBe('outline-pop');
  });

  it('sin captionStyle sigue mandando la prop de preview', () => {
    expect(captionPresetOf({ timeline: TIMELINE, captionPreset: 'clean-sans' })).toBe('clean-sans');
  });

  it("con captionStyle 'off' no monta la capa de captions", () => {
    expect(childTypes({ timeline: { ...TIMELINE, captionStyle: 'off' } })).not.toContain(
      KineticCaptions,
    );
  });

  it('sin captionStyle monta las captions como siempre', () => {
    expect(childTypes({ timeline: TIMELINE })).toContain(KineticCaptions);
  });
});

describe('TimelineComposition — bumpers de logo (FIX-e-burgos-001-003)', () => {
  const LOGO = {
    assetId: 'broll-shot-01',
    position: 'bottom-right' as const,
    widthRatio: 0.32,
    marginRatio: 0.035,
    opacity: 1,
  };

  const BUMPER: LogoBumper = {
    enabled: true,
    durationMs: 2000,
    backgroundColor: '#ffffff',
    animation: 'zoom',
    logoWidthRatio: 0.4,
  };

  const INTRO_FRAMES = 60;

  function withBumpers(bumpers: Timeline['bumpers']): TimelineCompositionProps {
    return { timeline: { ...TIMELINE, logo: LOGO, bumpers } };
  }

  function sequencesOf(props: TimelineCompositionProps): ReactElement<{
    from: number;
    durationInFrames: number;
    children?: unknown;
  }>[] {
    const tree = TimelineComposition(props);
    if (!isValidElement(tree)) {
      throw new Error('expected TimelineComposition to return an AbsoluteFill element');
    }
    const fragmentProps = tree.props as { children?: unknown };
    return Children.toArray(fragmentProps.children).filter(
      (child): child is ReactElement<{ from: number; durationInFrames: number; children?: unknown }> =>
        isValidElement(child) && child.type === Sequence,
    );
  }

  function childOf(sequence: ReactElement<{ children?: unknown }> | undefined): ReactElement {
    const [child] = Children.toArray(sequence?.props.children);
    if (!isValidElement(child)) {
      throw new Error('expected the Sequence to hold a single element');
    }
    return child;
  }

  function childTypesOfContentSequence(props: TimelineCompositionProps): unknown[] {
    const content = sequencesOf(props).find((sequence) => sequence.props.from === INTRO_FRAMES);
    if (content === undefined) {
      throw new Error('expected a content Sequence shifted by the intro');
    }
    return Children.toArray(content.props.children)
      .filter((child) => isValidElement(child))
      .map((child) => (child as { type: unknown }).type);
  }

  it('sin bumpers el árbol es el de siempre: ninguna Sequence al tope', () => {
    expect(sequencesOf({ timeline: TIMELINE })).toHaveLength(0);
    expect(childTypes({ timeline: TIMELINE })).toContain(KineticCaptions);
  });

  it('con intro desplaza todo el contenido introFrames hacia adelante', () => {
    const sequences = sequencesOf(withBumpers({ intro: BUMPER }));

    expect(sequences.map((sequence) => sequence.props.from)).toEqual([0, INTRO_FRAMES]);
    expect(sequences[1]?.props.durationInFrames).toBe(TIMELINE.durationFrames);
  });

  it('con outro agrega la placa al final del contenido', () => {
    const sequences = sequencesOf(withBumpers({ outro: BUMPER }));

    expect(sequences.map((sequence) => sequence.props.from)).toEqual([0, TIMELINE.durationFrames]);
  });

  it('con intro y outro las tres secuencias van en orden y sin huecos', () => {
    const sequences = sequencesOf(withBumpers({ intro: BUMPER, outro: BUMPER }));

    expect(sequences.map((sequence) => sequence.props.from)).toEqual([
      0,
      INTRO_FRAMES,
      INTRO_FRAMES + TIMELINE.durationFrames,
    ]);
    expect(sequences.map((sequence) => sequence.props.durationInFrames)).toEqual([
      INTRO_FRAMES,
      TIMELINE.durationFrames,
      INTRO_FRAMES,
    ]);
  });

  it('el overlay de logo y las captions viven dentro de la secuencia de contenido', () => {
    const types = childTypesOfContentSequence(withBumpers({ intro: BUMPER }));

    expect(types).toContain(LogoOverlay);
    expect(types).toContain(KineticCaptions);
    expect(types).toContain(AudioTrack);
  });

  it('un bumper apagado no monta ninguna placa', () => {
    expect(sequencesOf(withBumpers({ intro: { ...BUMPER, enabled: false } }))).toHaveLength(0);
  });

  it('la placa recibe el bumper, el formato y el src del logo de la Timeline', () => {
    const intro = sequencesOf(withBumpers({ intro: BUMPER }))[0];
    const scene = childOf(intro) as ReactElement<{
      bumper: LogoBumper;
      logoSrc: string | null;
      durationInFrames: number;
    }>;

    expect(scene.type).toBe(LogoBumperScene);
    expect(scene.props.bumper).toEqual(BUMPER);
    expect(scene.props.durationInFrames).toBe(INTRO_FRAMES);
    expect(scene.props.logoSrc).toBe('/example/broll.jpg');
  });

  it('sin logo la placa se dibuja igual, sólo con el fondo de color', () => {
    const props: TimelineCompositionProps = { timeline: { ...TIMELINE, bumpers: { intro: BUMPER } } };
    const scene = childOf(sequencesOf(props)[0]) as ReactElement<{ logoSrc: string | null }>;

    expect(scene.type).toBe(LogoBumperScene);
    expect(scene.props.logoSrc).toBeNull();
  });

  it('calculateTimelineMetadata devuelve el total: intro + contenido + outro', async () => {
    const props = withBumpers({ intro: BUMPER, outro: BUMPER });

    const result = await calculateTimelineMetadata(metadataOptionsFor(props));

    expect(result.durationInFrames).toBe(TIMELINE.durationFrames + 2 * INTRO_FRAMES);
    expect(result.props?.timeline.durationFrames).toBe(TIMELINE.durationFrames);
  });
});
