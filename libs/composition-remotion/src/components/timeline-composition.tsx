import type { FC } from 'react';
import type { CalculateMetadataFunction } from 'remotion';
import { AbsoluteFill, Sequence } from 'remotion';
import type { Timeline } from '@video-maker/timeline-core';
import { introBumperFrames, outroBumperFrames, safeZoneFor } from '@video-maker/timeline-core';
import { captionPresetIdForStyle } from '../helpers/caption-style-preset';
import type { CaptionAnchor } from '../helpers/caption-box';
import type { CaptionPresetId } from '../helpers/caption-preset';
import type { CaptionPlatform } from '../helpers/caption-safe-zone';
import { computeTimelineMetadata } from '../helpers/timeline-metadata';
import { timelineToSequenceProps } from '../helpers/timeline-to-sequence-props';
import { ArollSeries } from './aroll-series';
import { BrollTrack } from './broll-track';
import { AudioTrack } from './audio-track';
import { KineticCaptions } from './kinetic-captions';
import { LogoBumperScene } from './logo-bumper-scene';
import { LogoOverlay } from './logo-overlay';

export type TimelineAudioMode = 'mix' | 'muted';

export type TimelineCompositionProps = {
  timeline: Timeline;
  audio?: TimelineAudioMode | undefined;
  captionPreset?: CaptionPresetId | undefined;
  captionPlatform?: CaptionPlatform | undefined;
  captionAnchor?: CaptionAnchor | undefined;
};

export const TIMELINE_COMPOSITION_ID = 'TimelineComposition';

export const calculateTimelineMetadata: CalculateMetadataFunction<TimelineCompositionProps> = ({
  props,
}) => {
  const metadata = computeTimelineMetadata(props.timeline);

  return {
    durationInFrames: metadata.durationInFrames,
    fps: metadata.fps,
    width: metadata.width,
    height: metadata.height,
    props: { ...props, timeline: metadata.timeline },
  };
};

export const TimelineComposition: FC<TimelineCompositionProps> = ({
  timeline,
  audio,
  captionPreset,
  captionPlatform,
  captionAnchor,
}) => {
  const plan = timelineToSequenceProps(timeline);
  const safeZone = timeline.safeZone ?? safeZoneFor(timeline.format);
  const resolvedCaptionPreset = captionPresetIdForStyle(timeline.captionStyle, captionPreset);
  const introFrames = introBumperFrames(timeline);
  const outroFrames = outroBumperFrames(timeline);

  const content = [
    <ArollSeries
      key="aroll"
      scenes={plan.aroll}
      transitions={plan.arollTransitions}
      fps={plan.fps}
    />,
    <BrollTrack key="broll" clips={plan.broll} />,
    audio === 'muted' ? null : (
      <AudioTrack
        key="audio"
        voice={plan.voice}
        music={plan.music}
        automation={timeline.audioMix.automation}
      />
    ),
    plan.logo === null ? null : <LogoOverlay key="logo" logo={plan.logo} />,
    resolvedCaptionPreset === null ? null : (
      <KineticCaptions
        key="captions"
        clips={plan.captions}
        format={timeline.format}
        safeZone={safeZone}
        preset={resolvedCaptionPreset}
        platform={captionPlatform}
        anchor={captionAnchor}
        theme={timeline.captionTheme}
      />
    ),
  ];

  if (introFrames === 0 && outroFrames === 0) {
    return <AbsoluteFill>{content}</AbsoluteFill>;
  }

  const intro = timeline.bumpers?.intro;
  const outro = timeline.bumpers?.outro;

  return (
    <AbsoluteFill>
      {introFrames === 0 || intro === undefined ? null : (
        <Sequence from={0} durationInFrames={introFrames}>
          <LogoBumperScene
            bumper={intro}
            format={timeline.format}
            durationInFrames={introFrames}
            logoSrc={plan.bumperLogoSrc.intro}
          />
        </Sequence>
      )}
      <Sequence from={introFrames} durationInFrames={timeline.durationFrames}>
        {content}
      </Sequence>
      {outroFrames === 0 || outro === undefined ? null : (
        <Sequence from={introFrames + timeline.durationFrames} durationInFrames={outroFrames}>
          <LogoBumperScene
            bumper={outro}
            format={timeline.format}
            durationInFrames={outroFrames}
            logoSrc={plan.bumperLogoSrc.outro}
          />
        </Sequence>
      )}
    </AbsoluteFill>
  );
};
