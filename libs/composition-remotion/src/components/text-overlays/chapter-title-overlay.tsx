import type { CSSProperties, FC } from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { withAlpha } from '../../helpers/text-overlay-layout';
import {
  blurReveal,
  easedProgress,
  entryFade,
  entryFadeRise,
  exitFade,
  plateReveal,
  lineGrowth,
  splitWords,
  staggerDelay,
  TEXT_OVERLAY_DURATION,
} from '../../helpers/text-overlay-motion';
import type { TextOverlayPieceProps } from './text-overlay-props';

const TITLE_SIZE_RATIO = 0.056;
const EYEBROW_SIZE_RATIO = 0.024;
const SUBTITLE_SIZE_RATIO = 0.026;
const PAD_RATIO = 0.02;
const TITLE_OFFSET = 6;
const UNDERLINE_OFFSET = TITLE_OFFSET + 16;
const PLATE_ALPHA = 0.9;

function titleStyle(props: TextOverlayPieceProps): CSSProperties {
  return {
    fontFamily: props.theme.fontFamily,
    fontWeight: 800,
    fontSize: Math.round(props.layout.unit * TITLE_SIZE_RATIO),
    lineHeight: 1.08,
    letterSpacing: '-0.01em',
    color: props.theme.textColor,
    textAlign: props.layout.align,
    overflowWrap: 'break-word',
    maxWidth: '100%',
  };
}

function eyebrowStyle(props: TextOverlayPieceProps): CSSProperties {
  return {
    fontFamily: props.theme.fontFamily,
    fontWeight: 700,
    fontSize: Math.round(props.layout.unit * EYEBROW_SIZE_RATIO),
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: props.theme.accentColor,
  };
}

function subtitleStyle(props: TextOverlayPieceProps): CSSProperties {
  return {
    fontFamily: props.theme.fontFamily,
    fontWeight: 500,
    fontSize: Math.round(props.layout.unit * SUBTITLE_SIZE_RATIO),
    lineHeight: 1.25,
    color: withAlpha(props.theme.textColor, 0.82),
    textAlign: props.layout.align,
    maxWidth: '100%',
  };
}

function plateStyle(props: TextOverlayPieceProps): CSSProperties {
  const pad = Math.round(props.layout.unit * PAD_RATIO);
  return {
    display: 'flex',
    flexDirection: 'column',
    alignItems: props.layout.align === 'right' ? 'flex-end' : props.layout.align === 'center' ? 'center' : 'flex-start',
    gap: Math.round(pad * 0.45),
    padding: `${pad}px ${Math.round(pad * 1.3)}px`,
    borderRadius: Math.round(pad * 0.6),
    background: withAlpha(props.theme.plateColor, PLATE_ALPHA),
    maxWidth: '100%',
    boxSizing: 'border-box',
  };
}

const Underline: FC<TextOverlayPieceProps & { delay: number }> = (props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const width = lineGrowth({ frame, fps, delay: props.delay, durationInFrames: TEXT_OVERLAY_DURATION.fast });
  return (
    <div
      style={{
        width: `${width * 0.35}%`,
        minWidth: width > 0 ? 24 : 0,
        height: Math.max(3, Math.round(props.layout.unit * 0.004)),
        borderRadius: 3,
        background: props.theme.accentColor,
      }}
    />
  );
};

const Eyebrow: FC<TextOverlayPieceProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (props.overlay.eyebrow === null) {
    return null;
  }
  const { opacity } = entryFade({ frame, fps, durationInFrames: TEXT_OVERLAY_DURATION.base });
  return <div style={{ ...eyebrowStyle(props), opacity }}>{props.overlay.eyebrow}</div>;
};

const Subtitle: FC<TextOverlayPieceProps & { delay: number }> = (props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (props.overlay.subtitle === null) {
    return null;
  }
  const { opacity } = entryFade({ frame, fps, delay: props.delay, durationInFrames: TEXT_OVERLAY_DURATION.base });
  return <div style={{ ...subtitleStyle(props), opacity }}>{props.overlay.subtitle}</div>;
};

const BlurRise: FC<TextOverlayPieceProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const title = blurReveal({
    frame,
    fps,
    delay: TITLE_OFFSET,
    durationInFrames: TEXT_OVERLAY_DURATION.base,
    travelPx: Math.round(props.layout.unit * 0.015),
    blurPx: 10,
  });
  return (
    <>
      <Eyebrow {...props} />
      <div style={{ ...titleStyle(props), opacity: title.opacity, transform: title.transform, filter: title.filter }}>
        {props.overlay.text}
      </div>
      <Underline {...props} delay={UNDERLINE_OFFSET} />
      <Subtitle {...props} delay={UNDERLINE_OFFSET} />
    </>
  );
};

const MaskWipe: FC<TextOverlayPieceProps> = (props) => {
  const frame = useCurrentFrame();
  const rise = easedProgress({ frame, delay: TITLE_OFFSET - 4, durationInFrames: TEXT_OVERLAY_DURATION.slow });
  return (
    <>
      <Eyebrow {...props} />
      <div style={{ overflow: 'hidden', maxWidth: '100%' }}>
        <div style={{ ...titleStyle(props), transform: `translateY(${110 * (1 - rise)}%)` }}>{props.overlay.text}</div>
      </div>
      <Underline {...props} delay={TITLE_OFFSET + 6} />
      <Subtitle {...props} delay={TITLE_OFFSET + 10} />
    </>
  );
};

const WordStagger: FC<TextOverlayPieceProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = splitWords(props.overlay.text);
  const travelPx = Math.round(props.layout.unit * 0.02);
  const justify = props.layout.align === 'right' ? 'flex-end' : props.layout.align === 'center' ? 'center' : 'flex-start';
  return (
    <>
      <Eyebrow {...props} />
      <div style={{ ...titleStyle(props), display: 'flex', flexWrap: 'wrap', justifyContent: justify, columnGap: '0.28em' }}>
        {words.map((word, index) => {
          const motion = entryFadeRise({ frame, fps, delay: TITLE_OFFSET - 4 + staggerDelay(index), travelPx });
          return (
            <span key={`${index}-${word}`} style={{ display: 'inline-block', opacity: motion.opacity, transform: motion.transform }}>
              {word}
            </span>
          );
        })}
      </div>
      <Underline {...props} delay={TITLE_OFFSET + staggerDelay(words.length)} />
      <Subtitle {...props} delay={TITLE_OFFSET + staggerDelay(words.length)} />
    </>
  );
};

export const ChapterTitleOverlay: FC<TextOverlayPieceProps> = (props) => {
  const frame = useCurrentFrame();
  const piece =
    props.overlay.variant === 'mask-wipe' ? (
      <MaskWipe {...props} />
    ) : props.overlay.variant === 'word-stagger' ? (
      <WordStagger {...props} />
    ) : (
      <BlurRise {...props} />
    );
  return (
    <div
      data-testid="text-overlay"
      data-kind="chapter-title"
      data-variant={props.overlay.variant}
      style={{ ...props.layout.box, opacity: exitFade(frame, props.durationInFrames) }}
    >
      <div style={{ ...plateStyle(props), clipPath: plateReveal(frame, props.layout.align) }}>{piece}</div>
    </div>
  );
};
