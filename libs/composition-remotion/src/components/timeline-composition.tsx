import type { FC } from 'react';
import type { CalculateMetadataFunction } from 'remotion';
import { AbsoluteFill } from 'remotion';
import type { Timeline } from '@video-maker/timeline-core';
import { safeZoneFor } from '@video-maker/timeline-core';
import type { CaptionAnchor } from '../helpers/caption-box';
import type { CaptionPresetId } from '../helpers/caption-preset';
import type { CaptionPlatform } from '../helpers/caption-safe-zone';
import { computeTimelineMetadata } from '../helpers/timeline-metadata';
import { timelineToSequenceProps } from '../helpers/timeline-to-sequence-props';
import { ArollSeries } from './aroll-series';
import { BrollTrack } from './broll-track';
import { AudioTrack } from './audio-track';
import { KineticCaptions } from './kinetic-captions';

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

  return (
    <AbsoluteFill>
      <ArollSeries scenes={plan.aroll} transitions={plan.arollTransitions} fps={plan.fps} />
      <BrollTrack clips={plan.broll} />
      {audio === 'muted' ? null : (
        <AudioTrack voice={plan.voice} music={plan.music} automation={timeline.audioMix.automation} />
      )}
      <KineticCaptions
        clips={plan.captions}
        format={timeline.format}
        safeZone={safeZone}
        preset={captionPreset}
        platform={captionPlatform}
        anchor={captionAnchor}
      />
    </AbsoluteFill>
  );
};
