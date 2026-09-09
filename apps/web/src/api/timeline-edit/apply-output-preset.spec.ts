import { defaultFormat, safeZoneFor, validateTimeline } from '@video-maker/timeline-core';
import type { Timeline } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { editableTimelineFixture } from '../__fixtures__/editable-timeline';
import { applyOutputPreset } from './apply-output-preset';

describe('applyOutputPreset', () => {
  it('returns the same object when the preset does not change', () => {
    const fixture = editableTimelineFixture();

    expect(applyOutputPreset(fixture, fixture.format.preset)).toBe(fixture);
  });

  it('changes format and safeZone together, matching defaultFormat/safeZoneFor for the new preset', () => {
    const fixture = editableTimelineFixture();

    const result = applyOutputPreset(fixture, 'youtube-16x9');

    expect(result.format).toEqual(defaultFormat('youtube-16x9'));
    expect(result.safeZone).toEqual(safeZoneFor(defaultFormat('youtube-16x9')));
  });

  it('omits the box key from every caption clip, instead of setting it to undefined', () => {
    const fixture = editableTimelineFixture();
    expect(fixture.tracks.captions.length).toBeGreaterThan(0);
    fixture.tracks.captions.forEach((caption) => expect(caption.box).toBeDefined());

    const result = applyOutputPreset(fixture, 'youtube-16x9');

    result.tracks.captions.forEach((caption) => {
      expect('box' in caption).toBe(false);
    });
  });

  it('demonstrates the problem it prevents: without the omission, youtube-16x9 fails CAPTION_OUT_OF_SAFE_ZONE over the fixture captions', () => {
    const fixture = editableTimelineFixture();
    const format = defaultFormat('youtube-16x9');
    const withoutOmission: Timeline = {
      ...fixture,
      format,
      safeZone: safeZoneFor(format),
    };

    const result = validateTimeline(withoutOmission);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === 'CAPTION_OUT_OF_SAFE_ZONE')).toBe(true);
    }
  });

  it('fixes that same problem: with the omission, youtube-16x9 validates clean over the fixture', () => {
    const fixture = editableTimelineFixture();

    const result = applyOutputPreset(fixture, 'youtube-16x9');

    expect(validateTimeline(result)).toEqual({ ok: true });
  });

  it('leaves every other track and the caption words untouched', () => {
    const fixture = editableTimelineFixture();

    const result = applyOutputPreset(fixture, 'youtube-16x9');

    expect(result.tracks.aroll).toEqual(fixture.tracks.aroll);
    expect(result.tracks.broll).toEqual(fixture.tracks.broll);
    expect(result.tracks.voice).toEqual(fixture.tracks.voice);
    expect(result.tracks.music).toEqual(fixture.tracks.music);
    expect(result.tracks.captions.map((caption) => caption.words)).toEqual(
      fixture.tracks.captions.map((caption) => caption.words),
    );
  });
});
