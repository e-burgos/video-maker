import type { FC } from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { resolveTextOverlays, resolveTextOverlayTheme } from '@video-maker/timeline-core';
import type { ResolvedTextOverlay, SafeZone, Timeline } from '@video-maker/timeline-core';
import { textOverlayLayout } from '../../helpers/text-overlay-layout';
import { BrandCaptionFonts } from '../brand-caption-fonts';
import { ChapterTitleOverlay } from './chapter-title-overlay';
import { KineticTextOverlay } from './kinetic-text-overlay';
import { LowerThirdOverlay } from './lower-third-overlay';
import type { TextOverlayPieceProps } from './text-overlay-props';

export interface TextOverlayTrackProps {
  readonly timeline: Timeline;
  readonly safeZone: SafeZone;
  readonly reserveCaptionBand: boolean;
}

function msToFrames(ms: number, fps: number): number {
  return Math.round((ms / 1000) * fps);
}

const PIECE_BY_KIND: Readonly<Record<ResolvedTextOverlay['kind'], FC<TextOverlayPieceProps>>> = {
  'lower-third': LowerThirdOverlay,
  'chapter-title': ChapterTitleOverlay,
  'kinetic-text': KineticTextOverlay,
};

export const TextOverlayTrack: FC<TextOverlayTrackProps> = ({ timeline, safeZone, reserveCaptionBand }) => {
  const overlays = resolveTextOverlays(timeline);
  if (overlays.length === 0) {
    return null;
  }
  const theme = resolveTextOverlayTheme(timeline);
  const { fps } = timeline.format;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {timeline.captionTheme === undefined ? null : <BrandCaptionFonts theme={timeline.captionTheme} />}
      {overlays.map((overlay) => {
        const Piece = PIECE_BY_KIND[overlay.kind];
        const durationInFrames = Math.max(1, msToFrames(overlay.durationMs, fps));
        const layout = textOverlayLayout({
          kind: overlay.kind,
          placement: overlay.placement,
          format: timeline.format,
          safeZone,
          reserveCaptionBand: reserveCaptionBand && overlay.placement.startsWith('bottom'),
        });
        return (
          <Sequence key={overlay.id} from={msToFrames(overlay.startMs, fps)} durationInFrames={durationInFrames} layout="none">
            <Piece overlay={overlay} theme={theme} layout={layout} durationInFrames={durationInFrames} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
