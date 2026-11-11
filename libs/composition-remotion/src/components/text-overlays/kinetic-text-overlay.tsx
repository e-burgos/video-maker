import type { CSSProperties, FC } from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import type { TextOverlayVariant } from '@video-maker/timeline-core';
import { withAlpha } from '../../helpers/text-overlay-layout';
import {
  blurReveal,
  entryFadeRise,
  entryPop,
  exitFade,
  plateReveal,
  splitWords,
  staggerDelay,
  TEXT_OVERLAY_DURATION,
} from '../../helpers/text-overlay-motion';
import type { MotionStyle } from '../../helpers/text-overlay-motion';
import type { TextOverlayPieceProps } from './text-overlay-props';

const TEXT_SIZE_RATIO = 0.05;
const PAD_RATIO = 0.016;
const PLATE_ALPHA = 0.88;

function wordMotion(variant: TextOverlayVariant, input: { frame: number; fps: number; delay: number; unit: number }): MotionStyle {
  const { frame, fps, delay, unit } = input;
  if (variant === 'word-pop') {
    return entryPop({ frame, fps, delay, from: 0.55 });
  }
  if (variant === 'word-blur') {
    return blurReveal({ frame, fps, delay, durationInFrames: TEXT_OVERLAY_DURATION.base, travelPx: 0, blurPx: 12 });
  }
  return entryFadeRise({ frame, fps, delay, durationInFrames: TEXT_OVERLAY_DURATION.base, travelPx: Math.round(unit * 0.018) });
}

function lineStyle(props: TextOverlayPieceProps): CSSProperties {
  const pad = Math.round(props.layout.unit * PAD_RATIO);
  return {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: props.layout.align === 'right' ? 'flex-end' : props.layout.align === 'center' ? 'center' : 'flex-start',
    columnGap: '0.3em',
    padding: `${pad}px ${Math.round(pad * 1.5)}px`,
    borderRadius: Math.round(pad * 0.7),
    background: withAlpha(props.theme.plateColor, PLATE_ALPHA),
    fontFamily: props.theme.fontFamily,
    fontWeight: 800,
    fontSize: Math.round(props.layout.unit * TEXT_SIZE_RATIO),
    lineHeight: 1.12,
    color: props.theme.textColor,
    maxWidth: '100%',
    boxSizing: 'border-box',
  };
}

export const KineticTextOverlay: FC<TextOverlayPieceProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = splitWords(props.overlay.text);
  const lastIndex = words.length - 1;

  return (
    <div
      data-testid="text-overlay"
      data-kind="kinetic-text"
      data-variant={props.overlay.variant}
      style={{ ...props.layout.box, opacity: exitFade(frame, props.durationInFrames) }}
    >
      <div style={{ ...lineStyle(props), clipPath: plateReveal(frame, props.layout.align, 2 + staggerDelay(lastIndex) + TEXT_OVERLAY_DURATION.fast) }}>
        {words.map((word, index) => {
          const motion = wordMotion(props.overlay.variant, { frame, fps, delay: 2 + staggerDelay(index), unit: props.layout.unit });
          return (
            <span
              key={`${index}-${word}`}
              style={{
                display: 'inline-block',
                opacity: motion.opacity,
                transform: motion.transform,
                filter: motion.filter,
                color: index === lastIndex && lastIndex > 0 ? props.theme.accentColor : undefined,
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    </div>
  );
};
