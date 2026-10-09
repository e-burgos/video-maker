import type { FC } from 'react';
import { Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import type { CaptionTheme, OutputFormat, SafeZone } from '@video-maker/timeline-core';
import { captionClipAnimation, captionBlockStyle } from '../helpers/caption-animation';
import { captionWordRenders } from '../helpers/caption-active-word';
import type { CaptionAnchor } from '../helpers/caption-box';
import { captionBoxStyle, captionClipPlan } from '../helpers/caption-clip-plan';
import type { CaptionBoxSource, CaptionClipPlan } from '../helpers/caption-clip-plan';
import { brandCaptionPreset } from '../helpers/brand-caption-preset';
import { captionPreset, captionPresetForFrame } from '../helpers/caption-preset';
import type { CaptionPreset, CaptionPresetId } from '../helpers/caption-preset';
import type { CaptionPlatform } from '../helpers/caption-safe-zone';
import { captionWordStyle } from '../helpers/caption-word-style';
import { BrandCaptionFonts } from './brand-caption-fonts';
import type { CaptionSequenceProps } from '../helpers/timeline-to-sequence-props';

export interface KineticCaptionsProps {
  clips: readonly CaptionSequenceProps[];
  format: OutputFormat;
  safeZone?: SafeZone | undefined;
  preset?: CaptionPresetId | undefined;
  platform?: CaptionPlatform | undefined;
  anchor?: CaptionAnchor | undefined;
  boxSource?: CaptionBoxSource | undefined;
  theme?: CaptionTheme | undefined;
}

const CaptionClipBlock: FC<{ plan: CaptionClipPlan; preset: CaptionPreset }> = ({
  plan,
  preset,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const animation = captionClipAnimation({
    frame,
    durationInFrames: plan.durationInFrames,
    fps,
    preset,
  });

  return (
    <div style={captionBlockStyle(animation, preset)}>
      {captionWordRenders(frame, plan.words, plan.emphasisIndex).map((render, index) => (
        <span key={`${plan.clipId}-${index}`} style={captionWordStyle(preset, render.state, [...render.text].length)}>
          {render.text}
        </span>
      ))}
    </div>
  );
};

export const KineticCaptions: FC<KineticCaptionsProps> = ({
  clips,
  format,
  safeZone,
  preset,
  platform,
  anchor,
  boxSource,
  theme,
}) => {
  const brandTheme = preset === 'brand' ? theme : undefined;
  const resolvedPreset = captionPresetForFrame(
    brandTheme === undefined ? captionPreset(preset) : brandCaptionPreset(brandTheme),
    format,
  );

  return (
    <>
      {brandTheme === undefined ? null : <BrandCaptionFonts theme={brandTheme} />}
      {captionClipPlan({
        clips,
        format,
        preset: resolvedPreset,
        safeZone,
        platform,
        anchor,
        boxSource,
      }).map((plan) => (
        <Sequence
          key={plan.clipId}
          name={plan.clipId}
          from={plan.from}
          durationInFrames={plan.durationInFrames}
        >
          <div style={captionBoxStyle(plan.box, plan.fontSize, resolvedPreset.sidePaddingRatio)}>
            <CaptionClipBlock plan={plan} preset={resolvedPreset} />
          </div>
        </Sequence>
      ))}
    </>
  );
};
