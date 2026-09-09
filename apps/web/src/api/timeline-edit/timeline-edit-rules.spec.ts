import type { Timeline } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { editableTimelineFixture } from '../__fixtures__/editable-timeline';
import {
  rejectCaptionWordText,
  rejectDurationAgainstTransitions,
  rejectDurationFrames,
  rejectTrimStartMs,
} from './timeline-edit-rules';

describe('rejectTrimStartMs', () => {
  it('rejects a negative value', () => {
    expect(rejectTrimStartMs(-1, 'tracks.aroll[0].trimStartMs')).toMatchObject({
      code: 'TRIM_START_MS_INVALID',
      path: 'tracks.aroll[0].trimStartMs',
    });
  });

  it('rejects a non-integer value', () => {
    expect(rejectTrimStartMs(1.5, 'tracks.aroll[0].trimStartMs')?.code).toBe('TRIM_START_MS_INVALID');
  });

  it('accepts zero', () => {
    expect(rejectTrimStartMs(0, 'tracks.aroll[0].trimStartMs')).toBeNull();
  });

  it('accepts a positive integer', () => {
    expect(rejectTrimStartMs(2000, 'tracks.aroll[0].trimStartMs')).toBeNull();
  });
});

describe('rejectDurationFrames', () => {
  it('rejects zero', () => {
    expect(rejectDurationFrames(0, 'tracks.aroll[0].durationFrames')?.code).toBe('DURATION_FRAMES_INVALID');
  });

  it('rejects a negative value', () => {
    expect(rejectDurationFrames(-5, 'tracks.aroll[0].durationFrames')?.code).toBe('DURATION_FRAMES_INVALID');
  });

  it('rejects a non-integer value', () => {
    expect(rejectDurationFrames(2.2, 'tracks.aroll[0].durationFrames')?.code).toBe('DURATION_FRAMES_INVALID');
  });

  it('accepts 1', () => {
    expect(rejectDurationFrames(1, 'tracks.aroll[0].durationFrames')).toBeNull();
  });

  it('accepts a large positive integer', () => {
    expect(rejectDurationFrames(538, 'tracks.aroll[0].durationFrames')).toBeNull();
  });
});

describe('rejectCaptionWordText', () => {
  it('rejects an empty string', () => {
    expect(rejectCaptionWordText('', 'tracks.captions[0].words[0].text')?.code).toBe(
      'CAPTION_WORD_TEXT_EMPTY',
    );
  });

  it('accepts a single character', () => {
    expect(rejectCaptionWordText('a', 'tracks.captions[0].words[0].text')).toBeNull();
  });

  it('accepts a whitespace-only string, mirroring z.string().min(1) exactly', () => {
    expect(rejectCaptionWordText(' ', 'tracks.captions[0].words[0].text')).toBeNull();
  });
});

describe('rejectDurationAgainstTransitions', () => {
  it('rejects a duration shorter than the transitions touching the clip, on both sides of the transition', () => {
    const timeline = editableTimelineFixture();
    const transition = timeline.transitions?.[0];
    expect(transition).toBeDefined();
    const [outgoingClipId, enteringClipId] = transition?.betweenClipIds ?? ['', ''];
    const tooShort = transition?.durationFrames ?? 0;

    expect(rejectDurationAgainstTransitions(timeline, enteringClipId, tooShort)?.code).toBe(
      'DURATION_SHORTER_THAN_TRANSITION',
    );
    expect(rejectDurationAgainstTransitions(timeline, outgoingClipId, tooShort)?.code).toBe(
      'DURATION_SHORTER_THAN_TRANSITION',
    );
  });

  it('accepts a duration that fits the transition it touches, on both sides', () => {
    const timeline = editableTimelineFixture();
    const transition = timeline.transitions?.[0];
    expect(transition).toBeDefined();
    const [outgoingClipId, enteringClipId] = transition?.betweenClipIds ?? ['', ''];
    const minimum = (transition?.durationFrames ?? 0) + 1;

    expect(rejectDurationAgainstTransitions(timeline, enteringClipId, minimum)).toBeNull();
    expect(rejectDurationAgainstTransitions(timeline, outgoingClipId, minimum)).toBeNull();
  });

  it('accepts any duration of at least 1 frame for a clip that touches no transition', () => {
    const timeline = editableTimelineFixture();
    const untouchedClipId = timeline.tracks.broll[0]?.id ?? '';
    expect(untouchedClipId).not.toBe('');

    expect(rejectDurationAgainstTransitions(timeline, untouchedClipId, 1)).toBeNull();
  });

  it('accepts any duration of at least 1 frame when the timeline omits transitions entirely', () => {
    const withoutTransitions: Timeline = { ...editableTimelineFixture() };
    delete withoutTransitions.transitions;
    const clipId = withoutTransitions.tracks.aroll[0]?.id ?? '';
    expect(clipId).not.toBe('');

    expect(rejectDurationAgainstTransitions(withoutTransitions, clipId, 1)).toBeNull();
  });
});
