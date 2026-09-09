import { useMemo } from 'react';
import type { FC } from 'react';
import { Player } from '@remotion/player';
import type { Timeline } from '@video-maker/timeline-core';
import {
  TimelineComposition,
  VideoBackendProvider,
  computeTimelineMetadata,
} from '@video-maker/composition-remotion';
import type { TimelineCompositionProps } from '@video-maker/composition-remotion';

export type TimelinePlayerProps = {
  timeline: Timeline;
  initialFrame?: number;
  controls?: boolean;
};

const PlayerComposition: FC<TimelineCompositionProps> = (props) => (
  <VideoBackendProvider backend="player">
    <TimelineComposition {...props} />
  </VideoBackendProvider>
);

export function TimelinePlayer({ timeline, initialFrame, controls = true }: TimelinePlayerProps) {
  const metadata = useMemo(() => computeTimelineMetadata(timeline), [timeline]);
  const inputProps = useMemo<TimelineCompositionProps>(
    () => ({ timeline: metadata.timeline }),
    [metadata],
  );

  return (
    <div
      data-testid="timeline-player"
      data-duration-in-frames={metadata.durationInFrames}
      data-fps={metadata.fps}
      data-composition-width={metadata.width}
      data-composition-height={metadata.height}
      className="mx-auto w-full max-w-md overflow-hidden rounded-xl border border-slate-800 bg-black"
    >
      <Player
        component={PlayerComposition}
        inputProps={inputProps}
        durationInFrames={metadata.durationInFrames}
        fps={metadata.fps}
        compositionWidth={metadata.width}
        compositionHeight={metadata.height}
        style={{ width: '100%' }}
        controls={controls}
        acknowledgeRemotionLicense
        {...(initialFrame !== undefined ? { initialFrame } : {})}
      />
    </div>
  );
}
