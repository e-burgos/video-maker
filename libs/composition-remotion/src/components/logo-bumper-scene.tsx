import type { CSSProperties, FC } from 'react';
import { AbsoluteFill, Img, useCurrentFrame } from 'remotion';
import type { BumperLook, OutputFormat } from '@video-maker/timeline-core';
import { logoBumperEnterFrames, logoBumperFadeOut, logoBumperLogoStyle } from '../helpers/logo-bumper-style';
import { readableTextColor, typedCaption } from '../helpers/bumper-background-style';
import { BumperBackground } from './bumper-background';

export type LogoBumperSceneProps = {
  look: BumperLook;
  logoWidthRatio: number;
  format: OutputFormat;
  durationInFrames: number;
  logoSrc: string | null;
  noiseSeed: string;
};

const SCENE_LAYOUT: CSSProperties = { alignItems: 'center', justifyContent: 'center', flexDirection: 'column' };
const CAPTION_FONT_RATIO = 0.032;
const CAPTION_GAP_RATIO = 0.025;
const CAPTION_TYPING_FRAMES_PER_CHAR = 1;

export const LogoBumperScene: FC<LogoBumperSceneProps> = ({
  look,
  logoWidthRatio,
  format,
  durationInFrames,
  logoSrc,
  noiseSeed,
}) => {
  const frame = useCurrentFrame();
  const logo = logoBumperLogoStyle({ animation: look.reveal, frame, fps: format.fps, durationInFrames });
  const enterFrames = logoBumperEnterFrames(format.fps, durationInFrames);
  const shortSide = Math.min(format.width, format.height);
  const caption =
    look.caption === null
      ? ''
      : typedCaption(look.caption, frame, enterFrames, look.caption.length * CAPTION_TYPING_FRAMES_PER_CHAR);

  return (
    <AbsoluteFill
      data-testid="logo-bumper-scene"
      data-background={look.background}
      data-reveal={look.reveal}
      data-sfx={look.sfxKind ?? 'none'}
    >
      <BumperBackground
        kind={look.background}
        colors={{ base: look.baseColor, accent: look.accentColor, secondary: look.secondaryColor }}
        durationInFrames={durationInFrames}
        width={format.width}
        noiseSeed={noiseSeed}
      />
      <AbsoluteFill style={{ ...SCENE_LAYOUT, gap: Math.round(shortSide * CAPTION_GAP_RATIO) }}>
        {logoSrc === null ? null : (
          <Img
            src={logoSrc}
            style={{
              width: Math.round(format.width * logoWidthRatio),
              opacity: logo.opacity,
              transform: logo.transform,
              filter: logo.filter,
              clipPath: logo.clipPath,
            }}
          />
        )}
        {look.caption === null ? null : (
          <div
            data-testid="logo-bumper-caption"
            style={{
              minHeight: Math.round(shortSide * CAPTION_FONT_RATIO * 1.3),
              fontFamily: 'Inter, "Helvetica Neue", Arial, sans-serif',
              fontWeight: 600,
              letterSpacing: '0.02em',
              fontSize: Math.round(shortSide * CAPTION_FONT_RATIO),
              color: readableTextColor(look.baseColor),
              opacity: logoBumperFadeOut(frame, format.fps, durationInFrames),
            }}
          >
            {caption}
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
