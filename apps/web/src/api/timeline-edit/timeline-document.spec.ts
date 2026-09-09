import { TimelineSchema } from '@video-maker/timeline-core';
import type { Timeline } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { editableTimelineFixture } from '../__fixtures__/editable-timeline';
import { canonicalTimelineJson, timelineDocumentsEqual } from './timeline-document';

function reverseKeyOrder(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(reverseKeyOrder);
  }

  if (typeof value === 'object' && value !== null) {
    const reversed: Record<string, unknown> = {};
    for (const [key, entryValue] of Object.entries(value).reverse()) {
      reversed[key] = reverseKeyOrder(entryValue);
    }
    return reversed;
  }

  return value;
}

function reorderedFixture(): Timeline {
  return reverseKeyOrder(editableTimelineFixture()) as Timeline;
}

describe('canonicalTimelineJson', () => {
  it('produces byte-identical output to the server-side write formula, key order included, for the same value under a different key order', () => {
    const draft = editableTimelineFixture();
    const loaded = reorderedFixture();

    expect(Object.keys(loaded)).not.toEqual(Object.keys(draft));

    const draftBytes = `${JSON.stringify(TimelineSchema.parse(draft), null, 2)}\n`;
    const loadedBytes = `${JSON.stringify(TimelineSchema.parse(loaded), null, 2)}\n`;

    expect(loadedBytes).toBe(draftBytes);
  });

  it('orders keys from the Zod shape, not from the literal input order', () => {
    const draft = editableTimelineFixture();
    const shapeOrder = Object.keys(JSON.parse(canonicalTimelineJson(draft)) as Record<string, unknown>);

    const reversedInput = reorderedFixture();
    const reversedInputTopLevelKeys = Object.keys(reversedInput);
    const outputFromReversedInput = Object.keys(
      JSON.parse(canonicalTimelineJson(reversedInput)) as Record<string, unknown>,
    );

    expect(reversedInputTopLevelKeys).not.toEqual(shapeOrder);
    expect(outputFromReversedInput).toEqual(shapeOrder);
  });
});

describe('timelineDocumentsEqual', () => {
  it('is insensitive to the key order of either document', () => {
    const draft = editableTimelineFixture();
    const loaded = reorderedFixture();

    expect(timelineDocumentsEqual(draft, loaded)).toBe(true);
  });

  it('is sensitive to any value change, however small', () => {
    const draft = editableTimelineFixture();
    const edited: Timeline = {
      ...draft,
      tracks: {
        ...draft.tracks,
        aroll: draft.tracks.aroll.map((clip, index) =>
          index === 0 ? { ...clip, trimStartMs: clip.trimStartMs + 1 } : clip,
        ),
      },
    };

    expect(timelineDocumentsEqual(draft, edited)).toBe(false);
  });
});
