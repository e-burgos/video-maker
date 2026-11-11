import { describe, expect, it } from 'vitest';
import { TimelineSchema } from '@video-maker/timeline-core';

import { editableTimelineFixture } from '../__fixtures__/editable-timeline';
import {
  addTextOverlay,
  canAddTextOverlay,
  removeTextOverlay,
  textOverlayVariantChoices,
  updateTextOverlay,
  variantPatch,
} from './text-overlays';
import { canSaveTimeline, initialTimelineEditState, timelineEditReducer } from './timeline-edit-state';

describe('text overlays in the editor', () => {
  it('adds texts one after the other without overlapping, and the result is a valid timeline', () => {
    const base = editableTimelineFixture();
    const once = addTextOverlay(base, 'chapter-title', 'Ventas');
    const twice = addTextOverlay(once, 'lower-third', 'Caja');

    expect(twice.textOverlays?.map((overlay) => [overlay.id, overlay.startMs])).toEqual([
      ['text-1', 0],
      ['text-2', 3000],
    ]);
    expect(TimelineSchema.safeParse(twice).success).toBe(true);
  });

  it('updates a field, drops an emptied optional line and goes back to auto', () => {
    const base = addTextOverlay(editableTimelineFixture(), 'chapter-title', 'Ventas');
    const withVariant = updateTextOverlay(base, 'text-1', { eyebrow: '01', ...variantPatch('mask-wipe') });
    expect(withVariant.textOverlays?.[0]).toMatchObject({ eyebrow: '01', variant: 'mask-wipe' });

    const back = updateTextOverlay(withVariant, 'text-1', { eyebrow: undefined, ...variantPatch('auto') });
    expect(back.textOverlays?.[0]).not.toHaveProperty('eyebrow');
    expect(back.textOverlays?.[0]).not.toHaveProperty('variant');
  });

  it('removing the last text drops the whole section', () => {
    const base = addTextOverlay(editableTimelineFixture(), 'kinetic-text', 'Listo');
    expect(removeTextOverlay(base, 'text-1')).not.toHaveProperty('textOverlays');
  });

  it('offers auto first and only the variants of the kind', () => {
    expect(textOverlayVariantChoices('lower-third')).toEqual(['auto', 'slide-underline', 'accent-bar', 'plate-wipe']);
  });

  it('cannot add past the end of the timeline', () => {
    const timeline = editableTimelineFixture();
    expect(canAddTextOverlay(timeline)).toBe(true);
    expect(canAddTextOverlay({ ...timeline, durationFrames: 30 })).toBe(false);
  });

  it('an overlap blocks the save through the reducer', () => {
    let state = initialTimelineEditState(editableTimelineFixture());
    state = timelineEditReducer(state, { type: 'text-overlay-add', kind: 'lower-third', text: 'Uno' });
    state = timelineEditReducer(state, { type: 'text-overlay-add', kind: 'lower-third', text: 'Dos' });
    expect(canSaveTimeline(state)).toBe(true);

    state = timelineEditReducer(state, { type: 'text-overlay-update', id: 'text-2', patch: { startMs: 1000 } });
    expect(canSaveTimeline(state)).toBe(false);

    state = timelineEditReducer(state, { type: 'text-overlay-remove', id: 'text-2' });
    expect(canSaveTimeline(state)).toBe(true);
  });
});
