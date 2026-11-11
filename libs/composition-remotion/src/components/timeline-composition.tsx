import type { FC } from 'react';
import type { CalculateMetadataFunction } from 'remotion';
import { AbsoluteFill, Sequence } from 'remotion';
import type { Timeline } from '@video-maker/timeline-core';
import { introBumperFrames, outroBumperFrames, resolveBumperLook, safeZoneFor } from '@video-maker/timeline-core';
import { captionPresetIdForStyle } from '../helpers/caption-style-preset';
import type { CaptionAnchor } from '../helpers/caption-box';
import type { CaptionPresetId } from '../helpers/caption-preset';
import type { CaptionPlatform } from '../helpers/caption-safe-zone';
import { computeTimelineMetadata } from '../helpers/timeline-metadata';
import { timelineToSequenceProps } from '../helpers/timeline-to-sequence-props';
import { ArollSeries } from './aroll-series';
import { BrollTrack } from './broll-track';
import { AudioTrack } from './audio-track';
import { BumperSfxTrack } from './bumper-sfx-track';
import type { PreviewSfxCue } from './bumper-sfx-track';
import { KineticCaptions } from './kinetic-captions';
import { LogoBumperScene } from './logo-bumper-scene';
import { LogoOverlay } from './logo-overlay';

export type TimelineAudioMode = 'mix' | 'muted';

export type TimelineCompositionProps = {
  timeline: Timeline;
  audio?: TimelineAudioMode | undefined;
  bumperSfx?: readonly PreviewSfxCue[] | undefined;
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
  bumperSfx,
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

  const sfx =
    audio === 'muted' || bumperSfx === undefined || bumperSfx.length === 0 ? null : (
      <BumperSfxTrack cues={bumperSfx} fps={timeline.format.fps} />
    );

  if (introFrames === 0 && outroFrames === 0) {
    return <AbsoluteFill>{content}</AbsoluteFill>;
  }

  const intro = timeline.bumpers?.intro;
  const outro = timeline.bumpers?.outro;
  const introLook = timeline.bumpers === undefined ? null : resolveBumperLook(timeline.bumpers, 'intro', timeline.id);
  const outroLook = timeline.bumpers === undefined ? null : resolveBumperLook(timeline.bumpers, 'outro', timeline.id);

  return (
    <AbsoluteFill>
      {introFrames === 0 || intro === undefined || introLook === null ? null : (
        <Sequence from={0} durationInFrames={introFrames}>
          <LogoBumperScene
            look={introLook}
            logoWidthRatio={intro.logoWidthRatio}
            format={timeline.format}
            durationInFrames={introFrames}
            logoSrc={plan.bumperLogoSrc.intro}
            noiseSeed={`${timeline.id}:intro`}
          />
        </Sequence>
      )}
      <Sequence from={introFrames} durationInFrames={timeline.durationFrames}>
        {content}
      </Sequence>
      {outroFrames === 0 || outro === undefined || outroLook === null ? null : (
        <Sequence from={introFrames + timeline.durationFrames} durationInFrames={outroFrames}>
          <LogoBumperScene
            look={outroLook}
            logoWidthRatio={outro.logoWidthRatio}
            format={timeline.format}
            durationInFrames={outroFrames}
            logoSrc={plan.bumperLogoSrc.outro}
            noiseSeed={`${timeline.id}:outro`}
          />
        </Sequence>
      )}
      {sfx}
    </AbsoluteFill>
  );
};
