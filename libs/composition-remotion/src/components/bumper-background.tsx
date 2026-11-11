import type { FC } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Circle, Polygon, Star } from '@remotion/shapes';
import type { LogoBumperBackground } from '@video-maker/timeline-core';
import {
  bumperShapeSpots,
  glowBackgroundStyle,
  gradientBackgroundStyle,
  noiseBlobs,
} from '../helpers/bumper-background-style';
import type { BumperColors, BumperShapeSpot } from '../helpers/bumper-background-style';

export type BumperBackgroundProps = {
  kind: LogoBumperBackground;
  colors: BumperColors;
  durationInFrames: number;
  width: number;
  noiseSeed: string;
};

const NOISE_BLUR_RATIO = 0.06;
const POLYGON_POINTS = 6;
const STAR_POINTS = 5;

function ShapeAt({ spot, width }: { spot: BumperShapeSpot; width: number }) {
  const radius = Math.round(spot.radiusRatio * width);
  const transform = `translate(-50%, -50%) scale(${spot.scale}) rotate(${spot.rotationDeg}deg)`;
  const style = { position: 'absolute' as const, left: `${spot.xPercent}%`, top: `${spot.yPercent}%`, transform };
  if (spot.kind === 'star') {
    return <Star points={STAR_POINTS} innerRadius={radius / 2} outerRadius={radius} fill={spot.color} style={style} />;
  }
  if (spot.kind === 'polygon') {
    return <Polygon points={POLYGON_POINTS} radius={radius} cornerRadius={radius / 6} fill={spot.color} style={style} />;
  }
  return <Circle radius={radius} fill={spot.color} style={style} />;
}

function NoiseLayer({ colors, width, noiseSeed }: Omit<BumperBackgroundProps, 'kind' | 'durationInFrames'>) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: colors.base, overflow: 'hidden' }}>
      <AbsoluteFill style={{ filter: `blur(${Math.round(width * NOISE_BLUR_RATIO)}px)` }}>
        {noiseBlobs(colors, frame, noiseSeed).map((blob, index) => (
          <div
            key={index}
            style={{
              position: 'absolute',
              left: `${blob.xPercent}%`,
              top: `${blob.yPercent}%`,
              width: `${blob.sizePercent}%`,
              aspectRatio: '1',
              borderRadius: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: blob.color,
            }}
          />
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

export const BumperBackground: FC<BumperBackgroundProps> = ({ kind, colors, durationInFrames, width, noiseSeed }) => {
  const frame = useCurrentFrame();
  const progress = frame / Math.max(1, durationInFrames);

  switch (kind) {
    case 'gradient':
      return <AbsoluteFill style={gradientBackgroundStyle(colors, progress)} />;
    case 'glow':
      return <AbsoluteFill style={glowBackgroundStyle(colors, progress)} />;
    case 'noise':
      return <NoiseLayer colors={colors} width={width} noiseSeed={noiseSeed} />;
    case 'shapes':
      return (
        <AbsoluteFill style={{ backgroundColor: colors.base, overflow: 'hidden' }}>
          {bumperShapeSpots(colors, frame).map((spot, index) => (
            <ShapeAt key={index} spot={spot} width={width} />
          ))}
        </AbsoluteFill>
      );
    case 'solid':
    default:
      return <AbsoluteFill style={{ backgroundColor: colors.base }} />;
  }
};
