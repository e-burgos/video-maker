import type { FC } from 'react';
import { Audio, Sequence } from 'remotion';
import type { GainKeyframe } from '@video-maker/timeline-core';
import { volumeAtFrame } from '../helpers/audio-gain';
import type { AudioSequenceProps } from '../helpers/timeline-to-sequence-props';

export interface AudioTrackProps {
  voice: readonly AudioSequenceProps[];
  music: readonly AudioSequenceProps[];
  automation: readonly GainKeyframe[];
}

function musicVolume(clip: AudioSequenceProps, automation: readonly GainKeyframe[]) {
  if (automation.length === 0) {
    return clip.volume;
  }
  return (frameInClip: number) =>
    volumeAtFrame(automation, frameInClip + clip.from, clip.normalizationGainDb);
}

export const AudioTrack: FC<AudioTrackProps> = ({ voice, music, automation }) => (
  <>
    {voice.map((clip) => (
      <Sequence key={clip.clipId} from={clip.from} durationInFrames={clip.durationInFrames}>
        <Audio src={clip.src} trimBefore={clip.trimBefore} volume={clip.volume} />
      </Sequence>
    ))}
    {music.map((clip) => (
      <Sequence key={clip.clipId} from={clip.from} durationInFrames={clip.durationInFrames}>
        <Audio src={clip.src} trimBefore={clip.trimBefore} volume={musicVolume(clip, automation)} />
      </Sequence>
    ))}
  </>
);
