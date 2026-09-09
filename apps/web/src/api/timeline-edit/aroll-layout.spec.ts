import { validateTimeline } from '@video-maker/timeline-core';
import type { Timeline } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { editableTimelineFixture } from '../__fixtures__/editable-timeline';
import {
  VOICE_TRACK_NOT_MIRRORED_CODE,
  clampTracksToDuration,
  mirrorVoiceFromAroll,
  relayoutArollTrack,
  transitionFramesBetween,
  voiceMirrorIssue,
} from './aroll-layout';

describe('transitionFramesBetween', () => {
  it('returns the duration in frames of the transition between the two given clips', () => {
    const timeline = editableTimelineFixture();
    const transition = timeline.transitions?.[0];
    expect(transition).toBeDefined();
    const [outgoingClipId, enteringClipId] = transition?.betweenClipIds ?? ['', ''];

    expect(transitionFramesBetween(timeline.transitions ?? [], outgoingClipId, enteringClipId)).toBe(
      transition?.durationFrames,
    );
  });

  it('returns 0 for a pair of clips with no transition between them', () => {
    const timeline = editableTimelineFixture();

    expect(transitionFramesBetween(timeline.transitions ?? [], 'aroll-0001', 'aroll-0002')).toBe(0);
  });
});

describe('relayoutArollTrack', () => {
  it('recalculates from by discounting the real transition frames, not the naive sum, and keeps validateTimeline clean', () => {
    const fixture = editableTimelineFixture();
    const transition = fixture.transitions?.[0];
    expect(transition).toBeDefined();
    expect(transition?.durationFrames).toBeGreaterThan(0);

    const shortenedClipIndex = fixture.tracks.aroll.findIndex(
      (clip) => clip.id === transition?.betweenClipIds[0],
    );
    expect(shortenedClipIndex).toBeGreaterThanOrEqual(0);

    const shortenedDurationFrames = (fixture.tracks.aroll[shortenedClipIndex]?.durationFrames ?? 0) - 20;
    const edited: Timeline = {
      ...fixture,
      tracks: {
        ...fixture.tracks,
        aroll: fixture.tracks.aroll.map((clip, index) =>
          index === shortenedClipIndex ? { ...clip, durationFrames: shortenedDurationFrames } : clip,
        ),
      },
    };

    const cursorBeforeTransition = fixture.tracks.aroll
      .slice(0, shortenedClipIndex + 1)
      .reduce((sum, clip, index) => (index === shortenedClipIndex ? sum + shortenedDurationFrames : sum + clip.durationFrames), 0);
    const naiveNextFrom = cursorBeforeTransition;
    const discountedNextFrom = cursorBeforeTransition - (transition?.durationFrames ?? 0);
    expect(discountedNextFrom).not.toBe(naiveNextFrom);

    const relaid = relayoutArollTrack(edited);
    const enteringClip = relaid.tracks.aroll.find((clip) => clip.id === transition?.betweenClipIds[1]);

    expect(enteringClip?.from).toBe(discountedNextFrom);
    expect(enteringClip?.from).not.toBe(naiveNextFrom);

    const lastClip = relaid.tracks.aroll[relaid.tracks.aroll.length - 1];
    expect(relaid.durationFrames).toBe((lastClip?.from ?? 0) + (lastClip?.durationFrames ?? 0));

    expect(validateTimeline(relaid)).toEqual({ ok: true });
  });

  it('sums durations with no discount when the timeline omits transitions entirely', () => {
    const withoutTransitions: Timeline = { ...editableTimelineFixture() };
    delete withoutTransitions.transitions;

    const relaid = relayoutArollTrack(withoutTransitions);
    const expectedFroms = withoutTransitions.tracks.aroll.reduce<number[]>((froms, clip, index) => {
      const previousFrom = froms[index - 1] ?? 0;
      const previousDuration = withoutTransitions.tracks.aroll[index - 1]?.durationFrames ?? 0;
      froms.push(index === 0 ? 0 : previousFrom + previousDuration);
      return froms;
    }, []);

    expect(relaid.tracks.aroll.map((clip) => clip.from)).toEqual(expectedFroms);
  });

  it('mirrors voice and clamps broll/music as part of the same relayout', () => {
    const fixture = editableTimelineFixture();
    const shortened: Timeline = {
      ...fixture,
      tracks: {
        ...fixture.tracks,
        aroll: fixture.tracks.aroll.map((clip, index) =>
          index === fixture.tracks.aroll.length - 1
            ? { ...clip, durationFrames: Math.max(1, clip.durationFrames - 50) }
            : clip,
        ),
      },
    };

    const relaid = relayoutArollTrack(shortened);

    expect(relaid.tracks.voice).toHaveLength(relaid.tracks.aroll.length);
    relaid.tracks.voice.forEach((voiceClip, index) => {
      const arollClip = relaid.tracks.aroll[index];
      expect(voiceClip.from).toBe(arollClip?.from);
      expect(voiceClip.durationFrames).toBe(arollClip?.durationFrames);
      expect(voiceClip.trimStartMs).toBe(arollClip?.trimStartMs);
    });

    relaid.tracks.broll.forEach((clip) => {
      expect(clip.from + clip.durationFrames).toBeLessThanOrEqual(relaid.durationFrames);
    });
    relaid.tracks.music.forEach((clip) => {
      expect(clip.from + clip.durationFrames).toBeLessThanOrEqual(relaid.durationFrames);
    });
  });
});

