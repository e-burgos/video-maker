import type { FC } from 'react';
import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig } from 'remotion';
import type { SceneKenBurns } from '@video-maker/timeline-core';
import { kenBurnsCss, kenBurnsTransform } from '../../helpers/ken-burns';

export type ImageKenBurnsSceneProps = {
  src: string;
  move: SceneKenBurns;
  durationInFrames?: number | undefined;
};

const IMAGE_STYLE = { width: '100%', height: '100%', objectFit: 'cover' } as const;

export const ImageKenBurnsScene: FC<ImageKenBurnsSceneProps> = ({ src, move, durationInFrames }) => {
  const frame = useCurrentFrame();
  const config = useVideoConfig();
  const transform = kenBurnsTransform({
    frame,
    durationInFrames: durationInFrames ?? config.durationInFrames,
    move,
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#0b0d12', overflow: 'hidden' }}>
      <Img src={src} style={{ ...IMAGE_STYLE, transform: kenBurnsCss(transform) }} />
    </AbsoluteFill>
  );
};
