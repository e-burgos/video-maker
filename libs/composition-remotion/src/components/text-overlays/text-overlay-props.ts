import type { ResolvedTextOverlay, TextOverlayTheme } from '@video-maker/timeline-core';
import type { TextOverlayLayout } from '../../helpers/text-overlay-layout';

export interface TextOverlayPieceProps {
  readonly overlay: ResolvedTextOverlay;
  readonly theme: TextOverlayTheme;
  readonly layout: TextOverlayLayout;
  readonly durationInFrames: number;
}
