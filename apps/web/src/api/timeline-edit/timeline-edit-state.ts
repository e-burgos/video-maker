import type {
  CaptionStyle,
  LogoPosition,
  TimelineWarning,
  MediaAsset,
  OutputPreset,
  Timeline,
  TimelineIssue,
} from '@video-maker/timeline-core';
import { timelineWarnings, validateTimeline } from '@video-maker/timeline-core';

import { relayoutArollTrack, voiceMirrorIssue } from './aroll-layout';
import type { VoiceMirrorIssue } from './aroll-layout';
import { applyOutputPreset } from './apply-output-preset';
import { issueSeverity } from './issue-severity';
import { clearTimelineLogo, setTimelineLogo, setTimelineLogoStyle } from './logo-overlay';
import { setTimelineBumperEnabled, setTimelineBumperStyle } from './logo-bumpers';
import type { BumperEdge, BumperStyle } from './logo-bumpers';
import { setTimelineCaptionStyle } from './caption-style';
import { rescaleMusicAutomation } from './rescale-music-automation';
import {
  rejectCaptionWordText,
  rejectDurationAgainstTransitions,
  rejectDurationFrames,
  rejectTrimStartMs,
} from './timeline-edit-rules';
import type { TimelineEditRejection } from './timeline-edit-rules';
import { timelineDocumentsEqual } from './timeline-document';

export type TimelineEditIssue = TimelineIssue | VoiceMirrorIssue | TimelineWarning;

export type TimelineEditAction =
  | { type: 'clip-trim-start'; track: 'aroll' | 'broll'; clipId: string; trimStartMs: number }
  | { type: 'clip-duration'; track: 'aroll' | 'broll'; clipId: string; durationFrames: number }
  | { type: 'aroll-move'; clipId: string; toIndex: number }
  | { type: 'caption-word-text'; clipId: string; wordIndex: number; text: string }
  | { type: 'music-levels'; baseGainDb: number; duckedGainDb: number }
  | { type: 'output-preset'; preset: OutputPreset }
  | { type: 'logo-set'; asset: MediaAsset; position: LogoPosition }
  | { type: 'logo-style'; widthRatio: number; opacity: number }
  | { type: 'logo-clear' }
  | { type: 'bumper-enabled'; edge: BumperEdge; enabled: boolean }
  | { type: 'bumper-style'; edge: BumperEdge; style: BumperStyle }
  | { type: 'caption-style'; captionStyle: CaptionStyle }
  | { type: 'saved'; timeline: Timeline }
  | { type: 'reset' };

export type TimelineEditState = {
  saved: Timeline;
  draft: Timeline;
  dirty: boolean;
  rejections: readonly TimelineEditRejection[];
  issues: readonly TimelineEditIssue[];
  warnings: readonly TimelineWarning[];
};

function computeIssues(timeline: Timeline): TimelineEditIssue[] {
  const validation = validateTimeline(timeline);
  const issues: TimelineEditIssue[] = validation.ok ? [] : [...validation.issues];

  const mirrorIssue = voiceMirrorIssue(timeline.tracks);
  if (mirrorIssue !== null) {
    issues.push(mirrorIssue);
  }

  return issues;
}

function settle(
  saved: Timeline,
  draft: Timeline,
  rejection: TimelineEditRejection | null,
): TimelineEditState {
  return {
    saved,
    draft,
    dirty: !timelineDocumentsEqual(draft, saved),
    rejections: rejection === null ? [] : [rejection],
    issues: computeIssues(draft),
    warnings: timelineWarnings(draft),
  };
}

export function initialTimelineEditState(timeline: Timeline): TimelineEditState {
  return {
    saved: timeline,
    draft: timeline,
    dirty: false,
    rejections: [],
    issues: computeIssues(timeline),
    warnings: timelineWarnings(timeline),
  };
}

function withAroll(draft: Timeline, aroll: Timeline['tracks']['aroll']): Timeline {
  return relayoutArollTrack({ ...draft, tracks: { ...draft.tracks, aroll } });
}

function withBroll(draft: Timeline, broll: Timeline['tracks']['broll']): Timeline {
  return { ...draft, tracks: { ...draft.tracks, broll } };
}

