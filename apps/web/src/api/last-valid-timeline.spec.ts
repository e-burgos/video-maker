import { describe, expect, it } from 'vitest';

import { editableTimelineFixture } from './__fixtures__/editable-timeline';
import { lastValidTimeline } from './last-valid-timeline';

describe('lastValidTimeline', () => {
  it('takes the new timeline when it is valid', () => {
    const next = editableTimelineFixture();
    expect(lastValidTimeline(null, next)).toBe(next);
  });

  it('keeps the previous one while the draft is invalid, and null if there was none', () => {
    const previous = editableTimelineFixture();
    const overlapping = {
      ...previous,
      textOverlays: [
        { id: 'a', kind: 'lower-third' as const, startMs: 0, durationMs: 2000, text: 'Uno' },
        { id: 'b', kind: 'kinetic-text' as const, startMs: 1000, durationMs: 2000, text: 'Dos' },
      ],
    };
    expect(lastValidTimeline(previous, overlapping)).toBe(previous);
    expect(lastValidTimeline(null, overlapping)).toBeNull();
  });
});
