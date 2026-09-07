import type { FC } from 'react';
import type { CalculateMetadataFunction } from 'remotion';
import { AbsoluteFill } from 'remotion';
import type { Timeline } from '@video-maker/timeline-core';
import { safeZoneFor } from '@video-maker/timeline-core';
import { computeTimelineMetadata } from '../helpers/timeline-metadata';
import { timelineToSequenceProps } from '../helpers/timeline-to-sequence-props';
import { ArollSeries } from './aroll-series';
import { BrollTrack } from './broll-track';
import { AudioTrack } from './audio-track';
import { CaptionTrack } from './caption-track';

export type TimelineCompositionProps = {
  timeline: Timeline;
};

export const TIMELINE_COMPOSITION_ID = 'TimelineComposition';

export const calculateTimelineMetadata: CalculateMetadataFunction<TimelineCompositionProps> = ({ props }) => {
  const metadata = computeTimelineMetadata(props.timeline);

  return {
    durationInFrames: metadata.durationInFrames,
    fps: metadata.fps,
    width: metadata.width,
    height: metadata.height,
    props: { timeline: metadata.timeline },
  };
};

export const TimelineComposition: FC<TimelineCompositionProps> = ({ timeline }) => {
  const plan = timelineToSequenceProps(timeline);
  const safeZone = timeline.safeZone ?? safeZoneFor(timeline.format);

  return (
    <AbsoluteFill>
      <ArollSeries scenes={plan.aroll} transitions={plan.arollTransitions} fps={plan.fps} />
      <BrollTrack clips={plan.broll} />
      <AudioTrack voice={plan.voice} music={plan.music} automation={timeline.audioMix.automation} />
      <CaptionTrack clips={plan.captions} safeZone={safeZone} format={timeline.format} />
    </AbsoluteFill>
  );
};