export function timelineEditReducer(state: TimelineEditState, action: TimelineEditAction): TimelineEditState {
  switch (action.type) {
    case 'saved':
      return settle(action.timeline, action.timeline, null);

    case 'reset':
      return settle(state.saved, state.saved, null);

    case 'clip-trim-start': {
      const clips = state.draft.tracks[action.track];
      const index = clips.findIndex((clip) => clip.id === action.clipId);
      if (index === -1) {
        return state;
      }

      const rejection = rejectTrimStartMs(
        action.trimStartMs,
        `tracks.${action.track}[${index}].trimStartMs`,
      );
      if (rejection !== null) {
        return settle(state.saved, state.draft, rejection);
      }

      const nextClips = clips.map((clip, i) =>
        i === index ? { ...clip, trimStartMs: action.trimStartMs } : clip,
      );
      const nextDraft =
        action.track === 'aroll' ? withAroll(state.draft, nextClips) : withBroll(state.draft, nextClips);

      return settle(state.saved, nextDraft, null);
    }

    case 'clip-duration': {
      const clips = state.draft.tracks[action.track];
      const index = clips.findIndex((clip) => clip.id === action.clipId);
      if (index === -1) {
        return state;
      }

      const path = `tracks.${action.track}[${index}].durationFrames`;
      const schemaRejection = rejectDurationFrames(action.durationFrames, path);
      const rejection =
        schemaRejection ??
        (action.track === 'aroll'
          ? rejectDurationAgainstTransitions(state.draft, action.clipId, action.durationFrames)
          : null);
      if (rejection !== null) {
        return settle(state.saved, state.draft, rejection);
      }

      const nextClips = clips.map((clip, i) =>
        i === index ? { ...clip, durationFrames: action.durationFrames } : clip,
      );
      const nextDraft =
        action.track === 'aroll' ? withAroll(state.draft, nextClips) : withBroll(state.draft, nextClips);

      return settle(state.saved, nextDraft, null);
    }

    case 'aroll-move': {
      const clips = state.draft.tracks.aroll;
      const fromIndex = clips.findIndex((clip) => clip.id === action.clipId);
      if (fromIndex === -1 || action.toIndex < 0 || action.toIndex >= clips.length) {
        return state;
      }

      const reordered = [...clips];
      const [moved] = reordered.splice(fromIndex, 1);
      if (moved === undefined) {
        return state;
      }
      reordered.splice(action.toIndex, 0, moved);

      return settle(state.saved, withAroll(state.draft, reordered), null);
    }

    case 'caption-word-text': {
      const captionIndex = state.draft.tracks.captions.findIndex(
        (caption) => caption.id === action.clipId,
      );
      const caption = state.draft.tracks.captions[captionIndex];
      if (caption === undefined || action.wordIndex < 0 || action.wordIndex >= caption.words.length) {
        return state;
      }

      const rejection = rejectCaptionWordText(
        action.text,
        `tracks.captions[${captionIndex}].words[${action.wordIndex}].text`,
      );
      if (rejection !== null) {
        return settle(state.saved, state.draft, rejection);
      }

      const nextCaptions = state.draft.tracks.captions.map((clip, i) =>
        i === captionIndex
          ? {
              ...clip,
              words: clip.words.map((word, wordIndex) =>
                wordIndex === action.wordIndex ? { ...word, text: action.text } : word,
              ),
            }
          : clip,
      );
      const nextDraft: Timeline = {
        ...state.draft,
        tracks: { ...state.draft.tracks, captions: nextCaptions },
      };

      return settle(state.saved, nextDraft, null);
    }

    case 'music-levels': {
      const previous = {
        baseGainDb: state.draft.audioMix.music.baseGainDb,
        duckedGainDb: state.draft.audioMix.music.duckedGainDb,
      };
      const next = { baseGainDb: action.baseGainDb, duckedGainDb: action.duckedGainDb };
      const rescale = rescaleMusicAutomation(state.draft.audioMix.automation, previous, next);

      const nextDraft: Timeline = {
        ...state.draft,
        audioMix: {
          ...state.draft.audioMix,
          music: { ...state.draft.audioMix.music, ...next },
          automation: rescale.automation,
        },
      };

      return settle(state.saved, nextDraft, null);
    }

    case 'output-preset':
      return settle(state.saved, applyOutputPreset(state.draft, action.preset), null);

    case 'logo-set':
      return settle(
        state.saved,
        setTimelineLogo(state.draft, action.asset, action.position),
        null,
      );

    case 'logo-style':
      return settle(
        state.saved,
        setTimelineLogoStyle(state.draft, {
          widthRatio: action.widthRatio,
          opacity: action.opacity,
        }),
        null,
      );

    case 'logo-clear':
      return settle(state.saved, clearTimelineLogo(state.draft), null);

    case 'bumper-enabled':
      return settle(
        state.saved,
        setTimelineBumperEnabled(state.draft, action.edge, action.enabled),
        null,
      );

    case 'bumper-style':
      return settle(
        state.saved,
        setTimelineBumperStyle(state.draft, action.edge, action.style),
        null,
      );

    case 'caption-style':
      return settle(state.saved, setTimelineCaptionStyle(state.draft, action.captionStyle), null);
  }
}

export function canSaveTimeline(state: TimelineEditState): boolean {
  return (
    state.dirty &&
    state.rejections.length === 0 &&
    !state.issues.some((issue) => issueSeverity(issue.code) === 'save-blocking')
  );
}

export function canStartRender(state: TimelineEditState): boolean {
  return !state.dirty && state.issues.length === 0;
}
