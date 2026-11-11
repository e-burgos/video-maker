import { Children, isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { Sequence } from 'remotion';
import { safeZoneFor } from '@video-maker/timeline-core';
import type { Timeline } from '@video-maker/timeline-core';
import { buildExampleTimeline } from '../../__fixtures__/example-timeline';
import { BrandCaptionFonts } from '../brand-caption-fonts';
import { ChapterTitleOverlay } from './chapter-title-overlay';
import { KineticTextOverlay } from './kinetic-text-overlay';
import { LowerThirdOverlay } from './lower-third-overlay';
import { TextOverlayTrack } from './text-overlay-track';

type SequenceElement = ReactElement<{ from: number; durationInFrames: number; children: ReactElement<{ layout: { box: { bottom?: number } } }> }>;

const BASE = buildExampleTimeline('youtube-16x9');

function withOverlays(extra: Partial<Timeline>): Timeline {
  return {
    ...BASE,
    textOverlays: [
      { id: 'c1', kind: 'chapter-title', startMs: 0, durationMs: 1500, text: 'Ventas', eyebrow: '01' },
      { id: 'l1', kind: 'lower-third', startMs: 2000, durationMs: 1500, text: 'Caja diaria', subtitle: 'Cierre del día' },
      { id: 'k1', kind: 'kinetic-text', startMs: 4000, durationMs: 1300, text: 'Listo en un clic' },
    ],
    ...extra,
  };
}

function childrenOf(tree: ReactNode): ReactElement[] {
  if (!isValidElement(tree)) {
    return [];
  }
  return Children.toArray((tree.props as { children?: ReactNode }).children).filter(isValidElement) as ReactElement[];
}

describe('TextOverlayTrack', () => {
  it('no monta nada sin textos', () => {
    expect(TextOverlayTrack({ timeline: BASE, safeZone: safeZoneFor(BASE.format), reserveCaptionBand: false })).toBeNull();
  });

  it('monta una secuencia por texto, en su cuadro y con la pieza de su tipo', () => {
    const tree = TextOverlayTrack({ timeline: withOverlays({}), safeZone: safeZoneFor(BASE.format), reserveCaptionBand: false });
    const sequences = childrenOf(tree).filter((child) => child.type === Sequence) as SequenceElement[];
    expect(sequences.map((sequence) => [sequence.props.from, sequence.props.durationInFrames])).toEqual([
      [0, 45],
      [60, 45],
      [120, 39],
    ]);
    expect(sequences.map((sequence) => sequence.props.children.type)).toEqual([
      ChapterTitleOverlay,
      LowerThirdOverlay,
      KineticTextOverlay,
    ]);
  });

  it('solo los textos de abajo esquivan la banda de subtítulos', () => {
    const tree = TextOverlayTrack({ timeline: withOverlays({}), safeZone: safeZoneFor(BASE.format), reserveCaptionBand: true });
    const lowerThird = (childrenOf(tree).filter((child) => child.type === Sequence) as SequenceElement[])[1];
    expect(lowerThird?.props.children.props.layout.box.bottom).toBe(60 + 22 + 216);
  });

  it('carga la tipografía de la marca cuando la timeline la trae', () => {
    const tree = TextOverlayTrack({
      timeline: withOverlays({
        captionTheme: {
          fontFamily: 'Marca',
          fontFiles: [{ path: 'fonts/marca.woff2' }],
          textColor: '#ffffff',
          accentColor: '#ff0066',
          boxColor: '#111111',
        },
      }),
      safeZone: safeZoneFor(BASE.format),
      reserveCaptionBand: false,
    });
    expect(childrenOf(tree).some((child) => child.type === BrandCaptionFonts)).toBe(true);
  });
});
