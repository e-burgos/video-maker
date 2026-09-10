import type { CSSProperties } from 'react';
import type { ClipId, Frame, OutputFormat, SafeZone } from '@video-maker/timeline-core';
import { captionBoxFor } from './caption-box';
import type { CaptionAnchor } from './caption-box';
import { fitCaptionFontSize } from './caption-font-size';
import type { CaptionPreset } from './caption-preset';
import type { CaptionPlatform } from './caption-safe-zone';
import { captionSafeZone } from './caption-safe-zone';
import type { CaptionSequenceProps } from './timeline-to-sequence-props';
import type { CaptionBox, CaptionWord } from './timeline-types';

export type CaptionBoxSource = 'preset' | 'clip';

export interface CaptionClipPlan {
  clipId: ClipId;
  from: Frame;
  durationInFrames: number;
  words: readonly CaptionWord[];
  emphasisIndex: number | null;
  box: CaptionBox;
  fontSize: number;
}

export interface CaptionClipPlanInput {
  clips: readonly CaptionSequenceProps[];
  format: OutputFormat;
  preset: CaptionPreset;
  safeZone?: SafeZone | undefined;
  platform?: CaptionPlatform | undefined;
  anchor?: CaptionAnchor | undefined;
  boxSource?: CaptionBoxSource | undefined;
}

function boxFor(
  clip: CaptionSequenceProps,
  source: CaptionBoxSource,
  presetBox: CaptionBox,
): CaptionBox {
  return source === 'clip' ? (clip.box ?? presetBox) : presetBox;
}

export function captionClipPlan(input: CaptionClipPlanInput): readonly CaptionClipPlan[] {
  const resolvedSafeZone = captionSafeZone(input.format, input.platform, input.safeZone);
  const presetBox = captionBoxFor(resolvedSafeZone, input.format, input.preset, input.anchor);
  const source = input.boxSource ?? 'preset';

  return input.clips.map((clip) => {
    const box = boxFor(clip, source, presetBox);
    const fontSize = fitCaptionFontSize(clip.words, box, input.preset, input.format, clip.emphasisIndex);

    return {
      clipId: clip.clipId,
      from: clip.from,
      durationInFrames: clip.durationInFrames,
      words: clip.words,
      emphasisIndex: clip.emphasisIndex,
      box,
      fontSize,
    };
  });
}

export function captionBoxStyle(box: CaptionBox, fontSize: number): CSSProperties {
  return {
    position: 'absolute',
    left: box.x,
    top: box.y,
    width: box.width,
    height: box.height,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize,
    textAlign: 'center',
  };
}
