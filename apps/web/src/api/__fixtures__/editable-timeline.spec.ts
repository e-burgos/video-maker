import { DEFAULT_MUSIC_MIX, TimelineSchema, validateTimeline } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { editableTimelineFixture } from './editable-timeline';

describe('editableTimelineFixture', () => {
  it('validates against TimelineSchema', () => {
    const result = TimelineSchema.safeParse(editableTimelineFixture());
    expect(result.success).toBe(true);
  });

  it('has no validateTimeline issue: it is a clean baseline for the timeline-edit tasks', () => {
    expect(validateTimeline(editableTimelineFixture())).toEqual({ ok: true });
  });

  it('carries at least one a-roll transition, so contiguity must discount its frames', () => {
    const timeline = editableTimelineFixture();

    expect(timeline.transitions?.length ?? 0).toBeGreaterThanOrEqual(1);
    const transition = timeline.transitions?.[0];
    expect(transition?.betweenClipIds).toHaveLength(2);
  });

  it('mirrors voice 1:1 against a-roll, both in length and per-clip timing', () => {
    const timeline = editableTimelineFixture();

    expect(timeline.tracks.voice).toHaveLength(timeline.tracks.aroll.length);
    timeline.tracks.voice.forEach((voiceClip, index) => {
      const arollClip = timeline.tracks.aroll[index];
      expect(arollClip).toBeDefined();
      expect(voiceClip.from).toBe(arollClip?.from);
      expect(voiceClip.durationFrames).toBe(arollClip?.durationFrames);
      expect(voiceClip.trimStartMs).toBe(arollClip?.trimStartMs);
    });
  });

  it('gives every caption clip a box', () => {
    const timeline = editableTimelineFixture();

    expect(timeline.tracks.captions.length).toBeGreaterThan(0);
    timeline.tracks.captions.forEach((caption) => {
      expect(caption.box).toBeDefined();
    });
  });

  it('rescales music automation across at least two separate ducking valleys', () => {
    const timeline = editableTimelineFixture();
    const automation = timeline.audioMix.automation;

    expect(automation.length).toBeGreaterThanOrEqual(3);

    const duckedFrames = automation
      .filter((keyframe) => keyframe.gainDb === DEFAULT_MUSIC_MIX.duckedGainDb)
      .map((keyframe) => keyframe.frame)
      .sort((a, b) => a - b);

    const valleyGaps = duckedFrames
      .slice(1)
      .map((frame, index) => frame - (duckedFrames[index] ?? frame));
    const separateValleys = valleyGaps.filter((gap) => gap > 1).length + 1;

    expect(separateValleys).toBeGreaterThanOrEqual(2);
  });

  it('has at least one clip with a non-zero trimStartMs and one with a non-zero from', () => {
    const timeline = editableTimelineFixture();
    const assetBackedClips = [
      ...timeline.tracks.aroll,
      ...timeline.tracks.broll,
      ...timeline.tracks.voice,
      ...timeline.tracks.music,
    ];

    expect(assetBackedClips.some((clip) => clip.trimStartMs > 0)).toBe(true);
    expect(assetBackedClips.some((clip) => clip.from > 0)).toBe(true);
  });

  it('returns a fresh Timeline value on every call', () => {
    const first = editableTimelineFixture();
    const second = editableTimelineFixture();

    expect(first).toEqual(second);
    expect(first).not.toBe(second);
  });
});
