import type { CSSProperties, FC } from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { withAlpha } from '../../helpers/text-overlay-layout';
import {
  easedProgress,
  entryFade,
  entryFadeRise,
  entrySlide,
  exitFade,
  lineGrowth,
  plateReveal,
  TEXT_OVERLAY_DURATION,
} from '../../helpers/text-overlay-motion';
import type { TextOverlayPieceProps } from './text-overlay-props';

const NAME_SIZE_RATIO = 0.04;
const ROLE_SIZE_RATIO = 0.024;
const PAD_RATIO = 0.016;
const ROLE_OFFSET = 4;
const UNDERLINE_OFFSET = 8;
const BAR_FRAMES = 10;
const PLATE_WIPE_FRAMES = 14;
const PLATE_ALPHA = 0.9;

function textStyles(props: TextOverlayPieceProps): { name: CSSProperties; role: CSSProperties } {
  const { theme, layout } = props;
  return {
    name: {
      fontFamily: theme.fontFamily,
      fontWeight: 700,
      fontSize: Math.round(layout.unit * NAME_SIZE_RATIO),
      lineHeight: 1.15,
      color: theme.textColor,
      textAlign: layout.align,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      maxWidth: '100%',
    },
    role: {
      fontFamily: theme.fontFamily,
      fontWeight: 500,
      fontSize: Math.round(layout.unit * ROLE_SIZE_RATIO),
      lineHeight: 1.25,
      color: withAlpha(theme.textColor, 0.82),
      textAlign: layout.align,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      maxWidth: '100%',
    },
  };
}

function plateStyle(props: TextOverlayPieceProps): CSSProperties {
  const pad = Math.round(props.layout.unit * PAD_RATIO);
  return {
    display: 'flex',
    flexDirection: 'column',
    alignItems: props.layout.align === 'right' ? 'flex-end' : 'flex-start',
    gap: Math.round(pad * 0.35),
    padding: `${pad}px ${Math.round(pad * 1.4)}px`,
    borderRadius: Math.round(pad * 0.6),
    background: withAlpha(props.theme.plateColor, PLATE_ALPHA),
    maxWidth: '100%',
    boxSizing: 'border-box',
  };
}

const SlideUnderline: FC<TextOverlayPieceProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const styles = textStyles(props);
  const direction = props.layout.slideFrom;
  const distance = Math.round(props.layout.unit * 0.015);
  const name = entrySlide({ frame, fps, direction, distance, durationInFrames: TEXT_OVERLAY_DURATION.base });
  const role = entryFade({ frame, fps, delay: ROLE_OFFSET, durationInFrames: TEXT_OVERLAY_DURATION.base });
  const line = lineGrowth({ frame, fps, delay: UNDERLINE_OFFSET, durationInFrames: TEXT_OVERLAY_DURATION.fast });
  return (
    <div style={{ ...plateStyle(props), clipPath: plateReveal(frame, props.layout.align) }}>
      <div style={{ ...styles.name, opacity: name.opacity, transform: name.transform }}>{props.overlay.text}</div>
      {props.overlay.subtitle === null ? null : (
        <div style={{ ...styles.role, opacity: role.opacity }}>{props.overlay.subtitle}</div>
      )}
      <div
        data-testid="lower-third-underline"
        style={{
          alignSelf: props.layout.align === 'right' ? 'flex-end' : 'flex-start',
          width: `${line}%`,
          height: Math.max(2, Math.round(props.layout.unit * 0.003)),
          borderRadius: 2,
          background: props.theme.accentColor,
        }}
      />
    </div>
  );
};

const AccentBar: FC<TextOverlayPieceProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const styles = textStyles(props);
  const bar = easedProgress({ frame, durationInFrames: BAR_FRAMES });
  const away = props.layout.align === 'right' ? 'right' : 'left';
  const distance = Math.round(props.layout.unit * 0.02);
  const name = entrySlide({ frame, fps, direction: away, distance, delay: BAR_FRAMES - 4 });
  const role = entrySlide({ frame, fps, direction: away, distance, delay: BAR_FRAMES });
  const barWidth = Math.max(4, Math.round(props.layout.unit * 0.006));
  const barElement = (
    <div
      data-testid="lower-third-bar"
      style={{
        width: barWidth,
        alignSelf: 'stretch',
        borderRadius: barWidth,
        background: props.theme.accentColor,
        transform: `scaleY(${bar})`,
        transformOrigin: 'bottom',
      }}
    />
  );

  return (
    <div
      style={{
        ...plateStyle(props),
        flexDirection: props.layout.align === 'right' ? 'row-reverse' : 'row',
        alignItems: 'stretch',
        gap: Math.round(props.layout.unit * 0.012),
        clipPath: plateReveal(frame, props.layout.align, BAR_FRAMES + 4),
      }}
    >
      {barElement}
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, alignItems: props.layout.align === 'right' ? 'flex-end' : 'flex-start' }}>
        <div style={{ ...styles.name, opacity: name.opacity, transform: name.transform }}>{props.overlay.text}</div>
        {props.overlay.subtitle === null ? null : (
          <div style={{ ...styles.role, opacity: role.opacity, transform: role.transform }}>{props.overlay.subtitle}</div>
        )}
      </div>
    </div>
  );
};

function accentEdge(props: TextOverlayPieceProps): CSSProperties {
  const edge = `${Math.max(3, Math.round(props.layout.unit * 0.004))}px solid ${props.theme.accentColor}`;
  return props.layout.align === 'right' ? { borderRight: edge } : { borderLeft: edge };
}

const PlateWipe: FC<TextOverlayPieceProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const styles = textStyles(props);
  const wipe = easedProgress({ frame, durationInFrames: PLATE_WIPE_FRAMES });
  const hidden = `${100 * (1 - wipe)}%`;
  const clipPath = props.layout.align === 'right' ? `inset(0% 0% 0% ${hidden})` : `inset(0% ${hidden} 0% 0%)`;
  const travelPx = Math.round(props.layout.unit * 0.012);
  const name = entryFadeRise({ frame, fps, delay: PLATE_WIPE_FRAMES - 6, travelPx });
  const role = entryFadeRise({ frame, fps, delay: PLATE_WIPE_FRAMES - 2, travelPx });

  return (
    <div style={{ ...plateStyle(props), clipPath, ...accentEdge(props) }}>
      <div style={{ ...styles.name, opacity: name.opacity, transform: name.transform }}>{props.overlay.text}</div>
      {props.overlay.subtitle === null ? null : (
        <div style={{ ...styles.role, opacity: role.opacity, transform: role.transform }}>{props.overlay.subtitle}</div>
      )}
    </div>
  );
};

export const LowerThirdOverlay: FC<TextOverlayPieceProps> = (props) => {
  const frame = useCurrentFrame();
  const opacity = exitFade(frame, props.durationInFrames);
  const piece =
    props.overlay.variant === 'accent-bar' ? (
      <AccentBar {...props} />
    ) : props.overlay.variant === 'plate-wipe' ? (
      <PlateWipe {...props} />
    ) : (
      <SlideUnderline {...props} />
    );
  return (
    <div data-testid="text-overlay" data-kind="lower-third" data-variant={props.overlay.variant} style={{ ...props.layout.box, opacity }}>
      {piece}
    </div>
  );
};
