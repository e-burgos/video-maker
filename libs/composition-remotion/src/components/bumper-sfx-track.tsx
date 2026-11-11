import type { FC } from 'react';
import { Audio, Sequence } from 'remotion';
import type { Fps } from '@video-maker/timeline-core';
import { msToFrames } from '@video-maker/timeline-core';

export interface PreviewSfxCue {
  readonly src: string;
  readonly atMs: number;
  readonly durationMs: number;
  readonly volume: number;
}

export type BumperSfxTrackProps = {
  cues: readonly PreviewSfxCue[];
  fps: Fps;
};

export const BumperSfxTrack: FC<BumperSfxTrackProps> = ({ cues, fps }) => (
  <>
    {cues.map((cue, index) => (
      <Sequence
        key={`${cue.src}-${index}`}
        from={msToFrames(cue.atMs, fps)}
        durationInFrames={Math.max(1, msToFrames(cue.durationMs, fps))}
      >
        <Audio src={cue.src} volume={cue.volume} />
      </Sequence>
    ))}
  </>
);
