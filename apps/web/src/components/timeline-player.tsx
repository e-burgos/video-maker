import { useMemo, useRef } from 'react';
import type { FC } from 'react';
import { Player } from '@remotion/player';
import type { Timeline } from '@video-maker/timeline-core';
import {
  TimelineComposition,
  VideoBackendProvider,
  computeTimelineMetadata,
} from '@video-maker/composition-remotion';
import type { TimelineCompositionProps } from '@video-maker/composition-remotion';
import { lastValidTimeline } from '../api/last-valid-timeline';
import { bundledPreviewBumperSfx } from '../api/preview-bumper-sfx';

export type TimelinePlayerProps = {
  timeline: Timeline;
  initialFrame?: number;
  controls?: boolean;
  fit?: boolean;
};

const PlayerComposition: FC<TimelineCompositionProps> = (props) => (
  <VideoBackendProvider backend="player">
    <TimelineComposition {...props} />
  </VideoBackendProvider>
);

function useLastValidTimeline(timeline: Timeline): Timeline | null {
  const lastValid = useRef<Timeline | null>(null);
  lastValid.current = lastValidTimeline(lastValid.current, timeline);
  return lastValid.current;
}

export function TimelinePlayer({
  timeline,
  initialFrame,
  controls = true,
  fit = false,
}: TimelinePlayerProps) {
  const playable = useLastValidTimeline(timeline);
  return playable === null ? null : (
    <ValidTimelinePlayer
      timeline={playable}
      initialFrame={initialFrame}
      controls={controls}
      fit={fit}
    />
  );
}

function ValidTimelinePlayer({
  timeline,
  initialFrame,
  controls,
  fit,
}: TimelinePlayerProps) {
  const metadata = useMemo(() => computeTimelineMetadata(timeline), [timeline]);
  const inputProps = useMemo<TimelineCompositionProps>(
    () => ({
      timeline: metadata.timeline,
      bumperSfx: bundledPreviewBumperSfx(metadata.timeline),
    }),
    [metadata],
  );

  return (
    <div
      data-testid="timeline-player"
      data-duration-in-frames={metadata.durationInFrames}
      data-fps={metadata.fps}
      data-media=""
      data-composition-width={metadata.width}
      data-composition-height={metadata.height}
      className={
        fit === true
          ? 'size-full overflow-hidden bg-[#0b0d14]'
          : 'mx-auto w-full max-w-md overflow-hidden rounded-xl border border-slate-800 bg-black'
      }
    >
      <Player
        component={PlayerComposition}
        inputProps={inputProps}
        durationInFrames={metadata.durationInFrames}
        fps={metadata.fps}
        compositionWidth={metadata.width}
        compositionHeight={metadata.height}
        style={
          fit === true ? { width: '100%', height: '100%' } : { width: '100%' }
        }
        controls={controls}
        acknowledgeRemotionLicense
        {...(initialFrame !== undefined ? { initialFrame } : {})}
      />
    </div>
  );
}
