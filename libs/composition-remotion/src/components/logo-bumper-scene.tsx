import type { CSSProperties, FC } from 'react';
import { AbsoluteFill, Img, useCurrentFrame } from 'remotion';
import type { LogoBumper, OutputFormat } from '@video-maker/timeline-core';
import { logoBumperLogoStyle } from '../helpers/logo-bumper-style';

export type LogoBumperSceneProps = {
  bumper: LogoBumper;
  format: OutputFormat;
  durationInFrames: number;
  logoSrc: string | null;
};

const SCENE_LAYOUT: CSSProperties = { alignItems: 'center', justifyContent: 'center' };

export const LogoBumperScene: FC<LogoBumperSceneProps> = ({
  bumper,
  format,
  durationInFrames,
  logoSrc,
}) => {
  const frame = useCurrentFrame();
  const { opacity, transform } = logoBumperLogoStyle({
    animation: bumper.animation,
    frame,
    fps: format.fps,
    durationInFrames,
  });

  return (
    <AbsoluteFill
      data-testid="logo-bumper-scene"
      style={{ ...SCENE_LAYOUT, backgroundColor: bumper.backgroundColor }}
    >
      {logoSrc === null ? null : (
        <Img
          src={logoSrc}
          style={{ width: Math.round(format.width * bumper.logoWidthRatio), opacity, transform }}
        />
      )}
    </AbsoluteFill>
  );
};
