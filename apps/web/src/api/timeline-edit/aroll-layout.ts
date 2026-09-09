import type { Timeline, TimelineTransition } from '@video-maker/timeline-core';

export const VOICE_TRACK_NOT_MIRRORED_CODE = 'VOICE_TRACK_NOT_MIRRORED' as const;

export type VoiceMirrorIssue = {
  code: typeof VOICE_TRACK_NOT_MIRRORED_CODE;
  path: string;
  message: string;
};

export function transitionFramesBetween(
  transitions: readonly TimelineTransition[],
  outgoingClipId: string,
  enteringClipId: string,
): number {
  const transition = transitions.find(
    (candidate) =>
      candidate.betweenClipIds[0] === outgoingClipId && candidate.betweenClipIds[1] === enteringClipId,
  );
  return transition?.durationFrames ?? 0;
}

export function mirrorVoiceFromAroll(tracks: Timeline['tracks']): Timeline['tracks'] {
  const { aroll, voice } = tracks;
  if (voice.length !== aroll.length) {
    return tracks;
  }

  return {
    ...tracks,
    voice: voice.map((voiceClip, index) => {
      const arollClip = aroll[index];
      return {
        ...voiceClip,
        from: arollClip.from,
        durationFrames: arollClip.durationFrames,
        trimStartMs: arollClip.trimStartMs,
      };
    }),
  };
}

export function voiceMirrorIssue(tracks: Timeline['tracks']): VoiceMirrorIssue | null {
  if (tracks.voice.length === tracks.aroll.length) {
    return null;
  }

  return {
    code: VOICE_TRACK_NOT_MIRRORED_CODE,
    path: 'tracks.voice',
    message: `tracks.voice has ${tracks.voice.length} clip(s) but tracks.aroll has ${tracks.aroll.length}; the mirror was skipped instead of guessing.`,
  };
}

function clampClipToDuration<T extends { from: number; durationFrames: number }>(
  clip: T,
  durationFrames: number,
): T {
  if (clip.from + clip.durationFrames <= durationFrames) {
    return clip;
  }

  return { ...clip, durationFrames: Math.max(1, durationFrames - clip.from) };
}

export function clampTracksToDuration(tracks: Timeline['tracks'], durationFrames: number): Timeline['tracks'] {
  return {
    ...tracks,
    broll: tracks.broll.map((clip) => clampClipToDuration(clip, durationFrames)),
    music: tracks.music.map((clip) => clampClipToDuration(clip, durationFrames)),
  };
}

export function relayoutArollTrack(timeline: Timeline): Timeline {
  const transitions = timeline.transitions ?? [];
  const aroll = timeline.tracks.aroll;

  const relaid = aroll.reduce<{ clips: typeof aroll; cursor: number }>(
    (acc, clip, index) => {
      const previous = aroll[index - 1];
      const from =
        previous === undefined
          ? 0
          : acc.cursor - transitionFramesBetween(transitions, previous.id, clip.id);

      return {
        clips: [...acc.clips, { ...clip, from }],
        cursor: from + clip.durationFrames,
      };
    },
    { clips: [], cursor: 0 },
  );

  const durationFrames = relaid.cursor;
  const tracksWithRelaidAroll: Timeline['tracks'] = { ...timeline.tracks, aroll: relaid.clips };
  const tracksWithMirroredVoice = mirrorVoiceFromAroll(tracksWithRelaidAroll);
  const tracksClamped = clampTracksToDuration(tracksWithMirroredVoice, durationFrames);

  return { ...timeline, tracks: tracksClamped, durationFrames };
}