describe('mirrorVoiceFromAroll', () => {
  it('copies from, durationFrames and trimStartMs from each aroll[i] to voice[i], preserving id and gainDb', () => {
    const fixture = editableTimelineFixture();
    const edited = {
      ...fixture.tracks,
      aroll: fixture.tracks.aroll.map((clip, index) =>
        index === 0 ? { ...clip, from: 999, durationFrames: 15, trimStartMs: 4321 } : clip,
      ),
    };

    const mirrored = mirrorVoiceFromAroll(edited);

    expect(mirrored.voice).toHaveLength(edited.aroll.length);
    mirrored.voice.forEach((voiceClip, index) => {
      const arollClip = edited.aroll[index];
      const originalVoiceClip = fixture.tracks.voice[index];
      expect(voiceClip.from).toBe(arollClip?.from);
      expect(voiceClip.durationFrames).toBe(arollClip?.durationFrames);
      expect(voiceClip.trimStartMs).toBe(arollClip?.trimStartMs);
      expect(voiceClip.id).toBe(originalVoiceClip?.id);
      expect(voiceClip.gainDb).toBe(originalVoiceClip?.gainDb);
    });
  });

  it('does not mirror when voice and aroll lengths differ, leaving voice untouched', () => {
    const fixture = editableTimelineFixture();
    const mismatched = {
      ...fixture.tracks,
      voice: fixture.tracks.voice.slice(0, -1),
    };

    const mirrored = mirrorVoiceFromAroll(mismatched);

    expect(mirrored.voice).toBe(mismatched.voice);
    expect(mirrored).toBe(mismatched);
  });

  it('reports VOICE_TRACK_NOT_MIRRORED when the lengths genuinely differ from the aroll track passed in', () => {
    const fixture = editableTimelineFixture();
    const mismatched = {
      ...fixture.tracks,
      voice: fixture.tracks.voice.slice(0, -1),
    };

    const issue = voiceMirrorIssue(mismatched);
    expect(issue?.code).toBe(VOICE_TRACK_NOT_MIRRORED_CODE);
    expect(issue?.message).toContain(String(mismatched.voice.length));
    expect(issue?.message).toContain(String(mismatched.aroll.length));

    const mirrored = mirrorVoiceFromAroll(mismatched);
    expect(mirrored).toBe(mismatched);
  });

  it('mirrors a document with equal lengths and reports no issue', () => {
    const fixture = editableTimelineFixture();

    expect(voiceMirrorIssue(fixture.tracks)).toBeNull();
  });
});

describe('clampTracksToDuration', () => {
  it('shortens broll and music clips that exceed the new duration, down to at least 1 frame', () => {
    const fixture = editableTimelineFixture();
    const brollClip = fixture.tracks.broll[0];
    expect(brollClip).toBeDefined();

    const newDuration = (brollClip?.from ?? 0) + 5;
    const clamped = clampTracksToDuration(fixture.tracks, newDuration);

    expect(clamped.broll[0]?.durationFrames).toBe(5);
    expect(clamped.music[0]?.durationFrames).toBe(newDuration - (fixture.tracks.music[0]?.from ?? 0));
  });

  it('clamps a clip down to 1 frame when the new duration lands at or before its from', () => {
    const fixture = editableTimelineFixture();
    const brollClip = fixture.tracks.broll[0];
    expect(brollClip).toBeDefined();

    const clamped = clampTracksToDuration(fixture.tracks, brollClip?.from ?? 0);

    expect(clamped.broll[0]?.durationFrames).toBe(1);
  });

  it('does not touch clips that already fit within the new duration', () => {
    const fixture = editableTimelineFixture();

    const clamped = clampTracksToDuration(fixture.tracks, fixture.durationFrames);

    expect(clamped.broll).toEqual(fixture.tracks.broll);
    expect(clamped.music).toEqual(fixture.tracks.music);
  });

  it('never touches aroll or voice', () => {
    const fixture = editableTimelineFixture();

    const clamped = clampTracksToDuration(fixture.tracks, 1);

    expect(clamped.aroll).toBe(fixture.tracks.aroll);
    expect(clamped.voice).toBe(fixture.tracks.voice);
  });
});
